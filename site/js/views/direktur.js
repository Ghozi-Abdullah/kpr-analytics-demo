import { esc, fmt } from '../core/format.js';
import { ok, ratio } from '../core/values.js';
import { pick, enhancePicks, seg, onSeg } from '../core/controls.js';
import { shiftMonth } from '../core/dates.js';
import { sparkline } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { loadTable } from '../services/data-source.js';
import { loadReal, loadPf, loadSla } from '../services/datasets.js';
import { indexPerf, NASIONAL, dayOf } from '../models/performance-model.js';
import { sumberMode } from '../models/realisasi-sumber.js';
import { periodsOf, perfPeriods, realCompare, pfSplit, slaNow, roStanding } from '../models/direktur-model.js';
import { tn, realRp, pfRp, pct, short, roShort, tone, diff } from './direktur-format.js';
import { openScDetail, refreshScDetail, closeScDetail } from './direktur-detail.js';
import { createAssistant, launchHtml } from '../voice/assistant.js';
import { WAKE_NAME } from '../voice/command.js';

const soft = (p) => p.catch((err) => { console.warn(err); return null; });

const split = (v) => {
  const [n, u = ''] = String(v).split(' ');
  return { n, u };
};

function change(v, { text, good, ref }) {
  if (!ok(v)) return '<p class="sc-d">–</p>';
  const dir = v > 0 ? '▲' : v < 0 ? '▼' : '■';
  const state = v === 0 ? 'none' : (v > 0) === good ? 'good' : 'bad';
  return `<p class="sc-d"><b class="${state}">${dir} ${esc(text)}</b><span>${esc(ref)}</span></p>`;
}

function meter(value, ref, state, refName = 'RKA') {
  if (!ok(value) || !ok(ref) || ref <= 0) return '<span class="sc-m none" aria-hidden="true"></span>';
  const span = 1.25;
  const fill = Math.max(0, Math.min(span, value / ref)) / span;
  return `<span class="sc-m ${state}" aria-hidden="true" title="Garis putih = ${refName}"><i style="width:${(fill * 100).toFixed(1)}%"></i><b style="left:${(100 / span).toFixed(1)}%"></b></span>`;
}

function trendOf(values, month) {
  if (values.filter(ok).length < 2) return '';
  return `<figure class="sc-spark">${sparkline(values, { w: 120, h: 32, color: '#FFFFFF' })}<figcaption>harian ${esc(short(month))}</figcaption></figure>`;
}

const more = (id, label) => `<button type="button" class="sc-more" data-open="${id}" aria-label="Detail ${esc(label)}" title="Lihat detail">${icon('open', 13)}</button>`;

function kpi({ id, label, value, target, delta, bar, trend = '', wide = false }) {
  const v = split(value);
  return `<section class="sc-kpi${wide ? ' wide' : ''}" data-detail="${id}" aria-labelledby="sc-k-${id}">
    <div class="sc-kh"><h2 id="sc-k-${id}">${esc(label)}</h2>${more(id, label)}</div>
    <div class="sc-vr"><p class="sc-v">${esc(v.n)}${v.u ? `<small>${esc(v.u)}</small>` : ''}</p>${trend}</div>
    ${bar}
    <p class="sc-t ${target.state}"><i aria-hidden="true"></i>${target.html}</p>
    ${delta}
  </section>`;
}

