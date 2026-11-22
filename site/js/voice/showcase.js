import { esc, fmt } from '../core/format.js';
import { ok } from '../core/values.js';
import { shiftMonth, daysInMonth } from '../core/dates.js';
import { dayOf } from '../models/performance-model.js';
import { perfPeriods, realCompare, slaNow, pfSplit, roStanding } from '../models/direktur-model.js';
import { tn, signedTn, realRp, pct, points, short, roShort, tone, diff, trendTone } from '../views/direktur-format.js';

export function regionData(c, ro) {
  const [before, now] = perfPeriods(c.pm, ro, [shiftMonth(c.cur, -1), c.cur]);
  const history = perfPeriods(c.pm, ro, c.pm.months.slice(-7)).filter((x) => x.end && ok(x.os));
  const standing = roStanding(c.pm).filter((x) => ok(x.achOs));
  const byOs = [...standing].sort((a, b) => b.achOs - a.achOs);
  const byNpl = [...standing].sort((a, b) => (b.nplPct ?? -1) - (a.nplPct ?? -1));
  return {
    ro, name: roShort(ro), code: /^(Region\s*\d+)/i.exec(ro)?.[1] || '', c, now, before, history,
    rank: byOs.findIndex((x) => x.ro === ro) + 1, nplRank: byNpl.findIndex((x) => x.ro === ro) + 1, total: standing.length,
    real: c.realModel?.rows.length ? realCompare(c.realModel, ro, c.sel.sumber, c.cur) : null,
    sla: c.slaModel ? slaNow(c.slaModel, ro, [c.cur]) : null,
    split: c.pfModel ? pfSplit(c.pfModel, ro) : null,
  };
}

const status = (state, html) => `<p class="atl-t ${state}"><i aria-hidden="true"></i>${html}</p>`;

function meter(value, ref, state) {
  if (!ok(value) || !ok(ref) || ref <= 0) return '';
  const span = 1.25;
  const fill = Math.max(0, Math.min(span, value / ref)) / span;
  return `<span class="atl-meter ${state}" aria-hidden="true"><i style="--w:${fill.toFixed(4)}"></i><b style="--at:${(1 / span).toFixed(4)}"></b></span>`;
}

function osBars(list) {
  const grow = list.slice(1).map((x, i) => ({ month: x.month, v: x.os - list[i].os }));
  if (grow.length < 3) return '<span></span>';
  const max = Math.max(...grow.map((g) => Math.abs(g.v))) || 1;
  const label = (v) => `${v >= 0 ? '+' : '−'}${fmt.rupiah(Math.abs(v) * 1e9, 0)}`;
  return `<figure class="atl-hist"><figcaption>Tumbuh OS per bulan</figcaption><ol>${grow.map((g, i) => `<li class="${i === grow.length - 1 ? 'now' : ''}${g.v < 0 ? ' neg' : ''}" style="--h:${(Math.abs(g.v) / max).toFixed(4)};--j:${i}">
    <b>${esc(label(g.v))}</b><span></span><small>${esc(short(g.month))}</small></li>`).join('')}</ol></figure>`;
}

function heroCard(d) {
  const p = d.now;
  const prevMonth = short(d.before?.month);
  const grow = diff(p.os, d.before?.os);
  return `<article class="atl-card atl-hero" style="--i:0" aria-label="Ringkasan ${esc(d.name)}">
    <header><p class="atl-code">${esc(d.code || 'Regional')}</p><h2>${esc(d.name)}</h2><p class="atl-date">Posisi ${esc(fmt.date(p.date))}</p></header>
    <div class="atl-big"><span>Outstanding</span><b>${esc(tn(p.os).replace(/\s?T$/, ''))}<small>T</small></b></div>
    ${meter(p.os, p.rkaOs, tone(p.achOs))}
    ${status(tone(p.achOs), `<b>${esc(pct(p.achOs, 1))}</b> dari RKA ${esc(tn(p.rkaOs))}`)}
    ${ok(grow) ? `<p class="atl-d"><b class="${trendTone(grow)}">${grow >= 0 ? '▲' : '▼'} ${esc(signedTn(grow).replace(/^[+−]/, ''))}</b> dari akhir ${esc(prevMonth)}</p>` : ''}
    ${osBars(d.history)}
    <dl class="atl-mini">
      <div><dt>Debitur</dt><dd>${esc(fmt.num(p.deb))}</dd></div>
      <div><dt>Disburse bulan ini</dt><dd>${esc(tn(p.disb))}</dd></div>
      <div><dt>Peringkat capaian OS</dt><dd>${d.rank ? `${esc(d.rank)}<small> dari ${esc(d.total)}</small>` : '–'}</dd></div>
    </dl>
    <button class="btn" type="button" data-atl-filter="${esc(d.ro)}">Fokuskan dashboard ke ${esc(d.name)}</button>
  </article>`;
}

