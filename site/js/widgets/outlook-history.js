import { esc, fmt } from '../core/format.js';
import { ok, ratio } from '../core/values.js';
import { openDetail } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { history, outlook } from '../analytics/outlook.js';
import { rpM, pct, num, roName, monthName } from '../analytics/wording.js';
import { liftText, tierOf } from '../analytics/outlook-text.js';

const money = (v) => (ok(v) ? rpM(v) : '–');
const share = (v) => (ok(v) ? pct(v, 2) : '–');
const mean = (list) => {
  const l = list.filter(ok);
  return l.length ? l.reduce((a, b) => a + b, 0) / l.length : null;
};
const pick = (rows, key) => rows.filter((r) => ok(r[key])).reduce((a, r) => (!a || r[key] > a[key] ? r : a), null);
const shortMonth = (m) => fmt.month(m, true);

function yearBest(y, wdPlan) {
  const n = y.planCount;
  const growth = (y.cap.os - y.startOs) / n;
  const disb = y.cap.disb / n;
  return { growth, runoff: disb - growth, disb, perWd: wdPlan ? y.cap.disb / wdPlan : null };
}

function yearNeed(o, splitRow, wdPlan) {
  const y = o.year;
  const best = yearBest(y, wdPlan);
  const period = String(y.year);
  if (splitRow) {
    const n = splitRow.planCount;
    const growth = (splitRow.os - splitRow.startOs) / n;
    const disb = splitRow.disb / n;
    const baseGrowth = (splitRow.base - splitRow.startOs) / n;
    const baseDisb = splitRow.disbBase / n;
    return {
      period, perMonth: true, short: `Per bulan ${y.year}`, target: splitRow.os, osEnd: splitRow.os, targetLabel: `Target OS akhir ${y.year}`,
      growth, runoff: disb - growth, disb, perWd: wdPlan ? splitRow.disb / wdPlan : null, lift: splitRow.lift, tier: splitRow.tier,
      base: { growth: baseGrowth, runoff: baseDisb - baseGrowth, disb: baseDisb, perWd: wdPlan ? splitRow.disbBase / wdPlan : null }, best,
    };
  }
  if (!y.need) return null;
  const n = y.planCount;
  return {
    period, perMonth: true, short: `Per bulan ${y.year}`, target: y.target, osEnd: y.target, targetLabel: `Target OS akhir ${y.year}`,
    growth: (y.target - y.startOs) / n, runoff: y.need.runoff / n, disb: y.need.disb / n, perWd: y.wdPlan ? y.need.disb / y.wdPlan : null,
    lift: y.lift, tier: y.tier,
    base: { growth: (y.base.os - y.startOs) / n, runoff: y.base.runoff / n, disb: y.base.disb / n, perWd: y.wdPlan ? y.base.disb / y.wdPlan : null }, best,
  };
}

export function needOf(o, mode, splitRow = null, wdPlan = null) {
  if (mode === 'year' && o.year) return yearNeed(o, splitRow, wdPlan ?? o.year.wdPlan);
  if (mode === 'current' && o.current) {
    const c = o.current;
    const disb = c.disb + Math.max(0, c.needRem ?? 0);
    const bestDisb = c.disb + c.capRem;
    const osEnd = ok(c.growthGoal) ? c.osStart + c.growthGoal : c.target;
    return {
      period: monthName(c.month), short: `${shortMonth(c.month)} (dibutuhkan)`, target: c.target, osEnd, targetLabel: `RKA OS ${monthName(c.month)}`,
      growth: c.growthGoal, runoff: o.close.runoff, disb, perWd: c.wdTot ? disb / c.wdTot : null, lift: c.lift, tier: c.tier,
      npl: ratio(c.quality.npl.rka, osEnd), sml: ratio(c.quality.sml.rka, osEnd),
      base: { growth: c.closeOs - c.osStart, runoff: o.close.runoff, disb: c.closeDisb, perWd: c.wdTot ? c.closeDisb / c.wdTot : null },
      best: { growth: bestDisb - o.close.runoff, runoff: o.close.runoff, disb: bestDisb, perWd: c.wdTot ? bestDisb / c.wdTot : null },
    };
  }
  const n = o.next;
  const osEnd = ok(n.growthGoal) ? o.close.os + n.growthGoal : n.target;
  return {
    period: monthName(n.month), short: `${shortMonth(n.month)} (dibutuhkan)`, target: n.target, osEnd,
    targetLabel: n.targetSource === 'rka' ? `RKA OS ${monthName(n.month)}` : `Perkiraan RKA ${monthName(n.month)}`,
    growth: n.growthGoal, runoff: n.baseRun, disb: n.needDisb, perWd: n.perWd, lift: n.lift, tier: n.tier,
    npl: ratio(n.quality.npl.rka, osEnd), sml: ratio(n.quality.sml.rka, osEnd),
    base: { growth: n.growthBase, runoff: n.baseRun, disb: n.baseDisb, perWd: n.rate },
    best: { growth: n.capDisb - n.baseRun, runoff: n.baseRun, disb: n.capDisb, perWd: n.capDisb / n.wd },
  };
}

