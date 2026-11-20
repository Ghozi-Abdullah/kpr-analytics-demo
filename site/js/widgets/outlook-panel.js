import { icon } from '../core/icons.js';
import { esc, fmt } from '../core/format.js';
import { ok } from '../core/values.js';
import { seg, onSeg } from '../core/controls.js';
import { empty, chartBox, canvasOf, legend, legendOf } from './widget-kit.js';
import { lineChart, bindLegend, C } from '../charts/charts.js';
import { outlook } from '../analytics/outlook.js';
import { rpM, pct, num, roName, monthName, monthYear } from '../analytics/wording.js';
import { outlookText, roRows, liftText, moreNames, tierOf, yearLabel, yearTable, yearRoTable, yearLevers, yearBrief } from '../analytics/outlook-text.js';
import { openTable } from '../core/ui.js';
import { simSection, bindSim } from './outlook-sim.js';
import { openRoHistory, historyMini } from './outlook-history.js';

const plainText = (h) => String(h || '').replace(/<[^>]+>/g, '');
const figureHtml = (f) => `<li><span class="outlook-figure-label">${esc(f.label)}</span><b class="outlook-figure-value">${f.value}</b>${f.sub ? `<small>${f.sub}</small>` : ''}</li>`;
const BASE_GRAY = '#86868B';
const BEST_ORANGE = '#eb6834';

function roList(o, mode, cid) {
  const rows = roRows(o, mode);
  if (!rows.length) return '';
  const names = (t) => rows.filter((r) => r.tier === t).map((r) => roName(r.ro));
  const hard = names('beyond');
  const fit = names('stretch');
  const easy = names('base');
  const summary = [
    hard.length ? `${moreNames(hard)} di atas laju terbaiknya.` : '',
    fit.length ? `${moreNames(fit)} butuh dorongan, masih dalam kemampuan.` : '',
    easy.length ? `${moreNames(easy)} cukup dengan laju biasa.` : '',
  ].filter(Boolean).join(' ');
  const year = mode === 'year';
  const unit = year ? ' per bulan' : '';
  return `<section class="outlook-ro" aria-labelledby="${cid}">
    <h3 id="${cid}">${icon('bars-horizontal', 15)}${year ? 'Pembagian target per RO' : 'Kebutuhan per RO'}${year ? '<button type="button" class="outlook-ro-table" data-ro-table>Tabel per RO</button>' : ''}</h3>
    ${summary ? `<p class="outlook-ro-sum">${esc(summary)} Klik RO untuk melihat riwayat per bulan.</p>` : ''}
    <ol class="outlook-ro-list">${rows.map((r) => {
      const t = tierOf(r.tier);
      const title = `${roName(r.ro)}: dibutuhkan ${ok(r.need) ? rpM(Math.max(0, r.need)) : '–'}${unit}, laju biasa ${rpM(r.base)}${unit}, kenaikan ${liftText(r.lift)}, ${t.word}. Klik untuk riwayat per bulan`;
      return `<li><button type="button" data-ro="${esc(r.ro)}" title="${esc(title)}" aria-haspopup="dialog">
        <span class="outlook-ro-name">${esc(roName(r.ro))}</span>
        <span class="outlook-ro-need">${esc(ok(r.need) ? rpM(Math.max(0, r.need)) : '–')}</span>
        <span class="lift-pill ${t.tone}" aria-label="${esc(`${liftText(r.lift)}, ${t.word}`)}">${esc(liftText(r.lift))}</span></button></li>`;
    }).join('')}</ol>
    <p class="outlook-tier-key"><span class="lift-pill good">laju biasa</span><span class="lift-pill warn">dalam kemampuan</span><span class="lift-pill bad">di atas kemampuan</span></p>
  </section>`;
}

