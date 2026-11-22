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
    ro, name: ro ? roShort(ro) : 'Nasional', code: ro ? /^(Region\s*\d+)/i.exec(ro)?.[1] || '' : `${standing.length} RO`, c, now, before, history,
    reached: standing.filter((x) => x.achOs >= 1).length,
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
      ${d.ro ? `<div><dt>Peringkat capaian OS</dt><dd>${d.rank ? `${esc(d.rank)}<small> dari ${esc(d.total)}</small>` : '–'}</dd></div>`
        : `<div><dt>RO capai RKA OS</dt><dd>${esc(d.reached)}<small> dari ${esc(d.total)}</small></dd></div>`}
    </dl>
    ${d.ro ? `<button class="btn" type="button" data-va-filter="${esc(d.ro)}">Fokuskan dashboard ke ${esc(d.name)}</button>` : ''}
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
    ${d.ro && d.nplRank ? `<p class="va-foot">%NPL urutan ${esc(d.nplRank)} tertinggi dari ${esc(d.total)} RO</p>` : ''}
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

export function toneOf(d) {
  const p = d.now || {};
  const osGood = ok(p.achOs) ? p.achOs >= 0.995 : null;
  const nplGood = ok(p.nplPct) && ok(p.rkaNplPct) ? p.nplPct <= p.rkaNplPct : null;
  if (osGood === null && nplGood === null) return 'mixed';
  if (osGood !== false && nplGood !== false) return 'good';
  if (osGood === false && nplGood === false) return 'bad';
  if (osGood === false && ok(p.achOs) && p.achOs < 0.95) return 'bad';
  return 'mixed';
}

export function regionMore(d) {
  const p = d.now || {};
  const out = [];
  if (d.ro && d.rank) out.push(`${d.name} ada di peringkat ${d.rank} dari ${d.total} RO untuk capaian outstanding.`);
  if (!d.ro && d.total) out.push(`${d.reached} dari ${d.total} RO sudah mencapai RKA outstanding.`);
  if (d.ro && d.nplRank) out.push(`Untuk NPL, ${d.name} di urutan ${d.nplRank} tertinggi.`);
  if (ok(p.nplPct) && ok(d.before?.nplPct)) {
    const ch = p.nplPct - d.before.nplPct;
    if (Math.abs(ch) >= 0.0005) out.push(`NPL ${ch > 0 ? 'naik' : 'turun'} ${fmt.num(Math.abs(ch) * 100, 2)} poin dibanding akhir bulan lalu.`);
  }
  if (ok(p.os) && ok(d.before?.os)) {
    const g = p.os - d.before.os;
    out.push(`Outstanding ${g >= 0 ? 'tumbuh' : 'turun'} ${tn(Math.abs(g))} sejak akhir bulan lalu.`);
  }
  if (ok(p.achDisb)) out.push(`Disburse bulan ini ${pct(p.achDisb, 0)} dari guidance.`);
  return out;
}

export function regionTalk(d, lead = '', insight = '') {
  const p = d.now;
  const n = d.name;
  const parts = [lead || pickOne([`Ini kondisi ${n}.`, `Baik, ini gambaran ${n}.`, `Siap, ini ${n}.`])];
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
  if (insight) parts.push(insight);
  if (!d.ro) {
    const offerN = { say: 'Mana yang perlu perhatian?', ask: 'Mau saya sebutkan RO yang perlu perhatian?' };
    parts.push(offerN.ask);
    return { text: parts.join(' '), offer: offerN, next: ['Mana yang perlu perhatian?', 'Tampilkan RO terburuk', 'Buka realisasi'] };
  }
  const offer = nplOver ? { say: `Detail NPL ${n}`, ask: `Mau saya bukakan detail NPL ${n}?` }
    : ok(p.achOs) && p.achOs < 0.995 ? { say: `Detail outstanding ${n}`, ask: 'Mau lihat detail outstanding-nya?' }
    : d.sla?.late ? { say: `Detail SLA ${n}`, ask: 'Mau lihat berkas yang lewat SLA?' }
    : { say: `Fokus ke ${n}`, ask: `Mau saya fokuskan dashboard ke ${n}?` };
  parts.push(offer.ask);
  const rose = ok(p.nplPct) && ok(d.before?.nplPct) && p.nplPct > d.before.nplPct;
  const next = [...new Set([offer.say, rose ? `Kenapa NPL ${n} naik?` : `NPL ${n} berapa?`, `Realisasi ${n} per sumber`, `Fokus ke ${n}`])].slice(0, 3);
  return { text: parts.join(' '), offer, next };
}

