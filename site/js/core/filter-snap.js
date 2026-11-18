const NEAR = 32;
const loose = () => matchMedia('(max-width: 759px), (max-height: 520px)').matches;

function textBox(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  return range.getBoundingClientRect();
}

function clear(filters) {
  filters.classList.remove('is-snap');
  filters.style.removeProperty('width');
}

export function snapFilters(filters, title) {
  if (!filters) return;
  clear(filters);
  if (!title || loose()) return;
  const items = [...filters.children].filter((el) => !el.hidden && el.getClientRects().length);
  if (items.length < 2) return;
  const boxes = items.map((el) => el.getBoundingClientRect());
  if (boxes.some((q) => Math.abs(q.top - boxes[0].top) > 1)) return;
  const natural = Math.max(...boxes.map((q) => q.right)) - Math.min(...boxes.map((q) => q.left));
  const target = textBox(title).width;
  if (!target || Math.abs(natural - target) >= NEAR) return;
  filters.classList.add('is-snap');
  filters.style.width = `${target.toFixed(2)}px`;
  const cut = [...filters.querySelectorAll('.picker-button')].some((b) => b.scrollWidth > b.clientWidth + 1);
  if (cut || filters.scrollWidth > filters.clientWidth + 1) clear(filters);
}

function firstContentTop(board) {
  const panels = [...board.querySelectorAll('.panel')].map((el) => ({ el, q: el.getBoundingClientRect() }))
    .filter(({ q }) => q.height > 0)
    .sort((a, c) => a.q.top - c.q.top || a.q.left - c.q.left);
  const first = panels[0];
  if (!first) return null;
  const heading = first.el.classList.contains('panel-section') ? first.el.querySelector('h2') : null;
  if (!heading) return first.q.top;
  const size = parseFloat(getComputedStyle(heading).fontSize) || 0;
  return textBox(heading).top + size * 0.2;
}

export function balanceFilters(bar, header, board) {
  if (!bar) return;
  bar.style.removeProperty('--lift');
  if (!header || !board || loose() || board.classList.contains('editing') || board.classList.contains('stack')) return;
  const pills = [...bar.querySelectorAll('#filters > *')].filter((el) => el.getClientRects().length).map((el) => el.getBoundingClientRect());
  const below = firstContentTop(board);
  if (!pills.length || below == null) return;
  const left = Math.min(...pills.map((q) => q.left));
  const right = Math.max(...pills.map((q) => q.right));
  const top = Math.min(...pills.map((q) => q.top));
  const bottom = Math.max(...pills.map((q) => q.bottom));
  const parts = [...header.children].flatMap((el) => (getComputedStyle(el).display === 'contents' ? [...el.children] : [el]));
  const above = parts.filter((el) => el.getClientRects().length).map((el) => (el.matches('p') ? textBox(el) : el.getBoundingClientRect()))
    .filter((q) => q.height > 0 && q.bottom <= top && q.right > left && q.left < right)
    .reduce((m, q) => Math.max(m, q.bottom), -Infinity);
  if (!Number.isFinite(above)) return;
  const lift = ((top - above) - (below - bottom)) / 2;
  if (Math.abs(lift) < 1 || Math.abs(lift) > 16) return;
  bar.style.setProperty('--lift', `${lift.toFixed(1)}px`);
}
