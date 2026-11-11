import { icon } from '../core/icons.js';
import { esc } from '../core/format.js';
import { empty } from './widget-kit.js';
import { buildInsights, insightText, TONES } from '../analytics/insights.js';

export function sectionWidget({ title, desc, view = '', action = '' }) {
  return {
    title, desc, icon: 'layers', w: 12, h: 1, minW: 6, minH: 1, maxH: 1, fit: true, variant: 'section',
    render(api) {
      const open = view && action
        ? `<button type="button" class="band-open" data-band-open>${esc(action)}${icon('open', 14)}</button>`
        : '';
      api.body.innerHTML = `<div class="band"><p class="band-desc">${esc(desc)}</p><span class="band-rule" aria-hidden="true"></span>${open}</div>`;
      api.body.querySelector('[data-band-open]')?.addEventListener('click', () => api.go(view, api.ctx.sel?.ro ? { ro: api.ctx.sel.ro } : {}));
    },
  };
}

export function explainWidget({ source, label, resolve }) {
  const title = `Penjelasan ${label}`;
  return {
    title, desc: `Poin penting dari chart ${label} di atasnya, dihitung langsung dari data`,
    icon: 'bulb', w: 12, h: 4, minW: 6, minH: 3, fit: true, variant: 'explain',
    render(api) {
      let spec = null;
      try { spec = resolve(api.ctx); } catch (err) { console.warn(err); }
      if (!spec) { api.body.innerHTML = empty(`Data ${label} belum tersedia`); return; }
      const items = buildInsights(spec.data, spec.scope, { sources: [source], limit: 3, perKind: 1 });
      if (!items.length) {
        api.body.innerHTML = empty(`Belum ada poin penting untuk ${label}`, 'Poin muncul bila ada perubahan yang cukup berarti dibanding periode pembanding.');
        return;
      }
      api.body.innerHTML = `<ol class="explain">${items.map((it) => `<li class="explain-item tone-${it.tone}">
          <p class="explain-kind">${icon(it.icon, 14)}<span>${esc(it.kindLabel)}</span><em>${esc(TONES[it.tone] || '')}</em></p>
          <p class="explain-head">${it.headline}</p>
          ${it.evidence[0] ? `<p class="explain-more">${it.evidence[0]}</p>` : ''}
        </li>`).join('')}</ol>`;
      api.tools({ copy: () => [title, '', ...items.map((it, i) => `${i + 1}. ${insightText(it)}`)].join('\n') });
    },
  };
}
