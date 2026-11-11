import { daysInMonth, prevMonth, weekday } from '../core/dates.js';
import { ratio, ok } from '../core/values.js';
import { fmt, esc } from '../core/format.js';
import { achPill, achLevel, gauge, LEVEL_WORD } from '../core/achievement.js';
import { icon } from '../core/icons.js';
import { PERF_CARDS, PERCENT_COLUMNS_ARE_FRACTION } from '../config.js';

export const dayOf = (iso) => Number(iso.slice(8, 10));
export const NASIONAL = 'Nasional';

const hasActual = (r) => ok(r.os) && r.os !== 0;

function cumulateDisburse(rows) {
  const byMonth = new Map();
  let month = '';
  let run = 0;
  let seen = false;
  for (const r of rows) {
    const m = r.tanggal.slice(0, 7);
    if (m !== month) { month = m; run = 0; seen = false; }
    r.disburse_harian = ok(r.disburse) ? r.disburse : null;
    if (ok(r.disburse)) { run += r.disburse; seen = true; }
    r.disburse = seen ? run : null;
    if (!byMonth.has(m)) byMonth.set(m, new Map());
    byMonth.get(m).set(dayOf(r.tanggal), r.disburse);
  }
  for (const r of rows) {
    const prev = byMonth.get(prevMonth(r.tanggal.slice(0, 7)));
    let v = null;
    if (prev) for (let d = dayOf(r.tanggal); d >= 1 && v === null; d -= 1) if (prev.has(d) && ok(prev.get(d))) v = prev.get(d);
    r.disburse_lalu = v;
  }
}

export function indexPerf(perf, kuadran = []) {
  const byRo = new Map();
  const future = new Map();
  for (const r of perf) {
    if (!byRo.has(r.ro)) byRo.set(r.ro, []);
    byRo.get(r.ro).push({ ...r });
  }
  for (const [ro, rows] of [...byRo]) {
    rows.sort((a, b) => (a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : Number(hasActual(b)) - Number(hasActual(a))));
    for (let i = rows.length - 1; i > 0; i -= 1) if (rows[i].tanggal === rows[i - 1].tanggal) rows.splice(i, 1);
    let last = -1;
    rows.forEach((r, i) => { if (hasActual(r)) last = i; });
    future.set(ro, rows.slice(last + 1));
    rows.length = last + 1;
    if (!rows.length) { byRo.delete(ro); continue; }
    cumulateDisburse(rows);
  }
  const ros = [...byRo.keys()].sort((a, b) => (a === NASIONAL ? -1 : b === NASIONAL ? 1 : a.localeCompare(b, 'id')));
  const months = [...new Set([...byRo.values()].flat().map((r) => r.tanggal.slice(0, 7)))].sort();
  const regions = ros.filter((r) => r !== NASIONAL);
  const kq = new Map();
  for (const r of kuadran) {
    if (!kq.has(r.ro)) kq.set(r.ro, new Map());
    const byDate = kq.get(r.ro);
    if (!byDate.has(r.tanggal)) byDate.set(r.tanggal, []);
    byDate.get(r.tanggal).push(r);
  }
  return { byRo, future, ros, regions, months, kuadran: kq, hasNasional: byRo.has(NASIONAL) };
}

function kuadranRowsAt(byDate, date) {
  if (!byDate || !byDate.size) return null;
  const dates = [...byDate.keys()].sort();
  const month = date.slice(0, 7);
  const inMonth = dates.filter((d) => d.startsWith(month));
  const pickDate = inMonth.filter((d) => d <= date).at(-1) || inMonth[0] || dates.filter((d) => d <= date).at(-1);
  return pickDate ? { date: pickDate, rows: byDate.get(pickDate) } : null;
}

export function kuadranAt(pm, ro, date) {
  const own = kuadranRowsAt(pm.kuadran.get(ro), date);
  if (own || ro !== NASIONAL) return own;
  const sum = new Map();
  let at = '';
  for (const region of pm.regions) {
    const hit = kuadranRowsAt(pm.kuadran.get(region), date);
    if (!hit) continue;
    if (hit.date > at) at = hit.date;
    for (const r of hit.rows) {
      const o = sum.get(r.kuadran) || { kuadran: r.kuadran, jumlah_rm: 0, jumlah_rm_lalu: 0 };
      o.jumlah_rm += ok(r.jumlah_rm) ? r.jumlah_rm : 0;
      o.jumlah_rm_lalu += ok(r.jumlah_rm_lalu) ? r.jumlah_rm_lalu : 0;
      sum.set(r.kuadran, o);
    }
  }
  return sum.size ? { date: at, rows: [...sum.values()] } : null;
}

