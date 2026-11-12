import { icon } from '../core/icons.js';
import { esc } from '../core/format.js';
import { announce } from '../core/ui.js';

const yieldToMain = () => ('scheduler' in window && 'yield' in window.scheduler ? window.scheduler.yield() : new Promise((resolve) => setTimeout(resolve, 0)));

export const COLS = 12;
export const ROW = 44;
export const GAP = 12;
const STACK_BELOW = 720;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const collides = (a, b) => a.id !== b.id && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const bottomOf = (items) => items.reduce((m, i) => Math.max(m, i.y + i.h), 0);
const sameLayout = (a, b) => a.length === b.length && a.every((i) => {
  const j = b.find((k) => k.id === i.id);
  return j && j.x === i.x && j.y === i.y && j.w === i.w && j.h === i.h;
});

export function compact(items, fixedId = null, vacated = null) {
  const out = items.map((i) => ({ ...i }));
  const fixed = fixedId ? out.find((i) => i.id === fixedId) : null;
  const rest = out.filter((i) => i !== fixed).sort((a, b) => a.y - b.y || a.x - b.x);
  const placed = [];
  if (fixed) {
    fixed.w = clamp(fixed.w, 1, COLS);
    fixed.x = clamp(fixed.x, 0, COLS - fixed.w);
    fixed.y = Math.max(0, fixed.y);
    placed.push(fixed);
  }
  for (const it of rest) {
    it.w = clamp(it.w, 1, COLS);
    it.x = clamp(it.x, 0, COLS - it.w);
    it.y = Math.max(0, it.y);
    while (it.y > 0 && !placed.some((p) => collides({ ...it, y: it.y - 1 }, p))) it.y -= 1;
    if (vacated && fixed && collides(it, fixed)) {
      const cand = { ...it, x: clamp(vacated.x, 0, COLS - it.w), y: vacated.y };
      if (!placed.some((p) => collides(cand, p))) { it.x = cand.x; it.y = cand.y; }
    }
    let hit = placed.find((p) => collides(it, p));
    while (hit) {
      it.y = hit.y + hit.h;
      hit = placed.find((p) => collides(it, p));
    }
    placed.push(it);
  }
  return out;
}
export const settle = (items, fixedId, vacated) => compact(compact(items, fixedId, vacated));

export class Board {
  constructor(root, { defs, render, destroy, commit }) {
    Object.assign(this, { root, defs, renderFn: render, destroyFn: destroy, commitFn: commit });
    this.items = [];
    this.els = new Map();
    this.editing = false;
    this.stack = false;
    this.colW = 80;
    this.session = null;
    this.preview = null;
    root.classList.add('board');
    root.innerHTML = '<div class="board-cells" aria-hidden="true"></div><div class="panel-placeholder" aria-hidden="true" hidden></div>';
    this.ph = root.querySelector('.panel-placeholder');
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    this.onDown = this.onDown.bind(this);
    this.onKey = this.onKey.bind(this);
    this.onClick = this.onClick.bind(this);
    root.addEventListener('pointerdown', this.onDown);
    root.addEventListener('keydown', this.onKey);
    root.addEventListener('click', this.onClick);
    this.ro = new ResizeObserver(() => this.measure());
    this.ro.observe(root);
    this.measure();
  }

  measure() {
    const w = this.root.clientWidth;
    if (!w) return;
    const stack = w < STACK_BELOW && !this.editing;
    if (stack !== this.stack) {
      this.stack = stack;
      this.root.classList.toggle('stack', stack);
      this.root.dispatchEvent(new CustomEvent('board:stack', { detail: stack }));
    }
    this.colW = (w - GAP * (COLS - 1)) / COLS;
    this.root.style.setProperty('--colw', `${this.colW}px`);
    this.paint(this.preview || this.items);
  }

  paint(items = this.items) {
    const order = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
    order.forEach((it, i) => {
      const el = this.els.get(it.id);
      if (!el) return;
      el.style.setProperty('--x', it.x);
      el.style.setProperty('--y', it.y);
      el.style.setProperty('--w', it.w);
      el.style.setProperty('--h', it.h);
      el.style.order = String(i);
      el.classList.toggle('wide', it.w >= 7);
    });
    this.root.style.setProperty('--rows', Math.max(1, bottomOf(items) + (this.editing ? 3 : 0)));
  }

