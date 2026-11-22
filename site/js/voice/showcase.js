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

const status = (state, html) => `<p class="va-t ${state}"><i aria-hidden="true"></i>${html}</p>`;

function meter(value, ref, state) {
  if (!ok(value) || !ok(ref) || ref <= 0) return '';
  const span = 1.25;
  const fill = Math.max(0, Math.min(span, value / ref)) / span;
  return `<span class="va-meter ${state}" aria-hidden="true"><i style="--w:${fill.toFixed(4)}"></i><b style="--at:${(1 / span).toFixed(4)}"></b></span>`;
}

function osBars(list) {
  const grow = list.slice(1).map((x, i) => ({ month: x.month, v: x.os - list[i].os }));
  if (grow.length < 3) return '<span></span>';
  const max = Math.max(...grow.map((g) => Math.abs(g.v))) || 1;
  const label = (v) => `${v >= 0 ? '+' : '−'}${fmt.rupiah(Math.abs(v) * 1e9, 0)}`;
  return `<figure class="va-hist"><figcaption>Tumbuh OS per bulan</figcaption><ol>${grow.map((g, i) => `<li class="${i === grow.length - 1 ? 'now' : ''}${g.v < 0 ? ' neg' : ''}" style="--h:${(Math.abs(g.v) / max).toFixed(4)};--j:${i}">
    <b>${esc(label(g.v))}</b><span></span><small>${esc(short(g.month))}</small></li>`).join('')}</ol></figure>`;
}