function strategyHtml(api, o) {
  const y = o.year;
  const levers = yearLevers(o);
  const brief = yearBrief(o);
  const tone = (a) => (!ok(a) ? '' : a >= 1 ? 'good' : a >= 0.99 ? 'warn' : 'bad');
  return `<section class="outlook-strategy" aria-labelledby="${api.cid('st')}">
    <h3 id="${api.cid('st')}">${icon('bulb', 15)}Strategi ${y.year}</h3>
    ${brief[0] ? `<p class="outlook-strategy-lead">${brief[0]}</p>` : ''}
    <table class="lever-table">
      <thead><tr><th scope="col">Cara</th><th scope="col">OS akhir ${y.year}</th><th scope="col">Capaian</th></tr></thead>
      <tbody>${levers.map((r) => `<tr><th scope="row">${esc(r.label)}<small>${esc(r.sub)}</small></th>
        <td>${esc(rpM(r.os))}${r.add > 0 ? `<small>+${esc(rpM(r.add))}</small>` : ''}</td>
        <td>${ok(r.ach) ? `<span class="lift-pill ${tone(r.ach)}">${esc(pct(r.ach, 1))}</span>` : '–'}</td></tr>`).join('')}</tbody>
    </table>
    ${brief.length > 1 ? `<ul class="outlook-notes">${brief.slice(1).map((t) => `<li>${t}</li>`).join('')}</ul>` : ''}
  </section>`;
}

function yearChart(api, o) {
  const y = o.year;
  const labels = y.base.path.map((p) => fmt.month(p.month, true));
  const series = [];
  if (y.need) series.push({ label: 'Jalur target', data: y.need.path.map((p) => p.os), color: C.accent, key: 'need' });
  series.push({ label: 'Laju terbaik', data: y.cap.path.map((p) => p.os), color: BEST_ORANGE, key: 'cap', width: 2 });
  series.push({ label: 'Laju biasa', data: y.base.path.map((p) => p.os), color: BASE_GRAY, dash: true, key: 'base', width: 1.75 });
  const chart = lineChart(canvasOf(api, 'yc'), {
    labels, series, yAxis: true, values: false, beginAtZero: false,
    refs: ok(y.target) ? [{ axis: 'y', value: y.target, label: `Target ${rpM(y.target)}` }] : [],
    format: (v) => rpM(v), labelFormat: (v) => rpM(v), tickFormat: (v) => `${fmt.num(v / 1000, 0)} T`, title: (p) => `OS akhir ${p[0].label}`,
  });
  bindLegend(legendOf(api, 'ylg'), chart);
}