export function monthSlice(rowsRo, bulan, sd) {
  const monthRows = (rowsRo || []).filter((r) => r.tanggal.startsWith(bulan));
  if (!monthRows.length) return null;
  const days = monthRows.map((r) => dayOf(r.tanggal));
  const endDay = sd && days.includes(sd) ? sd : Math.max(...days);
  const rows = monthRows.filter((r) => dayOf(r.tanggal) <= endDay);
  const pm = prevMonth(bulan);
  const prevRows = (rowsRo || []).filter((r) => r.tanggal.startsWith(pm));
  return {
    bulan, rows, days, endDay, end: rows.at(-1),
    full: endDay === daysInMonth(bulan),
    byDay: new Map(rows.map((r) => [dayOf(r.tanggal), r])),
    prevByDay: new Map(prevRows.map((r) => [dayOf(r.tanggal), r])),
    prevEnd: prevRows.at(-1) || null,
  };
}

export function perfContext(pm, ro, bulan, sd = null) {
  const roKey = ro && pm.byRo.has(ro) ? ro : (pm.hasNasional ? NASIONAL : pm.ros[0]);
  const slice = monthSlice(pm.byRo.get(roKey), bulan, sd);
  return { pm, roKey, roLabel: ro || 'Nasional', slice, bulan };
}

export function cardValues(card, end) {
  const v = end?.[card.value];
  if (card.type === 'disburse') {
    const prognosa = end?.[card.prognosa];
    const guidance = end?.[card.guidance];
    return { value: v, prognosa, guidance, achProg: ratio(v, prognosa), achRka: ratio(v, guidance), ach: ratio(v, guidance) };
  }
  const target = end?.[card.target];
  const ach = card.inverse ? ratio(target, v) : ratio(v, target);
  const out = { value: v, target, ach, gap: ok(v) && ok(target) ? v - target : null };
  if (card.type === 'ratio') out.share = ratio(v, end?.[card.base]);
  return out;
}

export function kpiCard(card, slice) {
  const c = cardValues(card, slice?.end);
  const d = card.decimals ?? 0;
  const disb = card.type === 'disburse';
  const r = disb ? c.achProg : c.ach;
  const capWord = disb ? 'vs prognosa' : 'vs RKA';
  const tip = `${LEVEL_WORD[achLevel(r)]}${card.inverse ? ', makin kecil makin baik' : ''}`;
  const meta = disb
    ? `<span>vs RKA ${achPill(c.achRka)}</span><span>Prognosa <b>${fmt.num(c.prognosa, d)}</b></span>`
    : `<span>RKA <b>${fmt.num(c.target, d)}</b></span>${card.type === 'ratio'
      ? `<span>${esc(card.ratioLabel)} <b>${fmt.pct(c.share)}</b></span>`
      : `<span>GAP <b class="${(c.gap ?? 0) < 0 ? 'bad-t' : 'good-t'}">${fmt.signed(c.gap, d)}</b></span>`}`;
  return `<button type="button" class="kpi" data-card="${card.id}">
    <div class="kpi-top"><span class="kpi-ico">${icon(card.icon || 'pulse', 18)}</span>
      <span class="tile-ach" title="${esc(`${card.label} ${capWord}: ${tip}`)}"><span class="pill ${achLevel(r)}">${fmt.pct(r, 1)}</span><small>${capWord}</small></span></div>
    <span class="kpi-label">${esc(card.label || card.title)}</span>
    <span class="kpi-value">${fmt.num(c.value, d)}${card.unit ? `<small>${esc(card.unit)}</small>` : ''}</span>
    <div class="kpi-meta">${meta}</div></button>`;
}

export function featureBody(card, slice, extra = '') {
  const c = cardValues(card, slice?.end);
  const d = card.decimals ?? 0;
  return `${gauge(c.ach, { label: `${card.label} terhadap RKA`, caption: card.inverse ? 'dari RKA, makin kecil makin baik' : 'dari RKA' })}
    <div class="feature-v">${fmt.num(c.value, d)}<small>${esc(card.unit || '')}</small></div>
    <div class="feature-meta"><span>RKA <b>${fmt.num(c.target, d)}</b></span><span>GAP <b>${fmt.signed(c.gap, d)}</b></span>${extra}</div>`;
}