function heroCard(d) {
  const p = d.now;
  const prevMonth = short(d.before?.month);
  const grow = diff(p.os, d.before?.os);
  return `<article class="va-card va-hero" style="--i:0" data-va-open="os" aria-label="Ringkasan ${esc(d.name)}">
    <header><p class="va-code">${esc(d.code || 'Regional')}</p><h2>${esc(d.name)}</h2><p class="va-date">Posisi ${esc(fmt.date(p.date))}</p></header>
    <div class="va-big"><span>Outstanding</span><b>${esc(tn(p.os).replace(/\s?T$/, ''))}<small>T</small></b></div>
    ${meter(p.os, p.rkaOs, tone(p.achOs))}
    ${status(tone(p.achOs), `<b>${esc(pct(p.achOs, 1))}</b> dari RKA ${esc(tn(p.rkaOs))}`)}
    ${ok(grow) ? `<p class="va-d"><b class="${trendTone(grow)}">${grow >= 0 ? '▲' : '▼'} ${esc(signedTn(grow).replace(/^[+−]/, ''))}</b> dari akhir ${esc(prevMonth)}</p>` : ''}
    ${osBars(d.history)}
    <dl class="va-mini">
      <div><dt>Debitur</dt><dd>${esc(fmt.num(p.deb))}</dd></div>
      <div><dt>Disburse bulan ini</dt><dd>${esc(tn(p.disb))}</dd></div>
      <div><dt>Peringkat capaian OS</dt><dd>${d.rank ? `${esc(d.rank)}<small> dari ${esc(d.total)}</small>` : '–'}</dd></div>
    </dl>
    <button class="btn" type="button" data-va-filter="${esc(d.ro)}">Fokuskan dashboard ke ${esc(d.name)}</button>
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
  if (cur.length < 2 || !all.length) return `<article class="va-card va-trend" style="--i:1"><header><h3>Outstanding harian</h3></header><p class="va-empty">Belum cukup data harian</p></article>`;
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
  const gid = `va-g-${Math.random().toString(36).slice(2, 8)}`;
  return `<article class="va-card va-trend" style="--i:1" data-va-open="os" aria-label="Outstanding harian ${esc(d.name)}">
    <header><h3>Outstanding harian</h3>
      <p class="va-key"><span><i class="ln cur"></i>${esc(fmt.month(d.c.cur, true))}</span>${prev.length ? `<span><i class="ln prev"></i>${esc(fmt.month(b.month, true))}</span>` : ''}${rka.length ? '<span><i class="dash"></i>RKA</span>' : ''}</p></header>
    <div class="va-plot">
      ${ticks.map((v) => `<span class="va-y" style="--y:${(Y(v) / 100).toFixed(4)}">${esc(fmt.rupiah(v * 1e9, y1 - y0 < 150 ? 2 : 1))}</span>`).join('')}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#307FE2" stop-opacity=".32"/><stop offset="1" stop-color="#307FE2" stop-opacity="0"/></linearGradient></defs>
        ${ticks.map((v) => `<line class="grid" x1="0" x2="100" y1="${Y(v).toFixed(2)}" y2="${Y(v).toFixed(2)}"/>`).join('')}
        ${rka.length > 1 ? `<path class="rka" d="${smoothPath(pts(rka))}"/>` : ''}
        ${prev.length > 1 ? `<path class="prev" d="${smoothPath(pts(prev))}"/>` : ''}
        <path class="area" d="${area}" fill="url(#${gid})"/>
        <path class="cur" d="${smoothPath(curPts)}"/>
      </svg>
      <span class="va-wipe" aria-hidden="true"></span>
      <span class="va-dot" style="--x:${(X(last[0]) / 100).toFixed(4)};--y:${(Y(last[1]) / 100).toFixed(4)}"></span>
      <span class="va-end cur" style="--x:${(X(last[0]) / 100).toFixed(4)};--y:${(Y(last[1]) / 100).toFixed(4)}">${esc(tn(last[1]))}</span>
      ${prevLast ? `<span class="va-end prev" style="--x:${(X(prevLast[0]) / 100).toFixed(4)};--y:${(Y(prevLast[1]) / 100).toFixed(4)}">${esc(tn(prevLast[1]))}</span>` : ''}
      <div class="va-xaxis">${xDays.map((x) => `<span style="--x:${(X(x) / 100).toFixed(4)}">${esc(x)}</span>`).join('')}</div>
    </div>
  </article>`;
}

function ring(label, value, cap, amount, change, extra) {
  const state = ok(value) && ok(cap) ? (value > cap ? 'bad' : 'good') : 'none';
  const used = ok(value) && ok(cap) && cap > 0 ? Math.min(1, value / cap) : 0;
  return `<div class="va-ring ${state}">
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
  const fi = (key) => (s && (ok(s[key].fi) || ok(s[key].nfi)) ? `<p class="va-fi"><span>FI ${esc(pct(s[key].fi))}</span><span>NFI ${esc(pct(s[key].nfi))}</span></p>` : '');
  return `<article class="va-card va-quality" style="--i:2" data-va-open="npl" aria-label="Kualitas kredit ${esc(d.name)}">
    <header><h3>Kualitas kredit</h3><p class="va-note">Lingkaran = terpakai dari batas RKA</p></header>
    <div class="va-rings">
      ${ring('NPL', p.nplPct, p.rkaNplPct, p.npl, diff(p.nplPct, b.nplPct), fi('nplPct'))}
      ${ring('SML', p.smlPct, p.rkaSmlPct, p.sml, diff(p.smlPct, b.smlPct), fi('smlPct'))}
    </div>
    ${d.nplRank ? `<p class="va-foot">%NPL urutan ${esc(d.nplRank)} tertinggi dari ${esc(d.total)} RO</p>` : ''}
  </article>`;
}