export function outlookWidget(resolve) {
  const state = { mode: '', key: '', yearTarget: null, os: null, npl: null, sml: null };
  const clearSim = () => { state.os = null; state.npl = null; state.sml = null; };
  return {
    title: 'Outlook dan strategi',
    desc: 'Proyeksi dari tren dan laju terbaik tiap RO: kebutuhan disburse sesuai RKA, simulasi target OS, NPL, dan SML, serta rencana setahun ke depan',
    icon: 'bulb', w: 12, h: 16, minW: 6, minH: 8, fit: true, variant: 'outlook',
    render(api) {
      let spec = null;
      try { spec = resolve(api.ctx); } catch (err) { console.warn(err); }
      if (!spec?.pm) { api.body.innerHTML = empty('Belum ada data Performance'); return; }
      const key = spec.ro || 'nasional';
      if (state.key !== key) { state.key = key; state.yearTarget = null; clearSim(); }
      const o = outlook(spec.pm, { ro: spec.ro, real: spec.real, yearTarget: state.yearTarget });
      if (!o) { api.body.innerHTML = empty('Belum cukup riwayat untuk proyeksi', 'Proyeksi butuh minimal dua bulan penuh sebelum bulan berjalan.'); return; }
      if (!state.mode) state.mode = o.year && Number(o.cur.month.slice(5, 7)) >= 10 ? 'year' : 'next';
      if (state.mode === 'current' && !o.current) state.mode = 'next';
      if (state.mode === 'year' && !o.year) state.mode = 'next';
      const mode = state.mode;
      const where = o.national ? 'nasional' : roName(o.roKey);
      const view = outlookText(o, mode, where);
      const n = o.next;
      const y = o.year;
      const baseMonths = `${monthName(o.base[0])}–${monthYear(o.base.at(-1))}`;
      api.sub(`${o.national ? 'Nasional' : roName(o.roKey)}. Dasar: tren ${baseMonths}${o.seasonUsed ? ' dan pola bulanan' : ''}.`);
      const options = [];
      if (o.current) options.push({ value: 'current', label: `Sisa ${monthName(o.current.month)}` });
      options.push({ value: 'next', label: monthYear(n.month) });
      if (y) options.push({ value: 'year', label: yearLabel(y) });
      const modes = seg({ name: api.cid('mode'), label: 'Periode outlook', small: true, value: mode, options });
      const basis = mode === 'current'
        ? `${num(o.current.remWd)} hari kerja tersisa`
        : mode === 'year' ? `${num(y.wdPlan)} hari kerja di ${y.year}` : `${num(n.wd)} hari kerja di ${monthName(n.month)}`;
      const sim = simSection(api, o, mode, state);
      const side = o.national ? roList(o, mode, api.cid('ro')) : historyMini(spec.pm, o, mode, api.cid('hist'));
      const yearRow = mode === 'year' ? `<div class="outlook-row">
          <section class="outlook-path" aria-labelledby="${api.cid('path')}">
            <header><h3 id="${api.cid('path')}">${icon('trend', 15)}Jalur OS sampai Desember ${y.year}</h3>${legend(api, 'ylg')}</header>
            ${chartBox(api, 'yc', `Jalur OS sampai akhir ${y.year}: target, laju terbaik, dan laju biasa`)}
          </section>
          ${strategyHtml(api, o)}
        </div>` : '';
      api.body.innerHTML = `<div class="outlook">
        <div class="outlook-top">${modes}<span class="outlook-basis">${icon('calendar', 14)}${esc(basis)}</span></div>
        <p class="outlook-lead">${view.lead}</p>
        <ul class="outlook-figures">${view.figures.map(figureHtml).join('')}</ul>
        ${yearRow}
        <div class="outlook-row${side ? '' : ' solo'}">${sim.html}${side}</div>
        <p class="outlook-foot">${icon('info', 14)}<span>${esc(footText(o, mode, baseMonths))}</span></p>
      </div>`;
      if (mode === 'year') yearChart(api, o);

      const focusOs = () => api.body.querySelector(`#${CSS.escape(api.cid('sim-os'))}`)?.focus();
      bindSim(api, o, mode, state, sim, {
        onCommit: (v) => { state.yearTarget = v; this.render(api); focusOs(); },
        onReset: () => { state.yearTarget = null; this.render(api); },
      });
      onSeg(api.body, api.cid('mode'), (v) => { state.mode = v; clearSim(); this.render(api); });
      const split = mode === 'year' ? y.split : null;
      api.body.querySelectorAll('.outlook-ro-list [data-ro]').forEach((btn) => btn.addEventListener('click', () => openRoHistory({
        pm: spec.pm, real: spec.real, ro: btn.dataset.ro, mode,
        splitRow: split?.rows.find((r) => r.ro === btn.dataset.ro) || null, wdPlan: y?.wdPlan,
        onOpen: (ro) => api.set({ ro }),
      })));
      api.body.querySelector('[data-hist]')?.addEventListener('click', () => openRoHistory({ pm: spec.pm, real: spec.real, ro: o.roKey, mode }));
      api.body.querySelector('[data-ro-table]')?.addEventListener('click', () => openTable({
        title: `Pembagian target ${y.year} per RO`, subtitle: ok(y.target) ? `Target OS nasional akhir ${y.year} ${rpM(y.target)}` : '',
        columns: ['RO', `OS akhir ${y.year - 1} (proyeksi)`, `Target OS akhir ${y.year}`, 'Tumbuh', 'Disburse per bulan', 'Kenaikan dari laju biasa', 'Status'],
        rows: yearRoTable(o),
      }));
      const periodName = mode === 'current' ? `sisa ${monthYear(o.current.month)}` : mode === 'year' ? yearLabel(y).toLowerCase() : monthYear(n.month);
      api.tools({
        copy: () => [
          `Outlook ${periodName}, ${o.national ? 'Nasional' : roName(o.roKey)}`,
          '', plainText(view.lead), '',
          ...view.figures.map((f) => `${f.label}: ${plainText(f.value)}${f.sub ? ` (${plainText(f.sub)})` : ''}`),
          '', ...view.strategy.map((t) => `- ${plainText(t)}`), ...view.notes.map((t) => `- ${plainText(t)}`), ...view.quality.map((t) => `- ${plainText(t)}`),
        ].join('\n'),
        png: mode === 'year' ? api.cid('yc') : null,
        table: mode === 'year' ? () => ({
          title: `Rencana bulanan ${y.year}`, subtitle: `${o.national ? 'Nasional' : roName(o.roKey)}${ok(y.target) ? `, target OS akhir ${y.year} ${rpM(y.target)}` : ''}`,
          columns: ['Bulan', 'Hari kerja', 'Disburse laju biasa', 'Disburse jalur target', 'Target tumbuh OS', 'OS laju biasa', 'OS jalur target', 'Catatan'],
          rows: yearTable(o),
        }) : o.national ? () => ({
          title: 'Kebutuhan per RO', subtitle: periodName,
          columns: ['RO', 'Laju biasa', 'Dibutuhkan', 'Kenaikan', 'Status', 'Capaian laju biasa'],
          rows: roRows(o, mode).map((x) => [roName(x.ro), rpM(x.base), ok(x.need) ? rpM(Math.max(0, x.need)) : '–', liftText(x.lift), tierOf(x.tier).short, ok(x.ach) ? pct(x.ach, 1) : '–']),
        }) : null,
      });
    },
  };
}