function kpis(c) {
  const p = c.now;
  const prev = c.prev || {};
  const pm = short(prev.month);
  const points = (v) => `${fmt.num(Math.abs(v) * 100, 2)} poin`;
  const quality = (val, rka) => {
    if (!ok(val) || !ok(rka)) return { state: 'none', html: 'RKA –' };
    const under = val <= rka;
    return { state: under ? 'good' : 'bad', html: `${under ? 'di bawah' : 'di atas'} RKA <b>${esc(pct(rka))}</b>` };
  };
  const disbPrev = p.end?.disburse_lalu;
  const disbCh = ok(p.disb) && ok(disbPrev) && disbPrev ? p.disb / disbPrev - 1 : null;
  const lastDay = p.date ? dayOf(p.date) : '';
  const days = p.days || [];
  const daily = (fn) => trendOf(days.map(fn), p.month);
  const smlQ = quality(p.smlPct, p.rkaSmlPct);
  const nplQ = quality(p.nplPct, p.rkaNplPct);
  return [
    kpi({ id: 'os', label: 'Outstanding', value: tn(p.os), wide: true,
      trend: daily((r) => r.os), bar: meter(p.os, p.rkaOs, tone(p.achOs)),
      target: { state: tone(p.achOs), html: `<b>${esc(pct(p.achOs, 1))}</b> dari RKA ${esc(tn(p.rkaOs))}` },
      delta: change(diff(p.os, prev.os), { text: tn(Math.abs(diff(p.os, prev.os) ?? 0)), good: true, ref: `dari akhir ${pm}` }) }),
    kpi({ id: 'deb', label: 'Debitur', value: fmt.num(p.deb),
      trend: daily((r) => r.debitur), bar: meter(p.deb, p.rkaDeb, tone(p.achDeb)),
      target: { state: tone(p.achDeb), html: `<b>${esc(pct(p.achDeb, 1))}</b> dari RKA ${esc(fmt.num(p.rkaDeb))}` },
      delta: change(diff(p.deb, prev.deb), { text: fmt.num(Math.abs(diff(p.deb, prev.deb) ?? 0)), good: true, ref: `dari akhir ${pm}` }) }),
    kpi({ id: 'sml', label: 'SML', value: `${pct(p.smlPct).replace('%', '')} %`,
      trend: daily((r) => ratio(r.dpk, r.os)), bar: meter(p.smlPct, p.rkaSmlPct, smlQ.state),
      target: smlQ,
      delta: change(diff(p.smlPct, prev.smlPct), { text: points(diff(p.smlPct, prev.smlPct) ?? 0), good: false, ref: `dari akhir ${pm}` }) }),
    kpi({ id: 'npl', label: 'NPL', value: `${pct(p.nplPct).replace('%', '')} %`,
      trend: daily((r) => ratio(r.npl, r.os)), bar: meter(p.nplPct, p.rkaNplPct, nplQ.state),
      target: nplQ,
      delta: change(diff(p.nplPct, prev.nplPct), { text: points(diff(p.nplPct, prev.nplPct) ?? 0), good: false, ref: `dari akhir ${pm}` }) }),
    kpi({ id: 'disb', label: 'Disburse bulan ini', value: tn(p.disb),
      trend: daily((r) => r.disburse), bar: meter(p.disb, p.prognosa, tone(p.progDisb), 'prognosa'),
      target: { state: tone(p.progDisb), html: `<b>${esc(pct(p.progDisb, 1))}</b> dari prognosa ${esc(tn(p.prognosa))}` },
      delta: change(disbCh, { text: fmt.pct(Math.abs(disbCh ?? 0), 0), good: true, ref: p.full ? `dari total ${pm}` : `dari ${pm} s.d. tgl ${lastDay}` }) }),
  ].join('');
}

function block(id, title, body, aside = '', { detail = true } = {}) {
  return `<section class="sc-sec sc-${id}"${detail ? ` data-detail="${id}"` : ''} aria-labelledby="sc-s-${id}">
    <header><h2 id="sc-s-${id}">${esc(title)}</h2>${aside}${detail ? more(id, title) : ''}</header>${body}</section>`;
}

const table = (head, rows, foot = '') => `<div class="sc-tw"><table class="sc-table">
  <thead><tr>${head.map((h, i) => `<th scope="col"${i ? '' : ' class="l"'}>${esc(h)}</th>`).join('')}</tr></thead>
  <tbody>${rows}</tbody>${foot ? `<tfoot>${foot}</tfoot>` : ''}</table></div>`;

function changeCell(ch) {
  if (!ok(ch)) return '<td class="none">–</td>';
  if (Math.round(ch * 100) === 0) return '<td class="none">0%</td>';
  return `<td class="${ch > 0 ? 'good' : 'bad'}">${esc(fmt.signedPct(ch, 0))}</td>`;
}

function realBlock(c) {
  const r = c.real;
  if (!r) return block('real', 'Realisasi', '<p class="sc-empty">Belum ada data</p>', '', { detail: false });
  const modes = c.realModel.modes || ['7', '5'];
  const toggle = modes.length > 1 ? seg({ name: 'sc-sumber', label: 'Pembagian sumber realisasi', small: true, value: c.sel.sumber, options: modes.map((m) => ({ value: m, label: `${m} sumber` })) }) : '';
  const vsHead = `vs ${short(shiftMonth(r.month, -1))}`;
  const rows = r.rows.map((x) => `<tr><th scope="row" class="l">${esc(x.tipe || 'Lainnya')}</th><td>${esc(realRp(x.value))}</td>
    <td class="m">${esc(pct(r.total ? x.value / r.total : null, 0))}</td>${changeCell(x.change)}</tr>`).join('');
  const foot = `<tr><th scope="row" class="l">Total</th><td>${esc(realRp(r.total))}</td><td class="m">100%</td>${changeCell(r.change)}</tr>`;
  return block('real', 'Realisasi', table(['Sumber', 'Nilai', 'Porsi', vsHead], rows, foot), toggle);
}