  showPh(it) {
    if (!it) { this.ph.hidden = true; return; }
    this.ph.hidden = false;
    for (const k of ['x', 'y', 'w', 'h']) this.ph.style.setProperty(`--${k}`, it[k]);
  }

  setItems(items) {
    const valid = items.filter((i) => this.defs.has(i.id));
    this.items = compact(valid.map((i) => {
      const d = this.defs.get(i.id);
      return { ...i, w: clamp(i.w, d.minW || 2, d.maxW || COLS), h: clamp(i.h, d.minH || 2, d.maxH || 14) };
    }));
    for (const [id, el] of [...this.els]) {
      if (!this.items.some((i) => i.id === id)) { this.destroyFn(id); el.remove(); this.els.delete(id); }
    }
    for (const it of this.items) if (!this.els.has(it.id)) this.createEl(it.id);
    this.paint();
  }

  createEl(id) {
    const d = this.defs.get(id);
    const el = document.createElement('section');
    el.className = `panel${d.variant ? ` panel-${d.variant}` : ''}${d.fit ? ' panel-fit' : ''}${d.grow ? ' panel-grow' : ''}`;
    el.dataset.id = id;
    el.id = `panel-${id}`;
    el.setAttribute('aria-labelledby', `panel-${id}-title`);
    el.innerHTML = `<header class="panel-head">
        <button type="button" class="panel-grip" aria-label="Atur posisi panel ${esc(d.title)}" aria-describedby="board-help">${icon('drag', 16)}</button>
        <div class="panel-title"><h2 id="panel-${id}-title">${esc(d.title)}</h2><p class="panel-desc"></p></div>
        <div class="panel-stats"></div>
        <div class="panel-tools"></div>
        <button type="button" class="panel-hide" aria-label="Sembunyikan panel ${esc(d.title)}" title="Sembunyikan panel">${icon('close', 15)}</button>
      </header><div class="panel-body"></div><span class="panel-resize" aria-hidden="true"></span>`;
    el.querySelector('.panel-body').inert = this.editing;
    this.root.appendChild(el);
    this.els.set(id, el);
    this.renderFn(id, el);
    return el;
  }

  async renderAll() {
    const run = (this.renderRun || 0) + 1;
    this.renderRun = run;
    const order = [...this.items].sort((a, b) => a.y - b.y || a.x - b.x);
    let deadline = performance.now() + 40;
    for (const it of order) {
      if (this.renderRun !== run || this.gone) return;
      const el = this.els.get(it.id);
      if (el) this.renderFn(it.id, el);
      if (performance.now() >= deadline) {
        await yieldToMain();
        deadline = performance.now() + 40;
      }
    }
  }

  setEditing(on) {
    this.editing = !!on && !this.stack;
    this.root.classList.toggle('editing', this.editing);
    for (const el of this.els.values()) el.querySelector('.panel-body').inert = this.editing;
    this.paint();
  }

  hidden() { return [...this.defs.keys()].filter((id) => !this.items.some((i) => i.id === id)); }

  apply(next, info) {
    const before = this.items;
    for (const it of next) if (!this.els.has(it.id)) this.createEl(it.id);
    for (const [id, el] of [...this.els]) {
      if (!next.some((i) => i.id === id)) { this.destroyFn(id); el.remove(); this.els.delete(id); }
    }
    this.items = next;
    this.paint();
    this.commitFn(next, { ...info, before });
  }

  addItem(id) {
    const d = this.defs.get(id);
    if (!d || this.items.some((i) => i.id === id)) return;
    const next = compact([...this.items, { id, x: 0, y: bottomOf(this.items), w: d.w, h: d.h }]);
    this.apply(next, { reason: 'add', id });
    const el = this.els.get(id);
    el.classList.add('appear');
    setTimeout(() => el.classList.remove('appear'), 700);
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    el.querySelector('.panel-grip')?.focus({ preventScroll: true });
    announce(`Panel ${d.title} ditambahkan di bawah`);
  }

  removeItem(id) {
    const d = this.defs.get(id);
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const order = [...this.items].sort((a, b) => a.y - b.y || a.x - b.x);
    const nextFocus = order[order.findIndex((i) => i.id === id) + 1] || order[order.findIndex((i) => i.id === id) - 1];
    this.apply(compact(this.items.filter((i) => i.id !== id)), { reason: 'remove', id });
    if (nextFocus) this.els.get(nextFocus.id)?.querySelector('.panel-grip')?.focus({ preventScroll: true });
    announce(`Panel ${d.title} disembunyikan`);
  }