function footText(o, mode, baseMonths) {
  const how = `Laju biasa = disburse per hari kerja menurut tren ${baseMonths}. Laju terbaik = bulan-bulan terbaik dalam 6 bulan itu. Runoff (angsuran dan pelunasan) = rata-rata 3 bulan terakhir, ${pct(o.runRate, 2)} dari OS per bulan. NPL dan SML: target dari kolom RKA; bila belum ada, rasio RKA bulan ini dikali OS target.`;
  if (mode === 'current') return `Target tumbuh = RKA OS akhir bulan ini dikurangi RKA akhir bulan lalu, dari kolom RKA. Disburse dibutuhkan = sisa target tumbuh + perkiraan runoff sisa bulan. ${how}`;
  if (mode === 'year') {
    const y = o.year;
    const src = {
      input: 'Target OS memakai angka simulasi.',
      rka: `Target = RKA Desember ${y.year} dari kolom RKA.`,
      'rka-growth': `RKA ${y.year} belum ada, jadi target awal = proyeksi OS akhir ${y.year - 1} ditambah pertumbuhan yang sama dengan RKA ${y.year - 1} (${pct(y.growthRef, 1)}).`,
      'rka-trend': `RKA Desember ${y.year - 1} belum ada, jadi target awal memakai laju RKA terakhir yang disetahunkan (${pct(y.growthRef, 1)}).`,
      trend: `Belum ada RKA di data, jadi target awal memakai pertumbuhan OS tahun ini yang disetahunkan (${pct(y.growthRef, 1)}).`,
    }[y.targetSource] || '';
    return `${src} Tiap bulan: OS bulan lalu + disburse − runoff. ${how} Hari kerja ${y.year} dari kalender libur nasional dan cuti bersama.`;
  }
  const n = o.next;
  const target = n.targetSource === 'rka' ? `Target tumbuh = RKA OS ${monthName(n.month)} dikurangi RKA ${monthName(o.cur.month)}, dari kolom RKA.`
    : `RKA ${monthName(n.month)} belum ada di data, jadi target tumbuh = kenaikan RKA rata-rata 3 bulan terakhir.`;
  return `${target} Disburse dibutuhkan = target tumbuh + perkiraan runoff. ${how}`;
}