function splitBlock(c) {
  const s = c.split;
  if (!s || !ok(s.os.fi) || !ok(s.os.nfi)) return block('split', 'FI dan NFI', '<p class="sc-empty">Belum ada data</p>', '', { detail: false });
  const total = (s.os.fi || 0) + (s.os.nfi || 0);
  const cell = (main, sub) => `<td><b>${esc(main)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</td>`;
  const quality = (fi, nfi, fiAmt, nfiAmt) => `${cell(pct(fi), pfRp(fiAmt))}${cell(pct(nfi), pfRp(nfiAmt))}`;
  const rows = `<tr><th scope="row" class="l">OS</th>${cell(pfRp(s.os.fi), `porsi ${pct(total ? s.os.fi / total : null, 0)}`)}${cell(pfRp(s.os.nfi), `porsi ${pct(total ? s.os.nfi / total : null, 0)}`)}</tr>
    <tr><th scope="row" class="l">%SML</th>${quality(s.smlPct.fi, s.smlPct.nfi, s.sml.fi, s.sml.nfi)}</tr>
    <tr><th scope="row" class="l">%NPL</th>${quality(s.nplPct.fi, s.nplPct.nfi, s.npl.fi, s.npl.nfi)}</tr>`;
  return block('split', 'FI dan NFI', table(['', 'Fix Income', 'Non Fix Income'], rows), `<p class="sc-aside">${esc(fmt.month(s.month))}</p>`);
}

function slaBlock(c) {
  const s = c.sla;
  if (!s?.hasRows) return block('sla', 'Berkas SLA', '<p class="sc-empty">Belum ada data</p>', '', { detail: false });
  const rows = s.stages.map((x) => `<tr><th scope="row" class="l">${esc(x.label)}</th><td>${esc(fmt.num(x.berkas))}</td>
    <td class="${x.late ? 'bad' : 'none'}">${esc(fmt.num(x.late))}</td></tr>`).join('');
  const foot = `<tr><th scope="row" class="l">Total</th><td>${esc(fmt.num(s.berkas))}</td><td class="${s.late ? 'bad' : 'none'}">${esc(fmt.num(s.late))}</td></tr>`;
  const cair = s.cair.get(c.cur);
  const note = `<p class="sc-note"><span class="${tone(s.onTime)}"><b>${esc(pct(s.onTime, 1))}</b> tepat SLA</span>${cair ? `<span><b>${esc(fmt.num(cair.berkas))}</b> berkas cair ${esc(short(c.cur))}</span>` : ''}</p>`;
  const aside = s.sample ? '<p class="sc-aside sc-sample">data contoh</p>' : '';
  return block('sla', 'Berkas SLA', `${table(['Tahap', 'Berjalan', 'Lewat SLA'], rows, foot)}${note}`, aside);
}

function historyBlock(c) {
  const list = [...c.periods].reverse();
  const ach = (r) => `<td class="${tone(r)}">${esc(ok(r) ? pct(r, 1) : '–')}</td>`;
  const rows = list.map((p, i) => {
    const label = i === 0 && !p.full ? `s.d. ${dayOf(p.date)} ${short(p.month)}` : fmt.month(p.month, true);
    if (!p.end) return `<tr><th scope="row" class="l">${esc(label)}</th>${'<td>–</td>'.repeat(6)}</tr>`;
    return `<tr${i === 0 ? ' class="now"' : ''}><th scope="row" class="l">${esc(label)}</th>
      <td>${esc(tn(p.os))}</td>${ach(p.achOs)}<td>${esc(pct(p.nplPct))}</td><td>${esc(pct(p.smlPct))}</td><td>${esc(tn(p.disb))}</td>${ach(p.achDisb)}</tr>`;
  }).join('');
  return block('history', `${c.periods.length - 1} bulan terakhir`, table(['Bulan', 'OS', 'vs RKA', '%NPL', '%SML', 'Disburse', 'vs Guidance'], rows));
}

function watchBlock(c) {
  const list = c.standing || [];
  if (c.sel.ro || list.length < 2) return '';
  const lowOs = [...list].filter((x) => ok(x.achOs)).sort((a, b) => a.achOs - b.achOs).slice(0, 3);
  const highNpl = [...list].filter((x) => ok(x.nplPct)).sort((a, b) => b.nplPct - a.nplPct).slice(0, 3);
  const item = (x, value, state) => `<li><button type="button" data-ro="${esc(x.ro)}" title="Buka ${esc(x.ro)}">${esc(roShort(x.ro))}</button><b class="${state}">${esc(value)}</b></li>`;
  const body = `<div class="sc-rank">
    <div><h3>Capaian OS terendah</h3><ol>${lowOs.map((x) => item(x, pct(x.achOs, 1), tone(x.achOs))).join('')}</ol></div>
    <div><h3>%NPL tertinggi</h3><ol>${highNpl.map((x) => item(x, pct(x.nplPct), ok(x.rkaNplPct) && x.nplPct > x.rkaNplPct ? 'bad' : '')).join('')}</ol></div>
  </div>`;
  return block('watch', 'RO perlu perhatian', body);
}

