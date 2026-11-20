import { icon } from '../core/icons.js';
import { esc, fmt } from '../core/format.js';
import { ok } from '../core/values.js';
import { seg, onSeg } from '../core/controls.js';
import { empty, chartBox, canvasOf, legend, legendOf } from './widget-kit.js';
import { lineChart, bindLegend, C } from '../charts/charts.js';
import { outlook, simulate, simulateCurrent, simulateYear } from '../analytics/outlook.js';
import { rpM, pct, num, roName, monthName, monthYear } from '../analytics/wording.js';
import { outlookText, roRows, liftText, moreNames, tierOf, yearLabel, yearTable } from '../analytics/outlook-text.js';

const plainText = (h) => String(h || '').replace(/<[^>]+>/g, '');
const figureHtml = (f) => `<li><span class="outlook-figure-label">${esc(f.label)}</span><b class="outlook-figure-value">${f.value}</b>${f.sub ? `<small>${f.sub}</small>` : ''}</li>`;
const BASE_GRAY = '#86868B';

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
  const unit = mode === 'year' ? ' per bulan' : '';
  return `<section class="outlook-ro" aria-labelledby="${cid}">
    <h3 id="${cid}">${icon('bars-horizontal', 15)}Kebutuhan per RO${mode === 'year' ? ', disburse per bulan' : ''}</h3>
    ${summary ? `<p class="outlook-ro-sum">${esc(summary)}</p>` : ''}
    <ol class="outlook-ro-list">${rows.map((r) => {
      const t = tierOf(r.tier);
      const title = `${roName(r.ro)}: dibutuhkan ${ok(r.need) ? rpM(Math.max(0, r.need)) : '–'}${unit}, laju biasa ${rpM(r.base)}${unit}${mode === 'year' ? '' : `, laju terbaik ${ok(r.cap) ? rpM(r.cap) : '–'}`}, kenaikan ${liftText(r.lift)}, ${t.word}`;
      return `<li><button type="button" data-ro="${esc(r.ro)}" title="${esc(title)}">
        <span class="outlook-ro-name">${esc(roName(r.ro))}</span>
        <span class="outlook-ro-need">${esc(ok(r.need) ? rpM(Math.max(0, r.need)) : '–')}</span>
        <span class="lift-pill ${t.tone}" aria-label="${esc(`${liftText(r.lift)}, ${t.word}`)}">${esc(liftText(r.lift))}</span></button></li>`;
    }).join('')}</ol>
    <p class="outlook-tier-key"><span class="lift-pill good">laju biasa</span><span class="lift-pill warn">dalam kemampuan</span><span class="lift-pill bad">di atas kemampuan</span></p>
  </section>`;
}

function yearChart(api, o) {
  const y = o.year;
  const labels = y.base.path.map((p) => fmt.month(p.month, true));
  const series = [];
  if (y.need) series.push({ label: 'Jalur target', data: y.need.path.map((p) => p.os), color: C.accent, key: 'need' });
  series.push({ label: 'Laju terbaik', data: y.cap.path.map((p) => p.os), color: '#eb6834', key: 'cap', width: 2 });
  series.push({ label: 'Laju biasa', data: y.base.path.map((p) => p.os), color: BASE_GRAY, dash: true, key: 'base', width: 1.75 });
  const chart = lineChart(canvasOf(api, 'yc'), {
    labels, series, yAxis: true, values: 'last', beginAtZero: false,
    refs: ok(y.target) ? [{ axis: 'y', value: y.target, label: `Target ${rpM(y.target)}` }] : [],
    format: (v) => rpM(v), labelFormat: (v) => rpM(v), tickFormat: (v) => `${fmt.num(v / 1000, 0)} T`, title: (p) => `OS akhir ${p[0].label}`,
  });
  bindLegend(legendOf(api, 'ylg'), chart);
}

