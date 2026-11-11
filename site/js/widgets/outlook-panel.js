import { icon } from '../core/icons.js';
import { esc } from '../core/format.js';
import { ok } from '../core/values.js';
import { seg, onSeg } from '../core/controls.js';
import { empty } from './widget-kit.js';
import { outlook, simulate, simulateCurrent } from '../analytics/outlook.js';
import { rpM, pct, num, roName, monthName, monthYear } from '../analytics/wording.js';
import { outlookText, roRows, liftTone, liftText, moreNames, LIFT_WORD } from '../analytics/outlook-text.js';

const plainText = (h) => String(h || '').replace(/<[^>]+>/g, '');
const figureHtml = (f) => `<li><span class="outlook-figure-label">${esc(f.label)}</span><b class="outlook-figure-value">${f.value}</b>${f.sub ? `<small>${f.sub}</small>` : ''}</li>`;

function roList(o, mode, cid) {
  const rows = roRows(o, mode);
  if (!rows.length) return '';
  const heavy = rows.filter((r) => liftTone(r.lift) === 'bad').map((r) => roName(r.ro));
  const easy = rows.filter((r) => liftTone(r.lift) === 'good').map((r) => roName(r.ro));
  const summary = [
    heavy.length ? `${moreNames(heavy)} butuh kenaikan di atas 40%.` : '',
    easy.length ? `${moreNames(easy)} cukup dengan laju biasa.` : '',
  ].filter(Boolean).join(' ');
  return `<section class="outlook-ro" aria-labelledby="${cid}">
    <h3 id="${cid}">${icon('bars-horizontal', 15)}Kebutuhan per RO</h3>
    ${summary ? `<p class="outlook-ro-sum">${esc(summary)}</p>` : ''}
    <ol class="outlook-ro-list">${rows.map((r) => {
      const tone = liftTone(r.lift);
      return `<li><button type="button" data-ro="${esc(r.ro)}" title="${esc(`${roName(r.ro)}: laju biasa ${rpM(r.base)}, dibutuhkan ${ok(r.need) ? rpM(Math.max(0, r.need)) : '–'}, capaian laju biasa ${ok(r.ach) ? pct(r.ach, 1) : '–'}`)}">
        <span class="outlook-ro-name">${esc(roName(r.ro))}</span>
        <span class="outlook-ro-need">${esc(ok(r.need) ? rpM(Math.max(0, r.need)) : '–')}</span>
        <span class="lift-pill ${tone}" aria-label="${esc(`${liftText(r.lift)}, ${LIFT_WORD[tone]}`)}">${esc(liftText(r.lift))}</span></button></li>`;
    }).join('')}</ol>
  </section>`;
}