  onClick(e) {
    const x = e.target.closest('.panel-hide');
    if (x && this.editing) this.removeItem(x.closest('.panel').dataset.id);
  }

  onDown(e) {
    if (!this.editing || this.stack || e.button !== 0 || this.session) return;
    const el = e.target.closest('.panel');
    if (!el || e.target.closest('.panel-hide, .panel-tools')) return;
    const id = el.dataset.id;
    const it = this.items.find((i) => i.id === id);
    if (!it) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    this.session = {
      id, el, cap: el, mode: e.target.closest('.panel-resize') ? 'resize' : 'move', origin: { ...it },
      snapshot: this.items.map((i) => ({ ...i })), x0: e.clientX, y0: e.clientY, s0: scrollY,
      cx: e.clientX, cy: e.clientY, moved: false, target: null, raf: 0,
    };
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
  }

  startAdd(id, e, source) {
    if (!this.editing || this.session) return;
    const d = this.defs.get(id);
    if (!d) return;
    e.preventDefault();
    source.setPointerCapture(e.pointerId);
    const ghost = document.createElement('div');
    ghost.className = 'panel-ghost';
    ghost.innerHTML = `${icon(d.icon || 'grid', 18)}<b>${esc(d.title)}</b><small>${d.w} × ${d.h}</small>`;
    document.body.appendChild(ghost);
    this.session = {
      id, cap: source, mode: 'add', ghost, origin: { id, x: 0, y: 0, w: d.w, h: d.h },
      snapshot: this.items.map((i) => ({ ...i })), x0: e.clientX, y0: e.clientY, s0: scrollY,
      cx: e.clientX, cy: e.clientY, moved: true, target: null, raf: 0,
    };
    source.addEventListener('pointermove', this.onMove);
    source.addEventListener('pointerup', this.onUp);
    source.addEventListener('pointercancel', this.onUp);
    this.root.classList.add('busy');
    this.track();
    this.loop();
  }

  onMove(e) {
    const s = this.session;
    if (!s) return;
    s.cx = e.clientX;
    s.cy = e.clientY;
    if (!s.moved) {
      if (Math.hypot(s.cx - s.x0, s.cy - s.y0) < 4) return;
      s.moved = true;
      s.el.classList.add(s.mode === 'move' ? 'dragging' : 'resizing');
      this.root.classList.add('busy');
      this.loop();
    }
    this.track();
  }

  loop() {
    const s = this.session;
    if (!s) return;
    const edge = 48;
    let v = 0;
    if (s.cy < edge) v = -Math.ceil((edge - s.cy) / 6);
    else if (s.cy > innerHeight - edge) v = Math.ceil((s.cy - (innerHeight - edge)) / 6);
    if (v) { scrollBy(0, v); this.track(); }
    s.raf = requestAnimationFrame(() => this.loop());
  }

  track() {
    const s = this.session;
    const cw = this.colW + GAP;
    const rh = ROW + GAP;
    const o = s.origin;
    const d = this.defs.get(s.id);
    let target = null;
    if (s.mode === 'move') {
      const px = o.x * cw + (s.cx - s.x0);
      const py = o.y * rh + (s.cy - s.y0) + (scrollY - s.s0);
      s.el.style.transform = `translate(${px}px, ${py}px)`;
      target = { ...o, x: clamp(Math.round(px / cw), 0, COLS - o.w), y: Math.max(0, Math.round(py / rh)) };
    } else if (s.mode === 'resize') {
      const pw = o.w * cw - GAP + (s.cx - s.x0);
      const ph = o.h * rh - GAP + (s.cy - s.y0) + (scrollY - s.s0);
      s.el.style.width = `${Math.max(pw, 120)}px`;
      s.el.style.height = `${Math.max(ph, 96)}px`;
      target = {
        ...o,
        w: clamp(Math.round((pw + GAP) / cw), d.minW || 2, Math.min(d.maxW || COLS, COLS - o.x)),
        h: clamp(Math.round((ph + GAP) / rh), d.minH || 2, d.maxH || 14),
      };
    } else {
      s.ghost.style.transform = `translate(${s.cx + 14}px, ${s.cy + 14}px)`;
      const r = this.root.getBoundingClientRect();
      const inside = s.cx >= r.left - 24 && s.cx <= r.right + 24 && s.cy >= r.top - 24 && s.cy <= r.bottom + 160;
      s.ghost.classList.toggle('over', inside);
      if (inside) {
        target = {
          ...o,
          x: clamp(Math.round((s.cx - r.left) / cw - o.w / 2), 0, COLS - o.w),
          y: Math.max(0, Math.round((s.cy - r.top) / rh - 0.5)),
        };
      }
    }
    const t0 = s.target;
    if (t0 === target || (t0 && target && t0.x === target.x && t0.y === target.y && t0.w === target.w && t0.h === target.h)) return;
    s.target = target;
    if (!target) {
      this.preview = null;
      this.paint(s.snapshot);
      this.showPh(null);
      return;
    }
    const base = s.mode === 'add' ? [...s.snapshot, target] : s.snapshot.map((i) => (i.id === s.id ? target : i));
    this.preview = settle(base, s.id, s.mode === 'move' ? o : null);
    this.paint(this.preview);
    this.showPh(this.preview.find((i) => i.id === s.id));
  }