function smoothPath(pts) {
  if (pts.length < 2) return '';
  let dPath = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    dPath += ` C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return dPath;
}

function trendCard(d) {
  const p = d.now;
  const b = d.before;
  const n = Math.max(daysInMonth(d.c.cur), b?.month ? daysInMonth(b.month) : 0);
  const pick = (rows, field) => (rows || []).map((r) => [dayOf(r.tanggal), r[field]]).filter(([, v]) => ok(v));
  const cur = pick(p.days, 'os');
  const prev = pick(b?.days, 'os');
  const rka = pick(p.days, 'rka_os');
  const all = [...cur, ...prev, ...rka].map(([, v]) => v);
  if (cur.length < 2 || !all.length) return `<article class="atl-card atl-trend" style="--i:1"><header><h3>Outstanding harian</h3></header><p class="atl-empty">Belum cukup data harian</p></article>`;
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const padV = (hi - lo) * 0.12 || hi * 0.01 || 1;
  const y0 = lo - padV;
  const y1 = hi + padV;
  const X = (day) => ((day - 1) / Math.max(1, n - 1)) * 100;
  const Y = (v) => 100 - ((v - y0) / (y1 - y0)) * 100;
  const pts = (list) => list.map(([day, v]) => [X(day), Y(v)]);
  const curPts = pts(cur);
  const area = `${smoothPath(curPts)} L${curPts.at(-1)[0].toFixed(2)},100 L${curPts[0][0].toFixed(2)},100 Z`;
  const ticks = [y0 + (y1 - y0) * 0.15, (y0 + y1) / 2, y1 - (y1 - y0) * 0.15];
  const last = cur.at(-1);
  const prevLast = prev.length ? prev.at(-1) : null;
  const xDays = [1, Math.round(n / 3), Math.round((2 * n) / 3), n];
  const gid = `atl-g-${Math.random().toString(36).slice(2, 8)}`;
  return `<article class="atl-card atl-trend" style="--i:1" aria-label="Outstanding harian ${esc(d.name)}">
    <header><h3>Outstanding harian</h3>
      <p class="atl-key"><span><i class="ln cur"></i>${esc(fmt.month(d.c.cur, true))}</span>${prev.length ? `<span><i class="ln prev"></i>${esc(fmt.month(b.month, true))}</span>` : ''}${rka.length ? '<span><i class="dash"></i>RKA</span>' : ''}</p></header>
    <div class="atl-plot">
      ${ticks.map((v) => `<span class="atl-y" style="--y:${(Y(v) / 100).toFixed(4)}">${esc(fmt.rupiah(v * 1e9, y1 - y0 < 150 ? 2 : 1))}</span>`).join('')}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#307FE2" stop-opacity=".32"/><stop offset="1" stop-color="#307FE2" stop-opacity="0"/></linearGradient></defs>
        ${ticks.map((v) => `<line class="grid" x1="0" x2="100" y1="${Y(v).toFixed(2)}" y2="${Y(v).toFixed(2)}"/>`).join('')}
        ${rka.length > 1 ? `<path class="rka" d="${smoothPath(pts(rka))}"/>` : ''}
        ${prev.length > 1 ? `<path class="prev" d="${smoothPath(pts(prev))}"/>` : ''}
        <path class="area" d="${area}" fill="url(#${gid})"/>
        <path class="cur" d="${smoothPath(curPts)}"/>
      </svg>
      <span class="atl-dot" style="--x:${(X(last[0]) / 100).toFixed(4)};--y:${(Y(last[1]) / 100).toFixed(4)}"></span>
      <span class="atl-end cur" style="--x:${(X(last[0]) / 100).toFixed(4)};--y:${(Y(last[1]) / 100).toFixed(4)}">${esc(tn(last[1]))}</span>
      ${prevLast ? `<span class="atl-end prev" style="--x:${(X(prevLast[0]) / 100).toFixed(4)};--y:${(Y(prevLast[1]) / 100).toFixed(4)}">${esc(tn(prevLast[1]))}</span>` : ''}
      <div class="atl-xaxis">${xDays.map((x) => `<span style="--x:${(X(x) / 100).toFixed(4)}">${esc(x)}</span>`).join('')}</div>
    </div>
  </article>`;
}

function ring(label, value, cap, amount, change, extra) {
  const state = ok(value) && ok(cap) ? (value > cap ? 'bad' : 'good') : 'none';
  const used = ok(value) && ok(cap) && cap > 0 ? Math.min(1, value / cap) : 0;
  return `<div class="atl-ring ${state}">
    <div class="dial" style="--p:${used.toFixed(4)}" role="img" aria-label="${esc(`${label} ${pct(value)}, RKA ${pct(cap)}`)}"><b>${esc(pct(value))}</b><small>RKA ${esc(pct(cap))}</small></div>
    <h4>${esc(label)}</h4>
    <p class="${state}">${state === 'bad' ? 'di atas RKA' : state === 'good' ? 'di bawah RKA' : '–'}</p>
    <small>${esc(tn(amount))}, <span class="${trendTone(change, false)}">${esc(points(change))}</span></small>
    ${extra}
  </div>`;
}

function qualityCard(d) {
  const p = d.now;
  const b = d.before || {};
  const s = d.split;
  const fi = (key) => (s && (ok(s[key].fi) || ok(s[key].nfi)) ? `<p class="atl-fi"><span>FI ${esc(pct(s[key].fi))}</span><span>NFI ${esc(pct(s[key].nfi))}</span></p>` : '');
  return `<article class="atl-card atl-quality" style="--i:2" aria-label="Kualitas kredit ${esc(d.name)}">
    <header><h3>Kualitas kredit</h3><p class="atl-note">Lingkaran = terpakai dari batas RKA</p></header>
    <div class="atl-rings">
      ${ring('NPL', p.nplPct, p.rkaNplPct, p.npl, diff(p.nplPct, b.nplPct), fi('nplPct'))}
      ${ring('SML', p.smlPct, p.rkaSmlPct, p.sml, diff(p.smlPct, b.smlPct), fi('smlPct'))}
    </div>
    ${d.nplRank ? `<p class="atl-foot">%NPL urutan ${esc(d.nplRank)} tertinggi dari ${esc(d.total)} RO</p>` : ''}
  </article>`;
}

function realCard(d) {
  const r = d.real;
  const s = d.sla;
  const head = r ? `<div class="atl-big small"><span>Realisasi ${esc(r.full ? fmt.month(r.month, true) : `${short(r.month)} s.d. ${r.lastDay}`)}</span>
      <b>${esc(realRp(r.total))}</b></div>
      <p class="atl-d"><b class="${trendTone(r.change)}">${esc(ok(r.change) ? fmt.signedPct(r.change, 0) : '–')}</b> dari ${esc(short(shiftMonth(r.month, -1)))}${r.full ? '' : ` s.d. tgl ${esc(r.lastDay)}`}</p>` : '<p class="atl-empty">Belum ada data realisasi</p>';
  const rows = r ? r.rows.filter((x) => x.value > 0).slice(0, 4) : [];
  const max = Math.max(1, ...rows.map((x) => x.value));
  const bars = rows.length ? `<ol class="atl-bars">${rows.map((x, i) => `<li style="--w:${(x.value / max).toFixed(4)};--j:${i}">
      <span class="nm">${esc(x.tipe || 'Lainnya')}</span><span class="bar"><i></i></span><b>${esc(realRp(x.value))}</b></li>`).join('')}</ol>` : '';
  const sla = s?.hasRows ? `<div class="atl-chips">
      <span><small>Berjalan</small><b>${esc(fmt.num(s.berkas))}</b></span>
      <span class="${s.late ? 'bad' : ''}"><small>Lewat SLA</small><b>${esc(fmt.num(s.late))}</b></span>
      <span class="${tone(s.onTime)}"><small>Tepat SLA</small><b>${esc(pct(s.onTime, 0))}</b></span></div>` : '';
  return `<article class="atl-card atl-real" style="--i:3" aria-label="Realisasi dan berkas ${esc(d.name)}">
    <header><h3>Realisasi dan berkas</h3>${r ? `<p class="atl-note">${esc(r.rows.length)} sumber</p>` : ''}</header>
    ${head}${bars}${sla}
  </article>`;
}

export function showcaseHtml(d) {
  return `<div class="atl-show" data-ro="${esc(d.ro)}">${heroCard(d)}${trendCard(d)}${qualityCard(d)}${realCard(d)}</div>`;
}

export function regionSpeech(d) {
  const p = d.now;
  const parts = [`Ini kondisi ${d.name}.`];
  if (ok(p.os)) parts.push(`Outstanding ${tn(p.os)}, ${pct(p.achOs, 1)} dari RKA.`);
  if (ok(p.nplPct)) parts.push(`NPL ${pct(p.nplPct)}, ${ok(p.rkaNplPct) && p.nplPct > p.rkaNplPct ? 'di atas' : 'di bawah'} RKA.`);
  if (d.real) parts.push(`Realisasi bulan ini ${realRp(d.real.total)}.`);
  if (d.sla?.late) parts.push(`${d.sla.late} berkas lewat SLA.`);
  return parts.join(' ');
}

export function flyIn(stage, from) {
  const cards = [...stage.querySelectorAll('.atl-card')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!from || reduce) { cards.forEach((el) => el.classList.add('in')); return; }
  const o = from.getBoundingClientRect();
  const ox = o.left + o.width / 2;
  const oy = o.top + o.height / 2;
  for (const el of cards) {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--fx', `${(ox - (r.left + r.width / 2)).toFixed(1)}px`);
    el.style.setProperty('--fy', `${(oy - (r.top + r.height / 2)).toFixed(1)}px`);
  }
  requestAnimationFrame(() => cards.forEach((el) => el.classList.add('in')));
}

