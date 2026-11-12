import { esc } from './format.js';
import { icon } from './icons.js';

export function pick({ id, label, options, value, on = false }) {
  const cur = options.find((o) => o.value === value) || options[0] || { value: '', label: '' };
  const items = options.map((o, i) => `<li role="option" id="${id}-o${i}" data-value="${esc(o.value)}" aria-selected="${o.value === cur.value}">
    <span>${esc(o.label)}</span>${o.value === cur.value ? icon('check', 16) : ''}</li>`).join('');
  return `<div class="picker${on ? ' on' : ''}" data-pick><span id="${id}-label">${esc(label)}</span>
    <button type="button" class="picker-button" id="${id}" value="${esc(cur.value)}" aria-haspopup="listbox" aria-expanded="false"
      aria-labelledby="${id}-label ${id}" popovertarget="${id}-menu">${esc(cur.label)}</button>
    <ul class="picker-menu" id="${id}-menu" popover="auto" role="listbox" tabindex="-1" aria-labelledby="${id}-label">${items}</ul></div>`;
}

function fitVertically(r, pop) {
  pop.style.maxHeight = '';
  const natural = pop.offsetHeight;
  const below = innerHeight - r.bottom - 14;
  const above = r.top - 14;
  const down = natural <= below || below >= above;
  const room = Math.max(140, down ? below : above);
  const h = Math.min(natural, room);
  if (natural > room) pop.style.maxHeight = `${Math.floor(room)}px`;
  pop.style.top = `${down ? r.bottom + 6 : Math.max(8, r.top - h - 6)}px`;
}