function realCard(d) {
  const r = d.real;
  const s = d.sla;
  const head = r ? `<div class="va-big small"><span>Realisasi ${esc(r.full ? fmt.month(r.month, true) : `${short(r.month)} s.d. ${r.lastDay}`)}</span>
      <b>${esc(realRp(r.total))}</b></div>
      <p class="va-d"><b class="${trendTone(r.change)}">${esc(ok(r.change) ? fmt.signedPct(r.change, 0) : '–')}</b> dari ${esc(short(shiftMonth(r.month, -1)))}${r.full ? '' : ` s.d. tgl ${esc(r.lastDay)}`}</p>` : '<p class="va-empty">Belum ada data realisasi</p>';
  const rows = r ? r.rows.filter((x) => x.value > 0).slice(0, 4) : [];
  const max = Math.max(1, ...rows.map((x) => x.value));
  const bars = rows.length ? `<ol class="va-bars">${rows.map((x, i) => `<li style="--w:${(x.value / max).toFixed(4)};--j:${i}">
      <span class="nm">${esc(x.tipe || 'Lainnya')}</span><span class="bar"><i></i></span><b>${esc(realRp(x.value))}</b></li>`).join('')}</ol>` : '';
  const sla = s?.hasRows ? `<div class="va-chips">
      <span><small>Berjalan</small><b>${esc(fmt.num(s.berkas))}</b></span>
      <span class="${s.late ? 'bad' : ''}"><small>Lewat SLA</small><b>${esc(fmt.num(s.late))}</b></span>
      <span class="${tone(s.onTime)}"><small>Tepat SLA</small><b>${esc(pct(s.onTime, 0))}</b></span></div>` : '';
  return `<article class="va-card va-real" style="--i:3" data-va-open="real" aria-label="Realisasi dan berkas ${esc(d.name)}">
    <header><h3>Realisasi dan berkas</h3>${r ? `<p class="va-note">${esc(r.rows.length)} sumber</p>` : ''}</header>
    ${head}${bars}${sla}
  </article>`;
}

export function showcaseHtml(d) {
  return `<div class="va-show" data-ro="${esc(d.ro)}">${heroCard(d)}${trendCard(d)}${qualityCard(d)}${realCard(d)}</div>`;
}

const pickOne = (list) => list[Math.floor(Math.random() * list.length)];

export function regionTalk(d) {
  const p = d.now;
  const n = d.name;
  const parts = [pickOne([`Ini kondisi ${n}.`, `Baik, ini gambaran ${n}.`, `Siap, ini ${n}.`])];
  if (ok(p.os)) {
    parts.push(ok(p.achOs) && p.achOs >= 1
      ? `Outstanding ${tn(p.os)}, sudah melewati RKA.`
      : `Outstanding ${tn(p.os)}, ${pct(p.achOs, 1)} dari RKA.`);
  }
  const nplOver = ok(p.nplPct) && ok(p.rkaNplPct) && p.nplPct > p.rkaNplPct;
  if (ok(p.nplPct)) {
    const gap = ok(p.rkaNplPct) ? Math.abs(p.nplPct - p.rkaNplPct) : 1;
    parts.push(`NPL ${pct(p.nplPct)}, ${nplOver ? (gap < 0.001 ? 'tipis di atas' : 'di atas') : 'masih di bawah'} RKA.`);
  }
  if (d.real) {
    const ch = d.real.change;
    parts.push(`Realisasi bulan ini ${realRp(d.real.total)}${ok(ch) && Math.round(ch * 100) ? `, ${ch > 0 ? 'naik' : 'turun'} ${pct(Math.abs(ch), 0)} dari bulan lalu` : ''}.`);
  }
  if (d.sla?.late) parts.push(`Ada ${d.sla.late} berkas lewat SLA.`);
  const offer = nplOver ? { say: `Detail NPL ${n}`, ask: `Mau saya bukakan detail NPL ${n}?` }
    : ok(p.achOs) && p.achOs < 0.995 ? { say: `Detail outstanding ${n}`, ask: 'Mau lihat detail outstanding-nya?' }
    : d.sla?.late ? { say: `Detail SLA ${n}`, ask: 'Mau lihat berkas yang lewat SLA?' }
    : { say: `Fokus ke ${n}`, ask: `Mau saya fokuskan dashboard ke ${n}?` };
  parts.push(offer.ask);
  const rose = ok(p.nplPct) && ok(d.before?.nplPct) && p.nplPct > d.before.nplPct;
  const next = [...new Set([offer.say, rose ? `Kenapa NPL ${n} naik?` : `NPL ${n} berapa?`, `Realisasi ${n} per sumber`, `Fokus ke ${n}`])].slice(0, 3);
  return { text: parts.join(' '), offer, next };
}

export function flyIn(stage, from) {
  const cards = [...stage.querySelectorAll('.va-card')];
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