function whyLine(need, recent) {
  if (!need || !ok(need.growth)) return '';
  const avg = mean(recent.map((r) => r.grown));
  const t = tierOf(need.tier);
  const times = ok(avg) && avg > 0 && need.growth > 0 ? need.growth / avg : null;
  const growth = need.growth <= 0
    ? `Target tidak meminta OS tumbuh (${rpM(need.growth)}).`
    : `OS perlu tumbuh <b>${rpM(need.growth)}</b>${ok(times) ? `, ${times >= 1.05 ? `<b>${num(times, 1)} kali</b> rata-rata 6 bulan terakhir (${rpM(avg)})` : times <= 0.95 ? `di bawah rata-rata 6 bulan terakhir (${rpM(avg)})` : `setara rata-rata 6 bulan terakhir`}` : ok(avg) ? `, padahal 6 bulan terakhir OS rata-rata ${avg < 0 ? `turun ${rpM(-avg)}` : 'tidak tumbuh'}` : ''}.`;
  const disb = ok(need.disb) ? ` Ditambah runoff ${rpM(need.runoff)}, disburse perlu <b>${rpM(Math.max(0, need.disb))}</b>: ${esc(liftText(need.lift))} dari laju biasa, ${esc(t.word.toLowerCase())}.` : '';
  return `${growth}${disb}`;
}

