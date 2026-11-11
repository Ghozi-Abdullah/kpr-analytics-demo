import { icon } from '../core/icons.js';
import { esc, fmt } from '../core/format.js';
import { empty } from './widget-kit.js';
import { buildInsights, insightText, TONES } from '../analytics/insights.js';

const TONE_ORDER = ['negative', 'risk', 'positive', 'neutral'];

function card(it, i) {
  const id = `insight-${i}-${it.kind}`;
  const focus = it.focus
    ? `<button type="button" class="link insight-link" data-focus="${esc(it.focus.widget || '')}" data-goview="${esc(it.focus.view || '')}" data-params="${esc(JSON.stringify(it.focus.params || {}))}">Lihat datanya</button>`
    : '';
  return `<li class="insight tone-${it.tone}${i === 0 ? ' is-lead' : ''}">
    <article aria-labelledby="${id}">
      <header class="insight-head">
        <span class="insight-kind">${icon(it.icon, 15)}${esc(it.kindLabel)}</span>
        <span class="insight-tone">${esc(TONES[it.tone] || '')}</span>
      </header>
      <h3 class="insight-title" id="${id}">${it.headline}</h3>
      ${it.evidence.length ? `<ul class="insight-evidence">${it.evidence.map((e) => `<li>${e}</li>`).join('')}</ul>` : ''}
      ${it.implication ? `<p class="insight-implication"><span>Implikasi</span>${it.implication}</p>` : ''}
      <footer class="insight-foot">
        <span class="insight-confidence" data-level="${esc(it.confidence)}">Keyakinan ${esc(it.confidence)}${it.confidenceNote ? `, ${esc(it.confidenceNote)}` : ''}</span>
        ${focus}
      </footer>
    </article>
  </li>`;
}

function closeNote(items) {
  const c = items.find((x) => x.period === 'close');
  if (!c) return '';
  return `<p class="insights-note">${icon('calendar', 15)}<span>Bulan berjalan baru ${esc(String(c.liveDays))} hari kerja, jadi temuan utama memakai penutupan ${esc(fmt.month(c.closeMonth))}. Temuan bulan berjalan ditandai keyakinan sedang.</span></p>`;
}

function briefText(items, title, meta) {
  const lines = [title, ''];
  items.forEach((it, i) => lines.push(`${i + 1}. ${insightText(it)}`, ''));
  const at = meta?.generated_at;
  if (at) lines.push(`Sumber: KPR Analytics, data diperbarui ${fmt.date(at.slice(0, 10))} pukul ${at.slice(11, 16).replace(':', '.')}.`);
  return lines.join('\n').trim();
}

export function analysisWidget(resolve, { title = '', brief = false, limit = 0 } = {}) {
  const name = title || (brief ? 'Ringkasan eksekutif' : 'Insight analitik');
  return {
    title: name,
    desc: brief
      ? 'Temuan terpenting lintas Performance, Realisasi, dan Portofolio, diurutkan menurut dampaknya'
      : 'Temuan analitik dari data dan filter aktif, diurutkan menurut dampaknya',
    icon: 'sparkles', w: 12, h: brief ? 10 : 9, minW: 6, minH: 6, variant: 'analysis',
    render(api) {
      let spec = null;
      try { spec = resolve(api.ctx); } catch (err) { console.warn(err); }
      const items = spec ? buildInsights(spec.data, spec.scope, { sources: spec.sources, limit, perKind: brief ? 1 : 2 }) : [];
      if (!items.length) {
        api.body.innerHTML = empty('Belum ada temuan untuk filter ini', 'Temuan muncul bila ada perubahan yang cukup berarti dibanding periode pembanding.');
        return;
      }
      const tally = TONE_ORDER.map((t) => [t, items.filter((x) => x.tone === t).length]).filter(([, n]) => n);
      const where = api.ctx.roLabel || api.ctx.where || 'Nasional';
      const when = api.ctx.slice?.end?.tanggal ? fmt.date(api.ctx.slice.end.tanggal) : api.ctx.sel?.bulan ? fmt.month(api.ctx.sel.bulan) : '';
      api.sub(`${where}${when ? `, ${when}` : ''}. Dihitung dari data, tanpa AI. Urutan menurut besarnya dampak.`);
      api.body.innerHTML = `<div class="insights${brief ? ' is-brief' : ''}">
        ${closeNote(items)}
        <p class="insights-tally">${tally.map(([t, n]) => `<span class="tally tone-${t}"><i aria-hidden="true"></i>${n} ${esc(TONES[t].toLowerCase())}</span>`).join('')}</p>
        <ol class="insight-list">${items.map(card).join('')}</ol>
      </div>`;
      api.body.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-focus]');
        if (!btn) return;
        const view = btn.dataset.goview;
        let params = {};
        try { params = JSON.parse(btn.dataset.params || '{}'); } catch { params = {}; }
        if (view && view !== api.ctx.view) api.go(view, params, { focus: btn.dataset.focus });
        else api.focus(btn.dataset.focus);
      });
      const heading = `${name} KPR ${where}${when ? `, ${when}` : ''}`;
      api.tools({
        copy: () => briefText(items, heading, api.meta),
        table: () => ({
          title: name, columns: ['Urutan', 'Jenis', 'Arah', 'Temuan', 'Keyakinan'],
          rows: items.map((it, i) => [String(i + 1), it.kindLabel, TONES[it.tone], insightText(it), it.confidence]),
        }),
      });
    },
  };
}