const COMPARE = [
  { key: 'os', label: 'Outstanding', get: (d) => d.now.os, show: (v) => tn(v), good: 'high' },
  { key: 'os', label: 'Capaian RKA OS', get: (d) => d.now.achOs, show: (v) => pct(v, 1), good: 'high' },
  { key: 'deb', label: 'Debitur', get: (d) => d.now.deb, show: (v) => fmt.num(v), good: 'high' },
  { key: 'npl', label: '%NPL', get: (d) => d.now.nplPct, show: (v) => pct(v), good: 'low' },
  { key: 'sml', label: '%SML', get: (d) => d.now.smlPct, show: (v) => pct(v), good: 'low' },
  { key: 'disb', label: 'Disburse bulan ini', get: (d) => d.now.disb, show: (v) => tn(v), good: 'high' },
  { key: 'disb', label: 'Capaian guidance', get: (d) => d.now.achDisb, show: (v) => pct(v, 1), good: 'high' },
  { key: 'real', label: 'Realisasi bulan ini', get: (d) => d.real?.total, show: (v) => realRp(v), good: 'high' },
  { key: 'sla', label: 'Berkas lewat SLA', get: (d) => d.sla?.late, show: (v) => fmt.num(v), good: 'low' },
];

function winnerOf(row, a, b) {
  const x = row.get(a);
  const y = row.get(b);
  if (!ok(x) || !ok(y) || x === y) return 0;
  return (row.good === 'high' ? x > y : x < y) ? -1 : 1;
}