function placeBelow(anchor, pop, width) {
  const r = anchor.getBoundingClientRect();
  const w = Math.max(width || 0, r.width);
  pop.style.minWidth = `${Math.round(w)}px`;
  pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8))}px`;
  fitVertically(r, pop);
}

export function enhancePicks(root) {
  root.querySelectorAll('[data-pick]').forEach((wrap) => {
    const btn = wrap.querySelector('.picker-button');
    const menu = wrap.querySelector('.picker-menu');
    const items = [...menu.querySelectorAll('[role="option"]')];
    let active = Math.max(0, items.findIndex((li) => li.getAttribute('aria-selected') === 'true'));
    let typed = '';
    let typedAt = 0;
    let frame = 0;
    const setActive = (i) => {
      if (!items.length) return;
      active = Math.max(0, Math.min(items.length - 1, i));
      items.forEach((li, k) => li.classList.toggle('active', k === active));
      menu.setAttribute('aria-activedescendant', items[active].id);
      items[active].scrollIntoView({ block: 'nearest' });
    };
    const choose = (i) => {
      const li = items[i];
      if (!li) return;
      menu.hidePopover();
      btn.focus();
      if (li.dataset.value === btn.value) return;
      btn.value = li.dataset.value;
      btn.textContent = li.textContent.trim();
      btn.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const follow = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => placeBelow(wrap, menu, 200));
    };
    menu.addEventListener('toggle', (e) => {
      const open = e.newState === 'open';
      btn.setAttribute('aria-expanded', String(open));
      wrap.classList.toggle('open', open);
      if (open) {
        placeBelow(wrap, menu, 200);
        setActive(items.findIndex((li) => li.getAttribute('aria-selected') === 'true'));
        menu.focus({ preventScroll: true });
        addEventListener('scroll', follow, { passive: true, capture: true });
        addEventListener('resize', follow, { passive: true });
      } else {
        removeEventListener('scroll', follow, { capture: true });
        removeEventListener('resize', follow);
      }
    });
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); menu.showPopover(); }
    });
    menu.addEventListener('keydown', (e) => {
      const keys = { ArrowDown: 1, ArrowUp: -1, PageDown: 8, PageUp: -8 };
      if (keys[e.key]) { e.preventDefault(); setActive(active + keys[e.key]); return; }
      if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); setActive(e.key === 'Home' ? 0 : items.length - 1); return; }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); return; }
      if (e.key === 'Tab') { menu.hidePopover(); return; }
      if (e.key.length === 1 && /\S/.test(e.key)) {
        const now = performance.now();
        typed = now - typedAt > 700 ? e.key.toLowerCase() : typed + e.key.toLowerCase();
        typedAt = now;
        const order = [...items.slice(active + (typed.length === 1 ? 1 : 0)), ...items.slice(0, active + (typed.length === 1 ? 1 : 0))];
        const hit = order.find((li) => li.textContent.trim().toLowerCase().startsWith(typed));
        if (hit) setActive(items.indexOf(hit));
      }
    });
    menu.addEventListener('pointermove', (e) => {
      const li = e.target.closest('[role="option"]');
      if (li && items.indexOf(li) !== active) setActive(items.indexOf(li));
    });
    menu.addEventListener('click', (e) => {
      const li = e.target.closest('[role="option"]');
      if (li) choose(items.indexOf(li));
    });
  });
}

export function seg({ name, label, options, value, small = false }) {
  return `<fieldset class="segmented${small ? ' sm' : ''}"><legend>${esc(label)}</legend>${options.map((o) => `
    <label><input type="radio" name="${name}" value="${esc(o.value)}"${o.value === value ? ' checked' : ''}><span>${esc(o.label)}</span></label>`).join('')}</fieldset>`;
}
export function onSeg(root, name, fn) {
  root.querySelectorAll(`input[name="${name}"]`).forEach((el) => el.addEventListener('change', (e) => fn(e.target.value)));
}

export function searchPick({ id, label, value, allLabel }) {
  return `<div class="picker${value ? ' on' : ''}"><span>${esc(label)}</span>
    <button type="button" class="picker-button" id="${id}" aria-haspopup="listbox" aria-expanded="false" popovertarget="${id}-pop">${esc(value || allLabel)}</button>
    <div class="picker-popover" id="${id}-pop" popover="auto">
      <label class="picker-search">${icon('search', 16)}<input type="search" id="${id}-q" placeholder="Cari ${esc(label.toLowerCase())}"
        autocomplete="off" role="combobox" aria-controls="${id}-list" aria-expanded="true" aria-autocomplete="list" aria-label="Cari ${esc(label.toLowerCase())}"></label>
      <div class="picker-count" id="${id}-count" aria-live="polite"></div>
      <ul class="picker-list" id="${id}-list" role="listbox" aria-label="${esc(label)}"></ul>
    </div></div>`;
}

export function bindSearchPick({ id, options, value, allLabel, onChange }) {
  const btn = document.getElementById(id);
  const pop = document.getElementById(`${id}-pop`);
  const q = document.getElementById(`${id}-q`);
  const list = document.getElementById(`${id}-list`);
  const count = document.getElementById(`${id}-count`);
  if (!btn || !pop) return;
  const all = [{ value: '', label: allLabel }, ...options.map((o) => ({ value: o, label: o }))];
  let shown = [];
  let active = 0;

  const draw = () => {
    const term = q.value.trim().toLowerCase();
    const matches = term ? all.filter((o) => o.value && o.label.toLowerCase().includes(term)) : all;
    shown = matches.slice(0, 250);
    active = Math.max(0, shown.findIndex((o) => o.value === value));
    list.innerHTML = shown.length
      ? shown.map((o, i) => `<li role="option" id="${id}-o${i}" data-i="${i}" aria-selected="${o.value === value}"${i === active ? ' class="active"' : ''}>
          <span>${esc(o.label)}</span>${o.value === value ? icon('check', 16) : ''}</li>`).join('')
      : '<li class="picker-empty" aria-disabled="true">Tidak ditemukan</li>';
    count.textContent = term ? `${matches.length} hasil` : `${options.length} pilihan`;
    q.setAttribute('aria-activedescendant', shown.length ? `${id}-o${active}` : '');
  };
  const setActive = (i) => {
    if (!shown.length) return;
    active = (i + shown.length) % shown.length;
    list.querySelectorAll('li').forEach((li, k) => li.classList.toggle('active', k === active));
    q.setAttribute('aria-activedescendant', `${id}-o${active}`);
    list.querySelector(`#${CSS.escape(`${id}-o${active}`)}`)?.scrollIntoView({ block: 'nearest' });
  };
  const choose = (i) => {
    const o = shown[i];
    if (!o) return;
    pop.hidePopover();
    if (o.value !== value) onChange(o.value);
  };

  pop.addEventListener('toggle', (e) => {
    btn.setAttribute('aria-expanded', String(e.newState === 'open'));
    if (e.newState !== 'open') return;
    const r = btn.closest('.picker').getBoundingClientRect();
    const width = Math.min(300, innerWidth - 16);
    pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - width - 8))}px`;
    q.value = '';
    draw();
    fitVertically(r, pop);
    q.focus();
  });
  q.addEventListener('input', draw);
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    if (e.key === 'Enter') { e.preventDefault(); choose(active); }
  });
  list.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-i]');
    if (li) choose(Number(li.dataset.i));
  });
}