export function trendSeries(cfg, slice) {
  const D = daysInMonth(slice.bulan);
  const Dp = daysInMonth(prevMonth(slice.bulan));
  const n = slice.full ? Math.max(D, Dp) : slice.endDay;
  const labels = []; const cur = []; const prev = [];
  for (let d = 1; d <= n; d += 1) {
    labels.push(String(d));
    const row = d <= slice.endDay ? slice.byDay.get(d) : null;
    cur.push(row && ok(row[cfg.cur]) ? row[cfg.cur] : null);
    let p = row && ok(row[cfg.prev]) ? row[cfg.prev] : null;
    if (p === null && d > D) {
      const pr = slice.prevByDay.get(d);
      p = pr && ok(pr[cfg.cur]) ? pr[cfg.cur] : null;
    }
    prev.push(p);
  }
  const last = (a) => { for (let i = a.length - 1; i >= 0; i -= 1) if (ok(a[i])) return a[i]; return null; };
  return { labels, cur, prev, lastCur: last(cur), lastPrev: last(prev) };
}

export function badgeValue(badge, slice, series, cfg) {
  if (badge.column) return slice.end?.[badge.column] ?? null;
  const divisor = badge.divisor || 'hari_kerja';
  if (badge.of === 'prev') {
    const days = ok(slice.prevEnd?.[divisor]) ? slice.prevEnd[divisor] : slice.end?.hari_kerja_lalu;
    return ratio(slice.prevEnd?.[cfg.cur], days);
  }
  return ratio(series.lastCur, slice.end?.[divisor]);
}

export function roSummary(pm, bulan, endDay) {
  return pm.regions.map((ro) => {
    const s = monthSlice(pm.byRo.get(ro), bulan, endDay);
    if (!s) return null;
    const out = { ro, slice: s, end: s.end };
    for (const c of PERF_CARDS) out[c.id] = cardValues(c, s.end);
    return out;
  }).filter(Boolean);
}

export function osGrowth(slice) {
  const base = slice?.prevEnd?.os;
  const v = slice?.end?.os;
  return { abs: ok(v) && ok(base) ? v - base : null, rel: ok(v) && ok(base) && base ? (v - base) / base : null, base };
}

export const pctValue = (v) => (ok(v) ? (PERCENT_COLUMNS_ARE_FRACTION ? v : v / 100) : null);

export function monthEnds(pm, roKey) {
  const rows = pm.byRo.get(roKey) || [];
  const out = new Map();
  for (const r of rows) out.set(r.tanggal.slice(0, 7), r);
  return pm.months.map((m) => ({ bulan: m, row: out.get(m) || null }));
}

export function workdayIndex(slice) {
  const D = daysInMonth(slice.bulan);
  const idx = [];
  let last = 0;
  for (let d = 1; d <= D; d += 1) {
    const r = slice.byDay.get(d);
    if (r && ok(r.hari_kerja)) last = r.hari_kerja;
    else if (d > slice.endDay && weekday(`${slice.bulan}-${String(d).padStart(2, '0')}`) < 5) last += 1;
    idx.push(last);
  }
  return idx;
}

export function signalItems(pm, bulan, sd, ro) {
  const list = [];
  const ros = ro ? [ro] : pm.regions;
  for (const r of ros) {
    const s = monthSlice(pm.byRo.get(r), bulan, sd);
    if (!s) continue;
    for (const card of PERF_CARDS) {
      const c = cardValues(card, s.end);
      const disb = card.type === 'disburse';
      if (disb && !s.full) continue;
      const lvl = achLevel(c.ach);
      if (lvl !== 'bad' && lvl !== 'warn') continue;
      list.push({
        level: lvl, ro: r, ach: c.ach,
        title: ro ? card.label : `${r}: ${card.label}`,
        sub: `${fmt.num(c.value, card.decimals ?? 0)}${card.unit ? ` ${card.unit}` : ''} dari ${disb ? 'guidance' : 'RKA'} ${fmt.num(disb ? c.guidance : c.target, card.decimals ?? 0)}${card.inverse ? ', makin kecil makin baik' : ''}`,
        badge: achPill(c.ach),
        action: r,
      });
    }
  }
  return list.sort((a, b) => (a.level === b.level ? (a.ach ?? 0) - (b.ach ?? 0) : a.level === 'bad' ? -1 : 1));
}