export function outlookWidget(resolve) {
  const state = { mode: 'next', target: null, lift: null, key: '' };
  return {
    title: 'Outlook dan kebutuhan',
    desc: 'Proyeksi laju biasa, disburse yang dibutuhkan untuk mencapai target, simulasi kenaikan, dan batas NPL',
    icon: 'bulb', w: 12, h: 13, minW: 6, minH: 8, fit: true, variant: 'outlook',
    render(api) {
      let spec = null;
      try { spec = resolve(api.ctx); } catch (err) { console.warn(err); }
      if (!spec?.pm) { api.body.innerHTML = empty('Belum ada data Performance'); return; }
      const key = spec.ro || 'nasional';
      if (state.key !== key) { state.key = key; state.target = null; state.lift = null; }
      const o = outlook(spec.pm, { ro: spec.ro, real: spec.real, target: state.target });
      if (!o) { api.body.innerHTML = empty('Belum cukup riwayat untuk proyeksi', 'Proyeksi butuh minimal dua bulan penuh sebelum bulan berjalan.'); return; }
      if (state.mode === 'current' && !o.current) state.mode = 'next';
      const mode = state.mode;
      const where = o.national ? 'nasional' : roName(o.roKey);
      const view = outlookText(o, mode, where);
      const n = o.next;
      const baseMonths = `${monthName(o.base[0])}–${monthYear(o.base.at(-1))}`;
      api.sub(`${o.national ? 'Nasional' : roName(o.roKey)}. Dasar: rata-rata ${baseMonths}.`);
      const modes = o.current
        ? seg({ name: api.cid('mode'), label: 'Periode outlook', small: true, value: mode,
          options: [{ value: 'next', label: `${monthYear(n.month)}` }, { value: 'current', label: `Sisa ${monthName(o.current.month)}` }] })
        : '';
      const liftDefault = mode === 'current' ? o.current.lift : n.lift;
      const lift = ok(state.lift) ? state.lift : (ok(liftDefault) ? Math.max(-0.3, Math.min(0.8, liftDefault)) : 0);
      const targetValue = mode === 'current' ? o.current.target : n.target;
      api.body.innerHTML = `<div class="outlook">
        <div class="outlook-top">${modes}<span class="outlook-basis">${icon('calendar', 14)}${esc(mode === 'current'
          ? `${num(o.current.remWd)} hari kerja tersisa`
          : `${num(n.wd)} hari kerja di ${monthName(n.month)}`)}</span></div>
        <p class="outlook-lead">${view.lead}</p>
        <ul class="outlook-figures">${view.figures.map(figureHtml).join('')}</ul>
        <div class="outlook-body">
          <section class="outlook-sim" aria-labelledby="${api.cid('sim')}">
            <header><h3 id="${api.cid('sim')}">Simulasi</h3>
              ${mode === 'next' ? `<label class="outlook-target"><span>Target OS</span><input type="number" inputmode="decimal" step="10" min="0" id="${api.cid('target')}" value="${ok(targetValue) ? Math.round(targetValue) : ''}"><span>M</span></label>` : ''}</header>
            <div class="outlook-slider">
              <label for="${api.cid('lift')}">Kenaikan disburse dari laju biasa</label>
              <input type="range" id="${api.cid('lift')}" min="-30" max="80" step="1" value="${Math.round(lift * 100)}">
              <output for="${api.cid('lift')}" id="${api.cid('lift-out')}">${esc(liftText(lift))}</output>
            </div>
            <dl class="outlook-result" id="${api.cid('result')}" aria-live="polite"></dl>
            <div class="outlook-meter" aria-hidden="true"><i id="${api.cid('meter')}"></i><span></span></div>
            <ul class="outlook-notes">${view.notes.map((t) => `<li>${t}</li>`).join('')}</ul>
          </section>
          <section class="outlook-quality" aria-labelledby="${api.cid('q')}">
            <h3 id="${api.cid('q')}">${icon('shield', 15)}Kualitas kredit</h3>
            ${view.quality.length ? `<ul class="outlook-notes">${view.quality.map((t) => `<li>${t}</li>`).join('')}</ul>` : '<p class="outlook-muted">Belum ada data NPL yang cukup.</p>'}
          </section>
          ${o.national ? roList(o, mode, api.cid('ro')) : ''}
        </div>
        <p class="outlook-foot">${icon('info', 14)}<span>${esc(mode === 'current'
          ? 'Laju biasa untuk sisa bulan memakai pola hari kerja 3 bulan penuh terakhir: berapa bagian disburse dan runoff yang biasanya terjadi setelah hari kerja yang sama.'
          : `Perkiraan memakai rata-rata disburse per hari kerja dan rasio runoff ${baseMonths}, serta ${n.wdFromData ? `hari kerja ${monthName(n.month)} dari kolom Hari Kerja` : `hari kerja ${monthName(n.month)} (Senin sampai Jumat di luar libur nasional bertanggal tetap)`}. ${n.targetSource === 'rka' ? `Target memakai RKA ${monthName(n.month)} dari data.` : n.targetSource === 'estimate' ? `RKA ${monthName(n.month)} belum ada di data, jadi target memakai kenaikan RKA rata-rata 3 bulan terakhir; isi kolom Target OS bila angka resmi sudah ada.` : ''}`)}</span></p>
      </div>`;

      const resultEl = api.body.querySelector(`#${CSS.escape(api.cid('result'))}`);
      const meterEl = api.body.querySelector(`#${CSS.escape(api.cid('meter'))}`);
      const outEl = api.body.querySelector(`#${CSS.escape(api.cid('lift-out'))}`);
      const paint = (v) => {
        outEl.textContent = liftText(v);
        if (mode === 'current') {
          const s = simulateCurrent(o, v);
          resultEl.innerHTML = `<div><dt>OS akhir ${esc(monthName(o.current.month))}</dt><dd>${esc(rpM(s.os))}</dd></div>
            <div><dt>Capaian RKA OS</dt><dd>${esc(pct(s.ach, 1))}</dd></div>
            <div><dt>Capaian guidance</dt><dd>${esc(pct(s.achDisb, 1))}</dd></div>`;
          meterEl.style.width = `${Math.min(100, Math.max(0, (s.ach - 0.95) / 0.07 * 100))}%`;
          meterEl.dataset.level = s.ach >= 1 ? 'good' : s.ach >= 0.99 ? 'warn' : 'bad';
        } else {
          const s = simulate(o, v);
          resultEl.innerHTML = `<div><dt>Disburse ${esc(monthName(n.month))}</dt><dd>${esc(rpM(s.disb))}</dd></div>
            <div><dt>OS akhir bulan</dt><dd>${esc(rpM(s.os))}</dd></div>
            <div><dt>Capaian target</dt><dd>${esc(ok(s.ach) ? pct(s.ach, 1) : '–')}</dd></div>`;
          meterEl.style.width = `${ok(s.ach) ? Math.min(100, Math.max(0, (s.ach - 0.95) / 0.07 * 100)) : 0}%`;
          meterEl.dataset.level = !ok(s.ach) ? 'warn' : s.ach >= 1 ? 'good' : s.ach >= 0.99 ? 'warn' : 'bad';
        }
      };
      paint(lift);
      const slider = api.body.querySelector(`#${CSS.escape(api.cid('lift'))}`);
      slider.addEventListener('input', () => { state.lift = Number(slider.value) / 100; paint(state.lift); });
      const targetEl = api.body.querySelector(`#${CSS.escape(api.cid('target'))}`);
      targetEl?.addEventListener('change', () => {
        const v = Number(String(targetEl.value).replace(',', '.'));
        state.target = Number.isFinite(v) && v > 0 ? v : null;
        state.lift = null;
        this.render(api);
      });
      if (modes) onSeg(api.body, api.cid('mode'), (v) => { state.mode = v; state.lift = null; this.render(api); });
      api.body.querySelectorAll('.outlook-ro-list [data-ro]').forEach((btn) => btn.addEventListener('click', () => api.set({ ro: btn.dataset.ro })));
      api.tools({
        copy: () => [
          `Outlook ${mode === 'current' ? `sisa ${monthYear(o.current.month)}` : monthYear(n.month)}, ${o.national ? 'Nasional' : roName(o.roKey)}`,
          '', plainText(view.lead), '',
          ...view.figures.map((f) => `${f.label}: ${plainText(f.value)}${f.sub ? ` (${plainText(f.sub)})` : ''}`),
          '', ...view.notes.map((t) => `- ${plainText(t)}`), ...view.quality.map((t) => `- ${plainText(t)}`),
        ].join('\n'),
        table: o.national ? () => ({
          title: 'Kebutuhan per RO', subtitle: mode === 'current' ? `Sisa ${monthYear(o.current.month)}` : monthYear(n.month),
          columns: ['RO', 'Laju biasa', 'Dibutuhkan', 'Kenaikan', 'Capaian laju biasa'],
          rows: roRows(o, mode).map((x) => [roName(x.ro), rpM(x.base), ok(x.need) ? rpM(Math.max(0, x.need)) : '–', liftText(x.lift), ok(x.ach) ? pct(x.ach, 1) : '–']),
        }) : null,
      });
    },
  };
}