function compareTable(need, recent) {
  const rows = [
    ['Tumbuh OS', 'growth', 'grown'],
    ['Runoff', 'runoff', 'runoff'],
    ['Disburse', 'disb', 'disb'],
    ['Per hari kerja', 'perWd', 'perWd'],
  ];
  const head = ['', need.short, 'Laju biasa', 'Laju terbaik', 'Rata-rata 6 bulan'];
  const body = rows.map(([label, k, h]) => `<tr><th scope="row">${esc(label)}</th><td class="hist-need">${esc(money(need[k]))}</td>
      <td>${esc(money(need.base?.[k]))}</td><td>${esc(money(need.best?.[k]))}</td><td>${esc(money(mean(recent.map((r) => r[h]))))}</td></tr>`).join('');
  return `<div class="pop-table-wrap"><table class="pop-table hist-table"><thead><tr>${head.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function monthTable(rows, need) {
  const recent = rows.filter((r) => r.complete).slice(-6);
  const top = (k) => pick(recent, k)?.month;
  const topDisb = top('disb');
  const topWd = top('perWd');
  const cols = ['Bulan', 'OS akhir', 'RKA OS', 'Capaian RKA', 'Tumbuh OS', 'Naik RKA', 'Disburse', 'Per hari kerja', 'Runoff', '%NPL', '%SML'];
  const signed = (v) => (ok(v) ? `<span class="${v < 0 ? 'hist-neg' : ''}">${esc(rpM(v))}</span>` : '–');
  const body = rows.map((r) => `<tr>
      <th scope="row">${esc(shortMonth(r.month))}${r.complete ? '' : `<small>s.d. tanggal ${num(r.day)}</small>`}</th>
      <td>${esc(money(r.os))}</td><td>${esc(money(r.rka))}</td>
      <td class="${ok(r.ach) && r.ach < 1 ? 'hist-under' : ''}">${esc(ok(r.ach) ? pct(r.ach, 1) : '–')}</td>
      <td>${signed(r.grown)}</td><td>${signed(r.rkaStep)}</td>
      <td>${r.month === topDisb ? `<b>${esc(money(r.disb))}</b>` : esc(money(r.disb))}</td>
      <td>${r.month === topWd ? `<b>${esc(money(r.perWd))}</b>` : esc(money(r.perWd))}</td>
      <td>${esc(money(r.runoff))}</td><td>${esc(share(r.npl))}</td><td>${esc(share(r.sml))}</td></tr>`).join('');
  const needRow = need ? `<tr class="hist-target">
      <th scope="row">${esc(need.short)}</th><td>${esc(money(need.osEnd))}</td><td>${esc(money(need.target))}</td><td>${esc(ok(ratio(need.osEnd, need.target)) ? pct(ratio(need.osEnd, need.target), 1) : '–')}</td>
      <td>${signed(need.growth)}</td><td>${signed(need.growth)}</td><td><b>${esc(money(need.disb))}</b></td><td><b>${esc(money(need.perWd))}</b></td>
      <td>${esc(money(need.runoff))}</td><td>${esc(share(need.npl))}</td><td>${esc(share(need.sml))}</td></tr>` : '';
  return `<div class="pop-table-wrap"><table class="pop-table hist-table"><thead><tr>${cols.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${body}${needRow}</tbody></table></div>`;
}

export function openRoHistory({ pm, real, ro, mode, splitRow = null, wdPlan = null, onOpen = null }) {
  const o = outlook(pm, { ro, real, perRo: false });
  const rows = history(pm, ro);
  if (!o || !rows.length) return;
  const need = needOf(o, mode, splitRow, wdPlan);
  const recent = rows.filter((r) => r.complete).slice(-6);
  const name = roName(ro);
  const card = (title, note, body, cls = '') => `<section class="pop-card wide"><h3>${esc(title)}</h3>${note ? `<p${cls ? ` class="${cls}"` : ''}>${note}</p>` : ''}${body}</section>`;
  const html = [
    need ? card(ok(need.lift) && need.lift > 0.005 ? `Kenapa ${need.period} perlu melaju lebih cepat` : `Kebutuhan ${need.period}`, whyLine(need, recent),
      `${compareTable(need, recent)}<p class="hist-foot">Laju terbaik memakai bulan terbaik kedua dalam 6 bulan terakhir, jadi satu bulan yang luar biasa tidak dijadikan patokan.${need.perMonth ? ' Angka tahunan ditampilkan rata-rata per bulan.' : ''}</p>`, 'hist-why') : '',
    card('Riwayat per bulan', 'Angka tebal = disburse tertinggi dalam 6 bulan terakhir. Baris terakhir = yang dibutuhkan.', monthTable(rows, need)),
  ].join('');
  const dlg = openDetail({
    title: `${name}: riwayat dan kebutuhan`,
    subtitle: need ? `${need.targetLabel} ${money(need.target)}. Status: ${tierOf(need.tier).word.toLowerCase()}.` : '',
    html, tone: 'outlook',
    footer: onOpen ? `<button type="button" class="btn primary" data-open-ro>${icon('arrow-right', 15)}Buka outlook ${esc(name)}</button>` : '',
  });
  dlg.querySelector('[data-open-ro]')?.addEventListener('click', () => { dlg.close(); onOpen(ro); });
}

export function historyMini(pm, o, mode, cid) {
  const rows = history(pm, o.roKey, 6);
  if (!rows.length) return '';
  const need = needOf(o, mode);
  const signed = (v) => (ok(v) ? `<span class="${v < 0 ? 'hist-neg' : ''}">${esc(rpM(v))}</span>` : '–');
  const line = (label, r, strong) => `<tr${strong ? ' class="hist-target"' : ''}><th scope="row">${esc(label)}</th><td>${signed(r.grown)}</td><td>${signed(r.rkaStep)}</td><td>${strong ? `<b>${esc(money(r.disb))}</b>` : esc(money(r.disb))}</td><td>${esc(money(r.perWd))}</td></tr>`;
  const body = rows.map((r) => line(`${shortMonth(r.month)}${r.complete ? '' : '*'}`, r, false)).join('')
    + (need ? line(need.short, { grown: need.growth, rkaStep: need.growth, disb: need.disb, perWd: need.perWd }, true) : '');
  return `<section class="outlook-ro outlook-hist" aria-labelledby="${cid}">
    <h3 id="${cid}">${icon('history', 15)}Riwayat ${esc(roName(o.roKey))}<button type="button" class="outlook-ro-table" data-hist>Lihat lengkap</button></h3>
    <div class="pop-table-wrap"><table class="pop-table hist-table"><thead><tr><th scope="col">Bulan</th><th scope="col">Tumbuh OS</th><th scope="col">Naik RKA</th><th scope="col">Disburse</th><th scope="col">Per hari kerja</th></tr></thead><tbody>${body}</tbody></table></div>
    ${rows.some((r) => !r.complete) ? '<p class="outlook-muted">* bulan berjalan, sampai tanggal data terakhir.</p>' : ''}
  </section>`;
}
