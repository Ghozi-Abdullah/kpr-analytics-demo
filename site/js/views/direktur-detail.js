import { esc, fmt } from '../core/format.js';
import { ok, ratio } from '../core/values.js';
import { seg, onSeg } from '../core/controls.js';
import { shiftMonth, daysInMonth } from '../core/dates.js';
import { openDetail } from '../core/ui.js';
import { lineChart, barChart, bandCombo, destroyCharts, C, SERIES, CONTEXT_GRAY } from '../charts/charts.js';
import { NASIONAL, dayOf } from '../models/performance-model.js';
import { colorIndexOf } from '../models/realisasi-sumber.js';
import { ACTIVE_STAGES } from '../models/sla-model.js';
import { perfPeriods, roPeriods, realByRo, realMonths, pfTrend, pfByRo, slaByRo, slaDays } from '../models/direktur-model.js';
import { tn, signedTn, realRp, pfRp, pct, points, short, roShort, tone, diff, trendTone } from './direktur-format.js';

const PREFIX = 'scd-';
const LONG_MONTHS = 12;
const OVER = '#EB6834';
const FI = C.accent;
const NFI = C.prev;

let openId = '';

const stat = (label, value, { sub = '', state = '' } = {}) => `<div class="scd-stat"><span>${esc(label)}</span>
  <b class="${state}">${esc(value)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
const summary = (items) => `<div class="scd-sum">${items.join('')}</div>`;
const aside = (text) => (text ? `<p class="scd-aside">${esc(text)}</p>` : '');
const card = (title, body, { note = '', cls = '' } = {}) => `<section class="scd-card${cls ? ` ${cls}` : ''}">
  <header><h3>${esc(title)}</h3>${aside(note)}</header>${body}</section>`;
const plot = (id, label, size = '') => `<div class="scd-plot${size ? ` ${size}` : ''}"><canvas id="${PREFIX}${id}" role="img" aria-label="${esc(label)}"></canvas></div>`;
const key = (items) => `<p class="scd-key">${items.map(([kind, label, color]) => `<span><i class="${kind}"${color ? ` style="--k:${color}"` : ''}></i>${esc(label)}</span>`).join('')}</p>`;
const pair = (left, right) => `<div class="scd-grid"><div class="scd-col">${left}</div><div class="scd-col">${right}</div></div>`;
const td = (value, cls = '') => `<td${cls ? ` class="${cls}"` : ''}>${esc(value)}</td>`;
const two = (main, sub, cls = '') => `<td${cls ? ` class="${cls}"` : ''}><b>${esc(main)}</b><small>${esc(sub)}</small></td>`;

function table(head, rows, foot = '') {
  return `<div class="scd-tw"><table class="scd-table">
    <thead><tr>${head.map((h, i) => `<th scope="col"${i ? '' : ' class="l"'}>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.join('')}</tbody>${foot ? `<tfoot>${foot}</tfoot>` : ''}</table></div>`;
}

const roRow = (ro, sel, cells) => `<tr${ro === sel ? ' class="now" aria-current="true"' : ''}>
  <th scope="row" class="l"><button type="button" data-scd-ro="${esc(ro)}" title="Lihat ${esc(ro)}">${esc(roShort(ro))}</button></th>${cells}</tr>`;
const monthRow = (label, cells, now = false) => `<tr${now ? ' class="now"' : ''}><th scope="row" class="l">${esc(label)}</th>${cells}</tr>`;

const monthLabel = (p, i) => (i === 0 && p.end && !p.full ? `${short(p.month)} s.d. ${dayOf(p.date)}` : fmt.month(p.month, true));
const achCell = (r) => td(ok(r) ? pct(r, 1) : '–', tone(r));
const capCell = (value, cap) => td(pct(value), ok(value) && ok(cap) && value > cap ? 'bad' : '');
const pointCell = (v, good) => td(points(v), trendTone(v, good));

function longHistory(c) {
  return perfPeriods(c.pm, c.sel.ro, c.pm.months.slice(-LONG_MONTHS)).filter((p) => p.end).reverse();
}

function dayAxis(month, prevMonth) {
  const n = Math.max(daysInMonth(month), prevMonth ? daysInMonth(prevMonth) : 0);
  return Array.from({ length: n }, (_, i) => String(i + 1));
}

function byDay(rows, pickValue, n) {
  const out = Array(n).fill(null);
  for (const r of rows) out[dayOf(r.tanggal) - 1] = pickValue(r);
  return out;
}

const dayTitle = (pts) => `Tanggal ${pts[0].dataIndex + 1}`;
const tickTn = (v) => fmt.rupiah(v * 1e9, 1);

const LEVEL = {
  os: {
    title: 'Outstanding', field: 'os', rkaField: 'rka_os', value: (p) => p.os, rka: (p) => p.rkaOs, ach: (p) => p.achOs,
    show: (v) => tn(v), signed: signedTn, tick: tickTn,
  },
  deb: {
    title: 'Debitur', field: 'debitur', rkaField: 'rka_deb', value: (p) => p.deb, rka: (p) => p.rkaDeb, ach: (p) => p.achDeb,
    show: (v) => fmt.num(v), signed: (v) => fmt.signed(v), tick: (v) => fmt.compact(v),
  },
};

function levelDetail(id, c) {
  const k = LEVEL[id];
  const p = c.now;
  const prev = c.prev || {};
  const pm = short(prev.month);
  const change = diff(k.value(p), k.value(prev));
  const gap = diff(k.value(p), k.rka(p));
  const stats = summary([
    stat(`${k.title} ${fmt.date(p.date)}`, k.show(k.value(p))),
    stat('RKA', k.show(k.rka(p))),
    stat('Capaian RKA', pct(k.ach(p), 1), { state: tone(k.ach(p)) }),
    stat('Selisih ke RKA', k.signed(gap), { state: tone(k.ach(p)) }),
    stat(`Perubahan dari akhir ${pm}`, k.signed(change), { state: trendTone(change) }),
  ]);
  const ros = roPeriods(c.pm, c.cur).sort((a, b) => (k.ach(a.now) ?? 9) - (k.ach(b.now) ?? 9));
  const roTable = table(['RO', k.title, 'RKA', 'Capaian', 'Selisih', `vs akhir ${pm}`], ros.map((x) => {
    const ch = diff(k.value(x.now), x.before ? k.value(x.before) : null);
    const g = diff(k.value(x.now), k.rka(x.now));
    return roRow(x.ro, c.sel.ro, `${td(k.show(k.value(x.now)))}${td(k.show(k.rka(x.now)), 'm')}${achCell(k.ach(x.now))}${td(k.signed(g), tone(k.ach(x.now)))}${td(k.signed(ch), trendTone(ch))}`);
  }));
  const hist = longHistory(c);
  const histTable = table(['Bulan', k.title, 'RKA', 'Capaian', 'Tumbuh'], hist.map((h, i) => {
    const grow = diff(k.value(h), hist[i + 1] ? k.value(hist[i + 1]) : null);
    return monthRow(monthLabel(h, i), `${td(k.show(k.value(h)))}${td(k.show(k.rka(h)), 'm')}${achCell(k.ach(h))}${td(k.signed(grow), trendTone(grow))}`, i === 0);
  }));
  const chartCard = card(`${k.title} harian`, `${key([['ln', fmt.month(c.cur, true), C.accent], ...(prev.month ? [['ln', fmt.month(prev.month, true), C.prev]] : []), ['dash', 'RKA', C.muted]])}${plot(id, `${k.title} harian ${fmt.month(c.cur)} dibanding bulan lalu dan RKA`)}`);
  return {
    title: k.title,
    html: `${stats}${pair(chartCard, card('Per bulan', histTable, { note: 'Tumbuh = dibanding bulan sebelumnya' }))}${card('Per RO', roTable, { note: 'Urut capaian terendah', cls: 'wide' })}`,
    charts() {
      const labels = dayAxis(c.cur, prev.month);
      const n = labels.length;
      lineChart(document.getElementById(`${PREFIX}${id}`), {
        labels, title: dayTitle, yAxis: true, values: 'last', beginAtZero: false, tickFormat: k.tick, format: k.show,
        series: [
          { label: fmt.month(c.cur, true), data: byDay(p.days, (r) => r[k.field], n), color: C.accent, fill: true },
          ...(prev.month ? [{ label: fmt.month(prev.month, true), data: byDay(prev.days, (r) => r[k.field], n), color: C.prev, width: 2 }] : []),
          { label: 'RKA', data: byDay(p.days, (r) => r[k.rkaField], n), color: C.muted, dash: true, width: 1.5, lab: 'none' },
        ],
      });
    },
  };
}

const QUALITY = {
  sml: { title: 'SML', field: 'dpk', amount: (p) => p.sml, rkaAmount: (p) => p.rkaSml, share: (p) => p.smlPct, rkaShare: (p) => p.rkaSmlPct, color: C.sml },
  npl: { title: 'NPL', field: 'npl', amount: (p) => p.npl, rkaAmount: (p) => p.rkaNpl, share: (p) => p.nplPct, rkaShare: (p) => p.rkaNplPct, color: C.npl },
};

function qualityDetail(id, c) {
  const k = QUALITY[id];
  const p = c.now;
  const prev = c.prev || {};
  const pm = short(prev.month);
  const change = diff(k.share(p), k.share(prev));
  const gap = diff(k.share(p), k.rkaShare(p));
  const stats = summary([
    stat(`%${k.title} ${fmt.date(p.date)}`, pct(k.share(p)), { state: ok(gap) ? (gap > 0 ? 'bad' : 'good') : '' }),
    stat(`RKA %${k.title}`, pct(k.rkaShare(p))),
    stat(`Nominal ${k.title}`, tn(k.amount(p))),
    stat('RKA nominal', tn(k.rkaAmount(p))),
    stat(`Perubahan dari akhir ${pm}`, points(change), { state: trendTone(change, false) }),
  ]);
  const ros = roPeriods(c.pm, c.cur).sort((a, b) => (k.share(b.now) ?? -1) - (k.share(a.now) ?? -1));
  const roTable = table(['RO', 'Nominal', `%${k.title}`, 'RKA', 'Selisih ke RKA', `vs akhir ${pm}`], ros.map((x) => {
    const g = diff(k.share(x.now), k.rkaShare(x.now));
    const ch = diff(k.share(x.now), x.before ? k.share(x.before) : null);
    return roRow(x.ro, c.sel.ro, `${td(tn(k.amount(x.now)))}${capCell(k.share(x.now), k.rkaShare(x.now))}${td(pct(k.rkaShare(x.now)), 'm')}${pointCell(g, false)}${pointCell(ch, false)}`);
  }));
  const hist = longHistory(c);
  const histTable = table(['Bulan', 'Nominal', `%${k.title}`, 'RKA', 'Selisih ke RKA'], hist.map((h, i) => monthRow(monthLabel(h, i),
    `${td(tn(k.amount(h)))}${capCell(k.share(h), k.rkaShare(h))}${td(pct(k.rkaShare(h)), 'm')}${pointCell(diff(k.share(h), k.rkaShare(h)), false)}`, i === 0)));
  const legend = key([['bx', `Nominal ${k.title}`, `${k.color}99`], ['bx', 'Nominal di atas RKA', `${OVER}A6`], ['ln', `%${k.title} terhadap OS`, k.color], ['dash', 'RKA nominal', C.muted]]);
  return {
    title: k.title,
    html: `${stats}${pair(card(`${k.title} harian ${fmt.month(c.cur, true)}`, `${legend}${plot(id, `${k.title} harian: nominal dan persentase terhadap OS`)}`), card('Per bulan', histTable, { note: 'Merah = di atas RKA' }))}
      ${card('Per RO', roTable, { note: `Urut %${k.title} tertinggi; merah = di atas RKA`, cls: 'wide' })}`,
    charts() {
      const days = p.days || [];
      const rka = k.rkaAmount(p);
      const bars = days.map((r) => r[k.field]);
      const last = bars.length - 1;
      bandCombo(document.getElementById(`${PREFIX}${id}`), {
        labels: days.map((r) => String(dayOf(r.tanggal))), title: dayTitle, bars, pct: days.map((r) => ratio(r[k.field], r.os)),
        barColors: bars.map((v, i) => {
          const over = ok(v) && ok(rka) && v > rka;
          if (i === last) return over ? OVER : k.color;
          return over ? `${OVER}A6` : `${k.color}99`;
        }),
        color: k.color, barLabel: `Nominal ${k.title}`, pctLabel: `%${k.title}`, format: (v) => tn(v), tickFormat: tickTn, pctFormat: (v) => pct(v),
        refs: ok(rka) ? [{ axis: 'y', value: rka, label: `RKA ${tn(rka, 1).replace(' ', ' ')}` }] : [],
      });
    },
  };
}

function disburseDetail(c) {
  const p = c.now;
  const prev = c.prev || {};
  const pm = short(prev.month);
  const before = p.end?.disburse_lalu;
  const change = ok(p.disb) && ok(before) && before ? p.disb / before - 1 : null;
  const lastDay = p.date ? dayOf(p.date) : '';
  const stats = summary([
    stat(`Disburse s.d. ${fmt.date(p.date)}`, tn(p.disb)),
    stat('Prognosa akhir bulan', tn(p.prognosa)),
    stat('Capaian prognosa', pct(p.progDisb, 1), { state: tone(p.progDisb) }),
    stat('Guidance', tn(p.guidance)),
    stat('Capaian guidance', pct(p.achDisb, 1), { state: tone(p.achDisb) }),
    stat(p.full ? `Dibanding total ${pm}` : `Dibanding ${pm} s.d. tgl ${lastDay}`, fmt.signedPct(change, 0), { state: trendTone(change) }),
  ]);
  const ros = roPeriods(c.pm, c.cur).sort((a, b) => (a.now.achDisb ?? 9) - (b.now.achDisb ?? 9));
  const roTable = table(['RO', 'Disburse', 'Prognosa', 'Capaian', 'Guidance', 'Capaian', `vs ${pm}`], ros.map((x) => {
    const lalu = x.now.end?.disburse_lalu;
    const ch = ok(x.now.disb) && ok(lalu) && lalu ? x.now.disb / lalu - 1 : null;
    return roRow(x.ro, c.sel.ro, `${td(tn(x.now.disb))}${td(tn(x.now.prognosa), 'm')}${achCell(x.now.progDisb)}${td(tn(x.now.guidance), 'm')}${achCell(x.now.achDisb)}${td(fmt.signedPct(ch, 0), trendTone(ch))}`);
  }));
  const hist = longHistory(c);
  const histTable = table(['Bulan', 'Disburse', 'Guidance', 'Capaian', 'Prognosa'], hist.map((h, i) => monthRow(monthLabel(h, i),
    `${td(tn(h.disb))}${td(tn(h.guidance), 'm')}${achCell(h.achDisb)}${td(tn(h.prognosa), 'm')}`, i === 0)));
  const legend = key([['ln', `${fmt.month(c.cur, true)} kumulatif`, C.accent], ...(prev.month ? [['ln', `${fmt.month(prev.month, true)} kumulatif`, C.prev]] : []), ['dash', 'Guidance', C.muted]]);
  return {
    title: 'Disburse bulan ini',
    html: `${stats}${pair(card('Disburse kumulatif harian', `${legend}${plot('disb', 'Disburse kumulatif harian dibanding bulan lalu dan guidance')}`), card('Per bulan', histTable, { note: 'Capaian = disburse dibanding guidance' }))}
      ${card('Per RO', roTable, { note: 'Urut capaian guidance terendah', cls: 'wide' })}`,
    charts() {
      const labels = dayAxis(c.cur, prev.month);
      const n = labels.length;
      lineChart(document.getElementById(`${PREFIX}disb`), {
        labels, title: dayTitle, yAxis: true, values: 'last', tickFormat: tickTn, format: (v) => tn(v),
        series: [
          { label: fmt.month(c.cur, true), data: byDay(p.days, (r) => r.disburse, n), color: C.accent, fill: true },
          ...(prev.month ? [{ label: fmt.month(prev.month, true), data: byDay(prev.days, (r) => r.disburse, n), color: C.prev, width: 2 }] : []),
          { label: 'Guidance', data: byDay(p.days, (r) => r.guidance_disb, n), color: C.muted, dash: true, width: 1.5, lab: 'none' },
        ],
      });
    },
  };
}

const tipeName = (t) => t || 'Lainnya';
const realCell = (v) => realRp(v, Math.abs(v || 0) >= 1e6 ? 1 : 0);
const tipeColor = (t) => (t ? SERIES[colorIndexOf(t)] : CONTEXT_GRAY);

function realDetail(c) {
  const mode = c.sel.sumber;
  const cmp = c.real;
  const byRo = realByRo(c.realModel, mode, c.cur, c.pm.regions);
  const mon = realMonths(c.realModel, c.sel.ro, mode, 6);
  const pm = short(shiftMonth(cmp.month, -1));
  const top = cmp.rows[0];
  const grow = [...cmp.rows].filter((x) => ok(x.change) && x.prev).sort((a, b) => b.change - a.change)[0];
  const period = cmp.full ? fmt.month(cmp.month, true) : `${short(cmp.month)} s.d. ${cmp.lastDay}`;
  const stats = summary([
    stat(`Realisasi ${period}`, realRp(cmp.total)),
    stat(cmp.full ? `Dibanding total ${pm}` : `Dibanding ${pm} s.d. tgl ${cmp.lastDay}`, fmt.signedPct(cmp.change, 0), { state: trendTone(cmp.change), sub: `${pm}: ${realRp(cmp.prevTotal)}` }),
    stat('Sumber terbesar', tipeName(top?.tipe), { sub: top ? `${realRp(top.value)}, porsi ${pct(cmp.total ? top.value / cmp.total : null, 0)}` : '' }),
    stat('Tumbuh paling tinggi', grow ? tipeName(grow.tipe) : '–', { sub: grow ? fmt.signedPct(grow.change, 0) : '', state: '' }),
  ]);
  const modes = c.realModel.modes || ['7', '5'];
  const tools = modes.length > 1 ? seg({ name: 'scd-sumber', label: 'Pembagian sumber realisasi', small: true, value: mode, options: modes.map((m) => ({ value: m, label: `${m} sumber` })) }) : '';
  const monthHead = mon.months.map((m, i) => (i === mon.months.length - 1 && mon.partial ? `${short(m)} s.d. ${cmp.lastDay}` : short(m)));
  const monTable = table(['Sumber', ...monthHead], [
    ...mon.tipes.map((t) => monthRow(tipeName(t), mon.months.map((m) => td(realCell(mon.value(m, t)))).join(''))),
  ], `<tr><th scope="row" class="l">Total</th>${mon.totals.map((v) => td(realCell(v))).join('')}</tr>`);
  const roHead = ['RO', ...byRo.tipes.map(tipeName), 'Total', `vs ${pm}`];
  const roTable = table(roHead, byRo.rows.map((x) => roRow(x.ro, c.sel.ro,
    `${byRo.tipes.map((t) => td(realCell(x.cells.get(t) || 0), x.cells.get(t) ? '' : 'none')).join('')}<td class="sum">${esc(realCell(x.total))}</td>${td(fmt.signedPct(x.change, 0), trendTone(x.change))}`)));
  const legend = key(mon.tipes.map((t) => ['bx', tipeName(t), tipeColor(t)]));
  return {
    title: 'Realisasi',
    tools,
    html: `${stats}${pair(card('Realisasi per bulan', `${legend}${plot('real', 'Realisasi per bulan per sumber', 'tall')}`), card(`Per bulan, ${mon.months[0]?.slice(0, 4) || ''}`, monTable))}
      ${card('Per RO', roTable, { note: 'Urut total terbesar', cls: 'wide' })}`,
    charts() {
      barChart(document.getElementById(`${PREFIX}real`), {
        labels: monthHead, stacked: true, format: (v) => realRp(v), tickFormat: (v) => fmt.rupiah(v * 1e6, 0), valueLabels: true,
        series: mon.tipes.map((t) => ({ label: tipeName(t), data: mon.months.map((m) => mon.value(m, t)), color: tipeColor(t) })),
      });
    },
    bind(dlg, set) {
      onSeg(dlg, 'scd-sumber', (v) => set({ sumber: v === '7' ? '' : v }));
    },
  };
}

function splitDetail(c) {
  const s = c.split;
  const trend = pfTrend(c.pfModel, c.sel.ro, LONG_MONTHS);
  const byRo = pfByRo(c.pfModel, c.pm.regions);
  const total = (s.os.fi || 0) + (s.os.nfi || 0);
  const share = (v) => pct(total ? v / total : null, 0);
  const stats = summary([
    stat('OS Fix Income', pfRp(s.os.fi), { sub: `porsi ${share(s.os.fi)}` }),
    stat('OS Non Fix Income', pfRp(s.os.nfi), { sub: `porsi ${share(s.os.nfi)}` }),
    stat('%SML Fix Income', pct(s.smlPct.fi), { sub: pfRp(s.sml.fi) }),
    stat('%SML Non Fix Income', pct(s.smlPct.nfi), { sub: pfRp(s.sml.nfi) }),
    stat('%NPL Fix Income', pct(s.nplPct.fi), { sub: pfRp(s.npl.fi) }),
    stat('%NPL Non Fix Income', pct(s.nplPct.nfi), { sub: pfRp(s.npl.nfi) }),
  ]);
  const legend = key([['bx', 'Fix Income', FI], ['bx', 'Non Fix Income', NFI]]);
  const lineKey = key([['ln', 'Fix Income', FI], ['ln', 'Non Fix Income', NFI]]);
  const list = [...trend].reverse();
  const histTable = table(['Bulan', 'OS FI', 'OS NFI', '%SML FI', '%SML NFI', '%NPL FI', '%NPL NFI'], list.map((t, i) => monthRow(fmt.month(t.month, true),
    `${td(pfRp(t.os.fi))}${td(pfRp(t.os.nfi))}${td(pct(t.smlPct.fi))}${td(pct(t.smlPct.nfi))}${td(pct(t.nplPct.fi))}${td(pct(t.nplPct.nfi))}`, i === 0)));
  const roTable = table(['RO', 'OS FI', 'OS NFI', 'Porsi FI', '%SML FI', '%SML NFI', '%NPL FI', '%NPL NFI'], byRo.filter((x) => ok(x.os.fi) || ok(x.os.nfi)).map((x) => {
    const sum = (x.os.fi || 0) + (x.os.nfi || 0);
    return roRow(x.ro, c.sel.ro, `${td(pfRp(x.os.fi))}${td(pfRp(x.os.nfi))}${td(pct(sum ? (x.os.fi || 0) / sum : null, 0), 'm')}${td(pct(x.smlPct.fi))}${td(pct(x.smlPct.nfi))}${td(pct(x.nplPct.fi))}${td(pct(x.nplPct.nfi))}`);
  }));
  const labels = trend.map((t) => fmt.month(t.month, true));
  return {
    title: 'Fix Income dan Non Fix Income',
    html: `${stats}${pair(card('OS per bulan', `${legend}${plot('split-os', 'OS Fix Income dan Non Fix Income per bulan')}`), card('%NPL per bulan', `${lineKey}${plot('split-npl', '%NPL Fix Income dan Non Fix Income per bulan')}`))}
      ${card('Per bulan', histTable, { cls: 'wide' })}${card(`Per RO, ${fmt.month(s.month, true)}`, roTable, { note: 'Urut nomor region', cls: 'wide' })}`,
    charts() {
      barChart(document.getElementById(`${PREFIX}split-os`), {
        labels, stacked: true, format: (v) => pfRp(v), tickFormat: (v) => fmt.rupiah(v, 0), valueLabels: true,
        series: [{ label: 'Fix Income', data: trend.map((t) => t.os.fi), color: FI }, { label: 'Non Fix Income', data: trend.map((t) => t.os.nfi), color: NFI }],
      });
      lineChart(document.getElementById(`${PREFIX}split-npl`), {
        labels, yAxis: true, values: 'last', beginAtZero: false, format: (v) => pct(v), tickFormat: (v) => pct(v, 1),
        series: [{ label: 'Fix Income', data: trend.map((t) => t.nplPct.fi), color: FI }, { label: 'Non Fix Income', data: trend.map((t) => t.nplPct.nfi), color: NFI, width: 2.75 }],
      });
    },
  };
}

function slaDetail(c) {
  const s = c.sla;
  const ros = slaByRo(c.slaModel, c.pm.regions, c.cur).sort((a, b) => b.late - a.late);
  const days = slaDays(c.slaModel, c.sel.ro, c.cur);
  const masuk = days.days.reduce((t, d) => t + d.masuk, 0);
  const cair = days.days.reduce((t, d) => t + d.cair, 0);
  const stats = summary([
    stat('Berkas berjalan', fmt.num(s.berkas)),
    stat('Lewat SLA', fmt.num(s.late), { state: s.late ? 'bad' : '', sub: `${pct(s.berkas ? s.late / s.berkas : null, 0)} dari berjalan` }),
    stat('Tepat SLA', pct(s.onTime, 1), { state: tone(s.onTime) }),
    stat(`Prakarsa baru ${short(c.cur)}`, fmt.num(masuk)),
    stat(`Cair ${short(c.cur)}`, fmt.num(cair), { sub: 'berkas' }),
  ]);
  const stageTable = table(['Tahap', 'Berjalan', 'Lewat SLA', 'Plafon'], s.stages.map((x) => monthRow(x.label,
    `${td(fmt.num(x.berkas))}${td(fmt.num(x.late), x.late ? 'bad' : 'none')}${td(fmt.rupiah(x.nominal), 'm')}`)),
  `<tr><th scope="row" class="l">Total</th>${td(fmt.num(s.berkas))}${td(fmt.num(s.late), s.late ? 'bad' : 'none')}${td(fmt.rupiah(s.stages.reduce((t, x) => t + (x.nominal || 0), 0)), 'm')}</tr>`);
  const stageCell = (x, id) => {
    const st = x.stages.find((y) => y.id === id);
    return st ? two(fmt.num(st.berkas), st.late ? `${fmt.num(st.late)} lewat` : 'tepat', st.late ? 'warnsub' : '') : td('–');
  };
  const roTable = table(['RO', ...ACTIVE_STAGES.map((x) => x.label), 'Berjalan', 'Lewat SLA', 'Tepat SLA', `Cair ${short(c.cur)}`], ros.map((x) => roRow(x.ro, c.sel.ro,
    `${ACTIVE_STAGES.map((st) => stageCell(x, st.id)).join('')}<td class="sum">${esc(fmt.num(x.berkas))}</td>${td(fmt.num(x.late), x.late ? 'bad' : 'none')}${achCell(x.onTime)}${td(fmt.num(x.cair.get(c.cur)?.berkas || 0))}`)));
  const legend = key([['bx', 'Prakarsa baru', C.prev], ['bx', 'Cair', C.accent]]);
  return {
    title: 'Berkas SLA',
    html: `${stats}${pair(card(`Berkas per hari, ${fmt.month(c.cur, true)}`, days.days.length ? `${legend}${plot('sla', 'Prakarsa baru dan berkas cair per hari')}` : '<p class="scd-empty">Belum ada data harian</p>'), card('Per tahap', stageTable, { note: 'Lewat SLA = umur berkas lebih dari 3 hari' }))}
      ${card('Per RO', roTable, { note: 'Urut lewat SLA terbanyak', cls: 'wide' })}`,
    charts() {
      if (!days.days.length) return;
      barChart(document.getElementById(`${PREFIX}sla`), {
        labels: days.days.map((_, i) => String(i + 1)), title: dayTitle, format: (v) => `${fmt.num(v)} berkas`, tickFormat: (v) => fmt.num(v), valueLabels: false,
        series: [{ label: 'Prakarsa baru', data: days.days.map((d) => d.masuk), color: C.prev }, { label: 'Cair', data: days.days.map((d) => d.cair), color: C.accent }],
      });
    },
  };
}

function historyDetail(c) {
  const hist = longHistory(c);
  const asc = [...hist].reverse();
  const rows = hist.map((h, i) => monthRow(monthLabel(h, i), `${td(tn(h.os))}${td(tn(h.rkaOs), 'm')}${achCell(h.achOs)}
    ${td(fmt.num(h.deb))}${achCell(h.achDeb)}${capCell(h.nplPct, h.rkaNplPct)}${td(pct(h.rkaNplPct), 'm')}${capCell(h.smlPct, h.rkaSmlPct)}${td(pct(h.rkaSmlPct), 'm')}
    ${td(tn(h.disb))}${td(tn(h.guidance), 'm')}${achCell(h.achDisb)}`, i === 0));
  const head = ['Bulan', 'OS', 'RKA OS', 'Capaian', 'Debitur', 'Capaian', '%NPL', 'RKA', '%SML', 'RKA', 'Disburse', 'Guidance', 'Capaian'];
  const legend = key([['ln', 'OS akhir bulan', C.accent], ['dash', 'RKA OS', C.muted]]);
  const qKey = key([['ln', '%NPL', C.npl], ['ln', '%SML', C.sml]]);
  return {
    title: `${hist.length} bulan terakhir`,
    html: `${pair(card('OS per bulan', `${legend}${plot('hist-os', 'OS akhir bulan dibanding RKA')}`), card('%NPL dan %SML per bulan', `${qKey}${plot('hist-q', '%NPL dan %SML per bulan')}`))}
      ${card('Per bulan', table(head, rows), { note: '%NPL dan %SML merah = di atas RKA', cls: 'wide' })}`,
    charts() {
      const labels = asc.map((h) => fmt.month(h.month, true));
      lineChart(document.getElementById(`${PREFIX}hist-os`), {
        labels, yAxis: true, values: 'last', beginAtZero: false, tickFormat: tickTn, format: (v) => tn(v),
        series: [{ label: 'OS', data: asc.map((h) => h.os), color: C.accent, fill: true, points: 3 }, { label: 'RKA OS', data: asc.map((h) => h.rkaOs), color: C.muted, dash: true, width: 1.5, lab: 'none' }],
      });
      lineChart(document.getElementById(`${PREFIX}hist-q`), {
        labels, yAxis: true, values: 'last', beginAtZero: false, tickFormat: (v) => pct(v, 1), format: (v) => pct(v),
        series: [{ label: '%NPL', data: asc.map((h) => h.nplPct), color: C.npl, points: 3 }, { label: '%SML', data: asc.map((h) => h.smlPct), color: C.sml, points: 3 }],
      });
    },
  };
}

function watchDetail(c) {
  const ros = roPeriods(c.pm, c.cur).sort((a, b) => (a.now.achOs ?? 9) - (b.now.achOs ?? 9));
  const count = (fn) => ros.filter((x) => fn(x.now)).length;
  const stats = summary([
    stat('Jumlah RO', fmt.num(ros.length)),
    stat('Capai RKA OS', `${fmt.num(count((p) => ok(p.achOs) && p.achOs >= 1))} RO`),
    stat('%NPL di atas RKA', `${fmt.num(count((p) => ok(p.nplPct) && ok(p.rkaNplPct) && p.nplPct > p.rkaNplPct))} RO`, { state: count((p) => ok(p.nplPct) && ok(p.rkaNplPct) && p.nplPct > p.rkaNplPct) ? 'bad' : '' }),
    stat('%SML di atas RKA', `${fmt.num(count((p) => ok(p.smlPct) && ok(p.rkaSmlPct) && p.smlPct > p.rkaSmlPct))} RO`, { state: count((p) => ok(p.smlPct) && ok(p.rkaSmlPct) && p.smlPct > p.rkaSmlPct) ? 'bad' : '' }),
  ]);
  const head = ['RO', 'OS', 'Capaian OS', 'Capaian Debitur', '%NPL', 'RKA', '%SML', 'RKA', 'Disburse', 'Capaian prognosa', 'Capaian guidance'];
  const rows = ros.map((x) => roRow(x.ro, c.sel.ro, `${td(tn(x.now.os))}${achCell(x.now.achOs)}${achCell(x.now.achDeb)}${capCell(x.now.nplPct, x.now.rkaNplPct)}${td(pct(x.now.rkaNplPct), 'm')}
    ${capCell(x.now.smlPct, x.now.rkaSmlPct)}${td(pct(x.now.rkaSmlPct), 'm')}${td(tn(x.now.disb))}${achCell(x.now.progDisb)}${achCell(x.now.achDisb)}`));
  return {
    title: 'Semua RO',
    html: `${stats}${card(`Posisi ${fmt.date(c.now.date)}`, table(head, rows), { note: 'Urut capaian OS terendah; %NPL dan %SML merah = di atas RKA', cls: 'wide' })}`,
  };
}

const VIEWS = {
  os: (c) => levelDetail('os', c),
  deb: (c) => levelDetail('deb', c),
  sml: (c) => qualityDetail('sml', c),
  npl: (c) => qualityDetail('npl', c),
  disb: disburseDetail,
  real: (c) => (c.real ? realDetail(c) : null),
  split: (c) => (c.split && (ok(c.split.os.fi) || ok(c.split.os.nfi)) ? splitDetail(c) : null),
  sla: (c) => (c.sla?.hasRows ? slaDetail(c) : null),
  history: historyDetail,
  watch: watchDetail,
};


export function openScDetail(id, c, set) {
  const d = VIEWS[id]?.(c);
  if (!d) return;
  openId = id;
  destroyCharts(PREFIX);
  const where = c.sel.ro || NASIONAL;
  const footer = c.sel.ro ? `<button class="btn" type="button" data-scd-ro="">Kembali ke ${esc(NASIONAL)}</button>` : '';
  const dlg = openDetail({ title: d.title, subtitle: `${where}, posisi ${fmt.date(c.now.date)}`, html: `<div class="scd">${d.html}</div>`, footer, tone: 'full' });
  if (!dlg.dataset.scd) {
    dlg.dataset.scd = 'on';
    dlg.addEventListener('close', () => { openId = ''; destroyCharts(PREFIX); });
  }
  if (d.tools) dlg.querySelector('.dialog-head [data-close]').insertAdjacentHTML('beforebegin', `<div class="scd-head-tools">${d.tools}</div>`);
  dlg.querySelectorAll('[data-scd-ro]').forEach((b) => b.addEventListener('click', () => set({ ro: b.dataset.scdRo })));
  d.bind?.(dlg, set);
  if (d.charts) requestAnimationFrame(() => { if (dlg.open && openId === id) d.charts(); });
}

export function refreshScDetail(c, set) {
  const dlg = document.getElementById('detail-dialog');
  if (openId && dlg?.open && dlg.dataset.tone === 'full') openScDetail(openId, c, set);
}