export function outlookWidget(resolve) {
  const state = { mode: '', target: null, yearTarget: null, lift: null, key: '' };
  return {
    title: 'Outlook dan strategi',
    desc: 'Proyeksi dari tren dan laju terbaik tiap RO: kebutuhan disburse bulan depan, sisa bulan berjalan, dan rencana setahun ke depan',
    icon: 'bulb', w: 12, h: 15, minW: 6, minH: 8, fit: true, variant: 'outlook',
    render(api) {
      let spec = null;
      try { spec = resolve(api.ctx); } catch (err) { console.warn(err); }
      if (!spec?.pm) { api.body.innerHTML = empty('Belum ada data Performance'); return; }
      const key = spec.ro || 'nasional';
      if (state.key !== key) { state.key = key; state.target = null; state.yearTarget = null; state.lift = null; }
      const o = outlook(spec.pm, { ro: spec.ro, real: spec.real, target: state.target, yearTarget: state.yearTarget });
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
      const liftDefault = mode === 'current' ? o.current.lift : mode === 'year' ? y.lift : n.lift;
      const lift = ok(state.lift) ? state.lift : (ok(liftDefault) ? Math.max(-0.3, Math.min(0.8, liftDefault)) : 0);
      const targetValue = mode === 'current' ? o.current.target : mode === 'year' ? y.target : n.target;
      const basis = mode === 'current'
        ? `${num(o.current.remWd)} hari kerja tersisa`
        : mode === 'year' ? `${num(y.wdPlan)} hari kerja di ${y.year}` : `${num(n.wd)} hari kerja di ${monthName(n.month)}`;
      const targetInput = mode === 'current' ? '' : `<label class="outlook-target"><span>${mode === 'year' ? `Target OS akhir ${y.year}` : 'Target OS'}</span><input type="number" inputmode="decimal" step="10" min="0" id="${api.cid('target')}" value="${ok(targetValue) ? Math.round(targetValue) : ''}"><span>M</span></label>`;
      const yearBlock = mode === 'year' ? `<section class="outlook-path" aria-labelledby="${api.cid('path')}">
          <header><h3 id="${api.cid('path')}">${icon('trend', 15)}Jalur OS sampai Desember ${y.year}</h3>${legend(api, 'ylg')}</header>
          ${chartBox(api, 'yc', `Jalur OS sampai akhir ${y.year}: target, laju terbaik, dan laju biasa`)}
        </section>` : '';
      const strategy = view.strategy.length ? `<section class="outlook-strategy" aria-labelledby="${api.cid('st')}">
          <h3 id="${api.cid('st')}">${icon('target', 15)}Strategi ${esc(mode === 'year' ? String(y.year) : '')}</h3>
          <ul class="outlook-notes">${view.strategy.map((t) => `<li>${t}</li>`).join('')}</ul>
        </section>` : '';
      api.body.innerHTML = `<div class="outlook">
        <div class="outlook-top">${modes}<span class="outlook-basis">${icon('calendar', 14)}${esc(basis)}</span></div>
        <p class="outlook-lead">${view.lead}</p>
        <ul class="outlook-figures">${view.figures.map(figureHtml).join('')}</ul>
        ${yearBlock}
        <div class="outlook-body">
          <section class="outlook-sim" aria-labelledby="${api.cid('sim')}">
            <header><h3 id="${api.cid('sim')}">Simulasi</h3>${targetInput}</header>
            <div class="outlook-slider">
              <label for="${api.cid('lift')}">Kenaikan disburse dari laju biasa${mode === 'year' ? ` sepanjang ${y.year}` : ''}</label>
              <input type="range" id="${api.cid('lift')}" min="-30" max="80" step="1" value="${Math.round(lift * 100)}">
              <output for="${api.cid('lift')}" id="${api.cid('lift-out')}">${esc(liftText(lift))}</output>
            </div>
            <dl class="outlook-result" id="${api.cid('result')}" aria-live="polite"></dl>
            <div class="outlook-meter" aria-hidden="true"><i id="${api.cid('meter')}"></i><span></span></div>
            <ul class="outlook-notes">${view.notes.map((t) => `<li>${t}</li>`).join('')}</ul>
          </section>
          ${strategy}
          <section class="outlook-quality" aria-labelledby="${api.cid('q')}">
            <h3 id="${api.cid('q')}">${icon('shield', 15)}Kualitas kredit</h3>
            ${view.quality.length ? `<ul class="outlook-notes">${view.quality.map((t) => `<li>${t}</li>`).join('')}</ul>` : '<p class="outlook-muted">Belum ada data NPL yang cukup.</p>'}
          </section>
          ${o.national ? roList(o, mode, api.cid('ro')) : ''}
        </div>
        <p class="outlook-foot">${icon('info', 14)}<span>${esc(footText(o, mode, baseMonths))}</span></p>
      </div>`;
      if (mode === 'year') yearChart(api, o);

      const resultEl = api.body.querySelector(`#${CSS.escape(api.cid('result'))}`);
      const meterEl = api.body.querySelector(`#${CSS.escape(api.cid('meter'))}`);
      const outEl = api.body.querySelector(`#${CSS.escape(api.cid('lift-out'))}`);
      const meter = (ach) => {
        meterEl.style.width = `${ok(ach) ? Math.min(100, Math.max(0, (ach - 0.95) / 0.07 * 100)) : 0}%`;
        meterEl.dataset.level = !ok(ach) ? 'warn' : ach >= 1 ? 'good' : ach >= 0.99 ? 'warn' : 'bad';
      };
      const paint = (v) => {
        outEl.textContent = liftText(v);
        if (mode === 'current') {
          const s = simulateCurrent(o, v);
          resultEl.innerHTML = `<div><dt>OS akhir ${esc(monthName(o.current.month))}</dt><dd>${esc(rpM(s.os))}</dd></div>
            <div><dt>Capaian RKA OS</dt><dd>${esc(pct(s.ach, 1))}</dd></div>
            <div><dt>Capaian guidance</dt><dd>${esc(pct(s.achDisb, 1))}</dd></div>`;
          meter(s.ach);
        } else if (mode === 'year') {
          const s = simulateYear(o, v);
          resultEl.innerHTML = `<div><dt>Disburse ${esc(String(y.year))}</dt><dd>${esc(rpM(s.disb))}</dd></div>
            <div><dt>OS akhir ${esc(String(y.year))}</dt><dd>${esc(rpM(s.os))}</dd></div>
            <div><dt>Capaian target</dt><dd>${esc(ok(s.ach) ? pct(s.ach, 1) : '–')}</dd></div>`;
          meter(s.ach);
        } else {
          const s = simulate(o, v);
          resultEl.innerHTML = `<div><dt>Disburse ${esc(monthName(n.month))}</dt><dd>${esc(rpM(s.disb))}</dd></div>
            <div><dt>OS akhir bulan</dt><dd>${esc(rpM(s.os))}</dd></div>
            <div><dt>Capaian target</dt><dd>${esc(ok(s.ach) ? pct(s.ach, 1) : '–')}</dd></div>`;
          meter(s.ach);
        }
      };
      paint(lift);
      const slider = api.body.querySelector(`#${CSS.escape(api.cid('lift'))}`);
      slider.addEventListener('input', () => { state.lift = Number(slider.value) / 100; paint(state.lift); });
      const targetEl = api.body.querySelector(`#${CSS.escape(api.cid('target'))}`);
      targetEl?.addEventListener('change', () => {
        const v = Number(String(targetEl.value).replace(',', '.'));
        const value = Number.isFinite(v) && v > 0 ? v : null;
        if (mode === 'year') state.yearTarget = value; else state.target = value;
        state.lift = null;
        this.render(api);
      });
      onSeg(api.body, api.cid('mode'), (v) => { state.mode = v; state.lift = null; this.render(api); });
      api.body.querySelectorAll('.outlook-ro-list [data-ro]').forEach((btn) => btn.addEventListener('click', () => api.set({ ro: btn.dataset.ro })));
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
          columns: ['Bulan', 'Hari kerja', 'Disburse laju biasa', 'Disburse jalur target', 'Disburse laju terbaik', 'OS laju biasa', 'OS jalur target', 'Catatan'],
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
  const trend = o.trend > 0.002 ? `naik sekitar ${pct(o.trend, 1)} per bulan` : o.trend < -0.002 ? `turun sekitar ${pct(-o.trend, 1)} per bulan` : 'datar';
  const method = `Laju biasa memakai tren disburse per hari kerja ${baseMonths} (${trend}, makin jauh makin diredam)${o.seasonUsed ? ', dikalikan pola bulanan yang dilunakkan separuh' : ''}. Laju terbaik diambil dari bulan-bulan terbaik dalam 6 bulan penuh terakhir (bulan terbaik kedua, atau lonjakan terbaik di atas tren), jadi pernah benar-benar dicapai.`;
  if (mode === 'current') return `${method} Untuk sisa bulan, dipakai juga pola hari kerja 3 bulan penuh terakhir: berapa bagian disburse dan runoff yang biasanya terjadi setelah hari kerja yang sama.`;
  if (mode === 'year') {
    const y = o.year;
    const wd = y.wdBasis === 'data' ? 'kolom Hari Kerja' : y.wdBasis === 'skb' ? 'kalender kerja Senin sampai Jumat dikurangi libur nasional dan cuti bersama SKB 3 Menteri' : 'Senin sampai Jumat di luar libur nasional bertanggal tetap';
    const src = {
      input: '', rka: `Target memakai RKA Desember ${y.year} dari data.`,
      'rka-growth': `Target awal memakai pertumbuhan yang sama dengan RKA ${y.year - 1} terhadap OS akhir ${y.year - 2}; isi kolom target bila RKA ${y.year} sudah ada.`,
      'rka-trend': `RKA Desember ${y.year - 1} belum ada di data, jadi target awal memakai laju RKA terakhir yang disetahunkan; isi kolom target bila RKA ${y.year} sudah ada.`,
      trend: `Belum ada RKA di data, jadi target awal memakai pertumbuhan OS tahun ini yang disetahunkan; isi kolom target bila RKA ${y.year} sudah ada.`,
    }[y.targetSource] || '';
    return `${method} Runoff memakai rasio 3 bulan terakhir. Hari kerja dari ${wd}. Bulan sebelum ${y.year} dihitung dengan laju biasa sebagai jembatan. ${src}`;
  }
  const n = o.next;
  return `${method} Hari kerja ${monthName(n.month)} dari ${n.wdBasis === 'data' ? 'kolom Hari Kerja' : n.wdBasis === 'skb' ? 'kalender kerja dikurangi libur nasional dan cuti bersama' : 'Senin sampai Jumat di luar libur nasional bertanggal tetap'}. ${n.targetSource === 'rka' ? `Target memakai RKA ${monthName(n.month)} dari data.` : n.targetSource === 'estimate' ? `RKA ${monthName(n.month)} belum ada di data, jadi target memakai kenaikan RKA rata-rata 3 bulan terakhir; isi kolom Target OS bila angka resmi sudah ada.` : ''}`;
}