export function compareHtml(a, b, focus = '') {
  const rows = COMPARE.map((row) => {
    const x = row.get(a);
    const y = row.get(b);
    const max = Math.max(Math.abs(x || 0), Math.abs(y || 0)) || 1;
    const w = winnerOf(row, a, b);
    return `<li class="${focus && row.key === focus ? 'focus' : ''}">
      <b class="${w < 0 ? 'win' : ''}">${esc(ok(x) ? row.show(x) : '–')}</b>
      <span class="bar a"><i style="--w:${ok(x) ? (Math.abs(x) / max).toFixed(4) : 0}"></i></span>
      <span class="lbl">${esc(row.label)}${row.good === 'low' ? '<small>makin kecil makin baik</small>' : ''}</span>
      <span class="bar b"><i style="--w:${ok(y) ? (Math.abs(y) / max).toFixed(4) : 0}"></i></span>
      <b class="${w > 0 ? 'win' : ''}">${esc(ok(y) ? row.show(y) : '–')}</b></li>`;
  }).join('');
  const wins = COMPARE.reduce((acc, row) => { const w = winnerOf(row, a, b); if (w < 0) acc[0] += 1; if (w > 0) acc[1] += 1; return acc; }, [0, 0]);
  const better = (sign) => COMPARE.filter((row) => winnerOf(row, a, b) === sign).map((row) => row.label);
  const side = (d, cls, i, n, list) => `<article class="va-card va-side ${cls}" style="--i:${i}" data-va-pick="${esc(d.ro)}">
    <p class="va-code">${esc(d.code || 'Regional')}</p><h2>${esc(d.name)}</h2>
    <p class="va-wins"><b>${esc(n)}</b> dari ${esc(COMPARE.length)} ukuran lebih baik</p>
    <div class="va-big small"><span>Outstanding</span><b>${esc(tn(d.now.os))}</b></div>
    ${status(tone(d.now.achOs), `<b>${esc(pct(d.now.achOs, 1))}</b> dari RKA`)}
    ${list.length ? `<div class="va-winlist"><span>Lebih baik di</span><ul>${list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
  </article>`;
  return `<div class="va-compare">${side(a, 'a', 0, wins[0], better(-1))}
    <article class="va-card va-vs" style="--i:1" aria-label="Perbandingan ${esc(a.name)} dan ${esc(b.name)}">
      <header><h3><span class="ka">${esc(a.name)}</span> vs <span class="kb">${esc(b.name)}</span></h3><p class="va-note">Tebal = lebih baik</p></header>
      <ol class="va-duel">${rows}</ol>
    </article>${side(b, 'b', 2, wins[1], better(1))}</div>`;
}

export function compareTalk(a, b, focus = '') {
  const lines = [];
  const rowsFor = focus ? COMPARE.filter((r) => r.key === focus) : [];
  if (rowsFor.length) {
    const row = rowsFor[0];
    const x = row.get(a);
    const y = row.get(b);
    const w = winnerOf(row, a, b);
    lines.push(`${row.label} ${a.name} ${ok(x) ? row.show(x) : 'belum ada'}, ${b.name} ${ok(y) ? row.show(y) : 'belum ada'}.`);
    if (w) lines.push(`${w < 0 ? a.name : b.name} lebih baik.`);
  } else {
    const winA = COMPARE.filter((r) => winnerOf(r, a, b) < 0).map((r) => r.label);
    const winB = COMPARE.filter((r) => winnerOf(r, a, b) > 0).map((r) => r.label);
    const lead = winA.length === winB.length ? `${a.name} dan ${b.name} seimbang.` : `${winA.length > winB.length ? a.name : b.name} unggul di ${Math.max(winA.length, winB.length)} dari ${COMPARE.length} ukuran.`;
    lines.push(lead);
    const other = winA.length > winB.length ? [b.name, winB] : [a.name, winA];
    if (other[1].length) lines.push(`${other[0]} lebih baik di ${other[1].slice(0, 3).join(', ')}.`);
  }
  return lines.join(' ');
}

const MINI_ICON = {
  chart: '<path d="M5 19V10M10 19V5M15 19v-7M20 19V8"/>',
  line: '<path d="M3 17l5-6 4 3 6-8 3 3"/>',
  ring: '<circle cx="12" cy="12" r="7"/><path d="M12 5a7 7 0 0 1 7 7"/>',
  bars: '<path d="M4 7h10M4 12h16M4 17h7"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-4 4-5.5 7-5.5s5.8 1.5 7 5.5"/>',
  vs: '<path d="M4 6l4 12 4-12M20 7c-1.5-1.5-6-1.5-6 1.5S20 10 20 14s-5 3-6.5 1.5"/>',
  chat: '<path d="M5 6h14v9H10l-4 3v-3H5z"/><path d="M9 10.5h6"/>',
};
const MINI_KIND = [['va-hero', 'chart', 'a'], ['va-trend', 'line', 'b'], ['va-quality', 'ring', 'c'], ['va-real', 'bars', 'd'], ['va-side', 'user', 'b'], ['va-vs', 'vs', 'c'], ['va-answer', 'chat', 'a']];
const SPOTS = [[-0.3, -0.24], [0.27, -0.3], [-0.12, 0.08], [0.33, 0.12], [-0.36, 0.3], [0.1, 0.34], [0.02, -0.36]];
const GHOSTS = [[-0.42, -0.04, 'd'], [0.42, -0.12, 'a'], [0.2, 0.42, 'c'], [-0.22, -0.4, 'b']];

const miniHtml = (icon, tint) => `<span class="va-tile" aria-hidden="true"><span class="va-tile-ic t-${tint}"><svg viewBox="0 0 24 24">${MINI_ICON[icon]}</svg></span><span class="va-tile-tx"><b></b><b></b><b></b></span></span>`;

export function flyIn(stage, from) {
  const cards = [...stage.querySelectorAll('.va-card')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!from || reduce || !cards.length) { cards.forEach((el) => el.classList.add('in')); return; }
  const o = from.getBoundingClientRect();
  const sr = stage.getBoundingClientRect();
  const ox = o.left + o.width / 2;
  const oy = o.top + o.height / 2;
  const cx = sr.left + sr.width / 2;
  const cy = sr.top + sr.height / 2;
  const single = cards.length === 1;
  const jitter = () => (Math.random() - 0.5) * 24;
  stage.classList.add('is-swarm');
  cards.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const kind = MINI_KIND.find(([cls]) => el.classList.contains(cls)) || ['', 'chat', 'a'];
    el.insertAdjacentHTML('afterbegin', miniHtml(kind[1], kind[2]));
    const [fx, fy] = single ? [0, -0.06] : SPOTS[i % SPOTS.length];
    const ex = r.left + r.width / 2;
    const ey = r.top + r.height / 2;
    const scale = Math.min(0.55, Math.max(0.1, (single ? 170 : 132) / Math.max(1, r.width)));
    el.style.setProperty('--ox', `${(ox - ex).toFixed(1)}px`);
    el.style.setProperty('--oy', `${(oy - ey).toFixed(1)}px`);
    el.style.setProperty('--mx', `${(cx + fx * sr.width + jitter() - ex).toFixed(1)}px`);
    el.style.setProperty('--my', `${(cy + fy * sr.height + jitter() - ey).toFixed(1)}px`);
    el.style.setProperty('--ms', scale.toFixed(3));
    el.style.setProperty('--mr', `${((Math.random() - 0.5) * 8).toFixed(1)}deg`);
    if (single) el.style.setProperty('--i', '0');
  });
  const layer = document.createElement('div');
  layer.className = 'va-ghosts';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = GHOSTS.slice(0, single ? 3 : 4).map(([fx, fy, t], i) => `<span class="va-ghost" style="--gx:${(fx * sr.width).toFixed(0)}px;--gy:${(fy * sr.height).toFixed(0)}px;--gox:${(ox - cx - fx * sr.width).toFixed(0)}px;--goy:${(oy - cy - fy * sr.height).toFixed(0)}px;--i:${i}">${miniHtml(['bars', 'chat', 'ring', 'user'][i], t)}</span>`).join('');
  stage.append(layer);
  requestAnimationFrame(() => cards.forEach((el) => el.classList.add('in', 'swarm')));
  const last = cards.at(-1);
  const done = () => {
    stage.classList.remove('is-swarm');
    layer.remove();
    cards.forEach((el) => el.querySelector(':scope > .va-tile')?.remove());
  };
  const timer = setTimeout(done, 2600);
  last.addEventListener('animationend', (e) => { if (e.target === last && e.animationName === 'va-swarm') { clearTimeout(timer); done(); } });
}