function screenHtml(c) {
  const where = c.sel.ro ? roShort(c.sel.ro) : NASIONAL;
  const roPick = pick({ id: 'sc-ro', label: 'RO', value: c.sel.ro, on: !!c.sel.ro, options: [{ value: '', label: NASIONAL }, ...c.pm.regions.map((r) => ({ value: r, label: r }))] });
  const watch = watchBlock(c);
  return `<div class="sc">
    <header class="sc-head">
      <h1>Dashboard KPR</h1>
      <button class="sc-pos" type="button" data-open-status><span class="dot" id="exec-status-dot"></span><span>${esc(where)}</span><span>${esc(fmt.date(c.now.date))}</span></button>
      <div class="sc-tools"><button class="va-launch" id="va-launch" type="button" aria-label="${esc(WAKE_NAME)}, asisten suara (Ctrl+Spasi)">${launchHtml()}<span class="t">${esc(WAKE_NAME)}<small>Ctrl+Spasi</small></span></button>${roPick}</div>
    </header>
    <div class="sc-kpis">${kpis(c)}</div>
    <div class="sc-row sc-row-a">${realBlock(c)}${splitBlock(c)}${slaBlock(c)}</div>
    <div class="sc-row sc-row-b${watch ? '' : ' solo'}">${historyBlock(c)}${watch}</div>
  </div>`;
}

let latest = null;
let pendingDetail = null;
let assistant = null;

function openFor(id, ro, opts = {}) {
  if (!latest) return;
  if (ro && ro !== latest.c.sel.ro) { pendingDetail = { id, opts }; latest.set({ ro }); return; }
  openScDetail(id, latest.c, latest.set, opts);
}

export default {
  id: 'direktur', title: 'Direktur', icon: 'star', screen: true,
  async load() {
    const [perf, real, pf, sla] = await Promise.all([loadTable('perf_daily.json'), soft(loadReal()), soft(loadPf()), soft(loadSla())]);
    return { pm: indexPerf(perf, []), real, pf, sla };
  },
  normalize(p, m) {
    return {
      ro: m.pm.regions.includes(p.ro) ? p.ro : '',
      sumber: m.real ? sumberMode(p.sumber, m.real) : '7',
    };
  },
  context(m, sel) {
    const months = periodsOf(m.pm);
    const periods = perfPeriods(m.pm, sel.ro, months);
    const cur = months.at(-1);
    return {
      pm: m.pm, sel, cur, periods, now: periods.at(-1) || {}, prev: periods.at(-2) || null,
      realModel: m.real, pfModel: m.pf, slaModel: m.sla,
      real: m.real?.rows.length ? realCompare(m.real, sel.ro, sel.sumber, cur) : null,
      split: m.pf ? pfSplit(m.pf, sel.ro) : null,
      sla: m.sla ? slaNow(m.sla, sel.ro, months) : null,
      standing: sel.ro ? [] : roStanding(m.pm),
    };
  },
  subtitle(c) {
    return `${c.sel.ro || NASIONAL}, posisi ${fmt.date(c.now.date)}`;
  },
  skeleton() {
    return `<div class="sc sc-loading" aria-hidden="true"><div class="sc-head"><h1>Dashboard KPR</h1></div>
      <div class="sc-kpis"></div><div class="sc-row sc-row-a"></div><div class="sc-row sc-row-b"></div></div>`;
  },
  render(root, c, { set, ask }) {
    latest = { c, set };
    root.innerHTML = screenHtml(c);
    enhancePicks(root);
    root.querySelector('#sc-ro')?.addEventListener('change', (e) => set({ ro: e.target.value }));
    onSeg(root, 'sc-sumber', (v) => set({ sumber: v === '7' ? '' : v }));
    root.querySelectorAll('.sc-rank [data-ro]').forEach((b) => b.addEventListener('click', () => set({ ro: b.dataset.ro })));
    root.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openScDetail(b.dataset.open, c, set)));
    root.querySelectorAll('[data-detail]').forEach((el) => el.addEventListener('click', (e) => {
      if (e.target.closest('button, a, input, label, select, [role="listbox"]')) return;
      openScDetail(el.dataset.detail, c, set);
    }));
    if (pendingDetail) {
      const { id, opts } = pendingDetail;
      pendingDetail = null;
      openScDetail(id, c, set, opts);
    } else refreshScDetail(c, set);
    if (ask && !assistant) {
      assistant = createAssistant({
        engine: ask, getContext: () => latest?.c, set: (p) => latest?.set(p), openDetail: openFor, closeDetail: closeScDetail,
      });
    }
    assistant?.attach(root.querySelector('#va-launch'));
  },
  assistant() {
    assistant?.openTyped();
  },
  leave() {
    assistant?.detach();
    closeScDetail();
  },
};