  onUp() {
    const s = this.session;
    if (!s) return;
    this.session = null;
    cancelAnimationFrame(s.raf);
    s.cap.removeEventListener('pointermove', this.onMove);
    s.cap.removeEventListener('pointerup', this.onUp);
    s.cap.removeEventListener('pointercancel', this.onUp);
    this.root.classList.remove('busy');
    this.showPh(null);
    if (s.ghost) s.ghost.remove();
    if (s.el) {
      s.el.classList.remove('dragging', 'resizing');
      s.el.style.transform = '';
      s.el.style.width = '';
      s.el.style.height = '';
    }
    const next = this.preview;
    this.preview = null;
    if (!s.moved || !next || sameLayout(next, this.items)) { this.paint(); return; }
    const d = this.defs.get(s.id);
    this.apply(next, { reason: s.mode, id: s.id });
    if (s.mode === 'add') {
      const el = this.els.get(s.id);
      el.classList.add('appear');
      setTimeout(() => el.classList.remove('appear'), 700);
    }
    const n = next.find((i) => i.id === s.id);
    announce(`${d.title}: kolom ${n.x + 1}, baris ${n.y + 1}, lebar ${n.w}, tinggi ${n.h}`);
  }

  onKey(e) {
    const grip = e.target.closest('.panel-grip');
    if (!grip || !this.editing) return;
    const id = grip.closest('.panel').dataset.id;
    const it = this.items.find((i) => i.id === id);
    const d = this.defs.get(id);
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.removeItem(id); return; }
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!dir) return;
    e.preventDefault();
    const swap = (t, vac) => settle(this.items.map((i) => (i.id === id ? t : i)), id, vac);
    let next = null;
    if (e.shiftKey) {
      next = swap({
        ...it,
        w: clamp(it.w + dir[0], d.minW || 2, Math.min(d.maxW || COLS, COLS - it.x)),
        h: clamp(it.h + dir[1], d.minH || 2, d.maxH || 14),
      }, null);
    } else if (dir[0]) {
      next = swap({ ...it, x: clamp(it.x + dir[0], 0, COLS - it.w) }, it);
    } else {
      for (let step = 1; step <= 40 && !next; step += 1) {
        const y = it.y + dir[1] * step;
        if (y < 0) break;
        const cand = swap({ ...it, y }, it);
        if (cand.find((i) => i.id === id).y !== it.y) next = cand;
      }
    }
    if (!next || sameLayout(next, this.items)) { announce(`${d.title} sudah di batas`); return; }
    this.apply(next, { reason: e.shiftKey ? 'resize' : 'move', id });
    grip.focus({ preventScroll: true });
    grip.closest('.panel').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const n = next.find((i) => i.id === id);
    announce(`${d.title}: kolom ${n.x + 1}, baris ${n.y + 1}, lebar ${n.w}, tinggi ${n.h}`);
  }

  destroy() {
    this.gone = true;
    this.ro.disconnect();
    for (const id of this.els.keys()) this.destroyFn(id);
    this.els.clear();
    this.root.removeEventListener('pointerdown', this.onDown);
    this.root.removeEventListener('keydown', this.onKey);
    this.root.removeEventListener('click', this.onClick);
    this.root.innerHTML = '';
    this.root.classList.remove('editing', 'stack', 'busy');
  }
}
