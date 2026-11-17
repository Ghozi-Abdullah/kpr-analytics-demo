import { icon } from './icons.js';

const KEY = 'kpr.dock.';
const read = (k) => { try { return localStorage.getItem(KEY + k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(KEY + k, v); } catch {} };
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createDock(parent = document.body) {
  let el = null;
  let key = '';
  let open = false;
  let spec = null;

  function build() {
    el = document.createElement('aside');
    el.className = 'dock';
    el.innerHTML = `<button class="dock-pill" type="button" aria-expanded="false" aria-controls="dock-panel"></button>
      <section class="dock-panel" id="dock-panel" role="region" aria-labelledby="dock-title" hidden>
        <header class="dock-head">
          <span class="dock-ico" aria-hidden="true"></span>
          <div class="dock-titles"><h2 id="dock-title"></h2><p class="dock-sub"></p></div>
          <button class="icon-btn dock-min" type="button" aria-label="Kecilkan">${icon('chevron-down', 18)}</button>
        </header>
        <div class="dock-body"></div>
      </section>`;
    parent.append(el);
    el.querySelector('.dock-pill').addEventListener('click', () => setOpen(true, true));
    el.querySelector('.dock-min').addEventListener('click', () => setOpen(false, true));
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false, true); } });
  }

  function setOpen(on, user = false) {
    if (!el) return;
    open = on;
    const panel = el.querySelector('.dock-panel');
    const pill = el.querySelector('.dock-pill');
    el.classList.toggle('is-open', on);
    pill.setAttribute('aria-expanded', String(on));
    panel.hidden = !on;
    pill.hidden = on;
    if (user) {
      write(key, on ? 'open' : 'min');
      if (on) el.querySelector('.dock-min').focus({ preventScroll: true });
      else pill.focus({ preventScroll: true });
      if (on && !calm()) {
        panel.classList.remove('is-in');
        void panel.offsetWidth;
        panel.classList.add('is-in');
      }
    }
  }

  function show(next) {
    if (!next) { hide(); return; }
    const fresh = !el || key !== next.key;
    if (!el) build();
    key = next.key;
    spec = next;
    el.dataset.tone = next.tone || '';
    el.setAttribute('aria-label', next.label || next.title);
    el.querySelector('.dock-pill').innerHTML = `<span class="dock-pill-ico" aria-hidden="true">${icon(next.icon || 'alert', 18)}</span><span class="dock-pill-text">${next.pill}</span>`;
    el.querySelector('.dock-ico').innerHTML = icon(next.icon || 'alert', 18);
    el.querySelector('#dock-title').textContent = next.title;
    el.querySelector('.dock-sub').innerHTML = next.sub || '';
    const body = el.querySelector('.dock-body');
    const keep = new Set([...body.querySelectorAll('[aria-expanded="true"][data-group]')].map((b) => b.dataset.group));
    const scroll = body.scrollTop;
    body.innerHTML = next.body;
    body.querySelectorAll('[data-group]').forEach((b) => {
      const list = b.parentElement.querySelector('.dock-sublist');
      const set = (on) => { b.setAttribute('aria-expanded', String(on)); if (list) list.hidden = !on; };
      set(keep.has(b.dataset.group));
      b.addEventListener('click', () => set(b.getAttribute('aria-expanded') !== 'true'));
    });
    body.scrollTop = scroll;
    next.bind?.(body);
    document.body.classList.add('has-dock');
    if (fresh) {
      const saved = read(key);
      setOpen(saved ? saved === 'open' : !!next.openFirst);
      if (!el.classList.contains('is-open') && next.attention && !calm()) {
        el.classList.remove('is-ping');
        void el.offsetWidth;
        el.classList.add('is-ping');
      }
    }
  }

  function hide() {
    el?.remove();
    el = null;
    key = '';
    spec = null;
    document.body.classList.remove('has-dock');
  }

  return { show, hide, get spec() { return spec; } };
}
