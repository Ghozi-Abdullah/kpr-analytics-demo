import { ok, byText } from './values.js';
import { esc } from './format.js';
import { icon } from './icons.js';

export function sparkline(values, { w = 80, h = 28, color = 'var(--accent)' } = {}) {
  const pts = values.map((v, i) => [i, v]).filter(([, v]) => ok(v));
  if (pts.length < 2) return `<svg class="sparkline" width="${w}" height="${h}" aria-hidden="true"></svg>`;
  const vals = pts.map(([, v]) => v);
  const min = Math.min(...vals); const max = Math.max(...vals); const span = max - min || 1;
  const n = Math.max(values.length - 1, 1);
  const x = (i) => 2 + (i / n) * (w - 6);
  const y = (v) => h - 3 - ((v - min) / span) * (h - 7);
  const line = pts.map(([i, v], k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const [li, lv] = pts.at(-1);
  const area = `${line}L${x(li).toFixed(1)} ${h}L${x(pts[0][0]).toFixed(1)} ${h}Z`;
  return `<svg class="sparkline" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="--sc:${color}" aria-hidden="true">
    <path class="sparkline-area" d="${area}"/><path class="sparkline-line" d="${line}"/><circle class="sparkline-dot" cx="${x(li).toFixed(1)}" cy="${y(lv).toFixed(1)}" r="2.6"/></svg>`;
}
export function openTable({ title, subtitle = '', columns, rows }) {
  const dlg = document.getElementById('table-dialog');
  const head = columns.map((c) => `<th scope="col">${esc(c)}</th>`).join('');
  const body = rows.map((r) => `<tr><th scope="row">${esc(r[0])}</th>${r.slice(1).map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('');
  dlg.innerHTML = `<div class="dialog-head"><div style="flex:1"><h2 id="table-dialog-title">${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
      <button class="icon-btn" type="button" data-close aria-label="Tutup">${icon('close')}</button></div>
    <div class="dialog-body"><div class="table-wrap" tabindex="0" role="region" aria-labelledby="table-dialog-title">
      <table class="data-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></div>`;
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.showModal();
}

export function openDetail({ title, subtitle = '', html, footer = '', tone = '' }) {
  let dlg = document.getElementById('detail-dialog');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'detail-dialog';
    dlg.className = 'detail-dialog';
    dlg.setAttribute('aria-labelledby', 'detail-dialog-title');
    dlg.setAttribute('closedby', 'any');
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => document.documentElement.classList.remove('is-modal'));
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      dlg.addEventListener('click', (e) => {
        if (e.target !== dlg) return;
        const box = dlg.getBoundingClientRect();
        const inside = e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
        if (!inside) dlg.close();
      });
    }
  }
  dlg.dataset.tone = tone;
  dlg.innerHTML = `<div class="dialog-head"><div style="flex:1"><h2 id="detail-dialog-title">${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
      <button class="icon-btn" type="button" data-close aria-label="Tutup">${icon('close')}</button></div>
    <div class="dialog-body detail-body" tabindex="-1">${html}</div>${footer ? `<div class="detail-foot">${footer}</div>` : ''}`;
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  if (!dlg.open) {
    document.documentElement.classList.add('is-modal');
    dlg.showModal();
  }
  dlg.querySelector('.detail-body').scrollTop = 0;
  return dlg;
}

export const emptyState = (title = 'Tidak ada data untuk filter ini', text = 'Coba ubah atau reset filter.') =>
  `<div class="empty"><b>${esc(title)}</b>${esc(text)}</div>`;

let toastTimer;
export function toast(message, action = null, ms = 6000) {
  const el = document.getElementById('toast');
  if (!el) return;
  clearTimeout(toastTimer);
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button" class="toast-act">${icon('undo', 15)}${esc(action.label)}</button>` : ''}`;
  el.classList.add('on');
  el.querySelector('.toast-act')?.addEventListener('click', () => { el.classList.remove('on'); action.run(); });
  toastTimer = setTimeout(() => el.classList.remove('on'), ms);
}
export function announce(text) {
  const el = document.getElementById('live-region');
  if (!el) return;
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = text; });
}
export function signalsHtml(items, emptyText = 'Semua KPI di filter ini sudah di atas 90% dari target.') {
  if (!items.length) return `<div class="signal-ok">${icon('check', 18)}<span>${esc(emptyText)}</span></div>`;
  return `<div class="signals">${items.map((s) => `<button type="button" class="signal ${s.level}"${s.action ? ` data-action="${esc(s.action)}"` : ''}>
      <span class="signal-icon">${icon(s.level === 'good' ? 'check' : 'alert', 16)}</span>
      <span class="signal-text"><span class="signal-title">${esc(s.title)}</span><span class="signal-sub">${esc(s.sub || '')}</span></span>
      ${s.badge ?? ''}</button>`).join('')}</div>`;
}

export function sortableTable({ id, columns, rows, sortKey, sortDir = 'desc', rowAttrs = () => '', caption }) {
  const col = columns.find((c) => c.key === sortKey) || columns[0];
  const val = col.sort || ((r) => r[col.key]);
  const sorted = [...rows].sort((a, b) => {
    const va = val(a); const vb = val(b);
    if (typeof va === 'string') return sortDir === 'asc' ? byText(va, vb) : byText(vb, va);
    return sortDir === 'asc' ? (va ?? Infinity) - (vb ?? Infinity) : (vb ?? -Infinity) - (va ?? -Infinity);
  });
  const head = columns.map((c) => {
    const sortAttr = c.key === col.key ? ` aria-sort="${sortDir === 'asc' ? 'ascending' : 'descending'}"` : '';
    return `<th scope="col"${sortAttr}><button type="button" data-sort="${c.key}">${esc(c.label)}${c.key === col.key ? icon(sortDir === 'asc' ? 'up' : 'down', 13) : ''}</button></th>`;
  }).join('');
  const body = sorted.map((r) => `<tr ${rowAttrs(r)}>${columns.map((c, i) => (i === 0
    ? `<th scope="row">${c.render ? c.render(r) : esc(r[c.key])}</th>`
    : `<td>${c.render ? c.render(r) : esc(r[c.key])}</td>`)).join('')}</tr>`).join('');
  return `<div class="table-wrap" tabindex="0" role="region" aria-label="${esc(caption)}"><table class="data-table" id="${id}">
    <thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
