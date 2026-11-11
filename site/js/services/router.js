import { IS_GAS } from './data-source.js';

export const VIEW_IDS = ['ringkasan', 'performance', 'portofolio', 'realisasi', 'sla'];
let current = { view: 'ringkasan', params: {} };
let handler = () => {};

const clean = (params) => Object.fromEntries(Object.entries(params || {})
  .filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([k, v]) => [k, String(v)]));
const validView = (v) => (VIEW_IDS.includes(v) ? v : 'ringkasan');
const key = (r) => `${r.view}?${new URLSearchParams(Object.entries(r.params).sort()).toString()}`;

function parseHash(hash) {
  const s = hash.replace(/^#\/?/, '');
  const [v, q = ''] = s.split('?');
  return { view: validView(v), params: Object.fromEntries(new URLSearchParams(q)) };
}

function emit(next) {
  if (key(next) === key(current)) return;
  current = next;
  handler(current);
}

export function initRouter(onChange) {
  handler = onChange;
  if (IS_GAS) {
    return new Promise((resolve) => {
      window.google.script.url.getLocation((loc) => {
        current = { view: validView(loc.hash), params: clean(loc.parameter) };
        window.google.script.history.setChangeHandler((e) => emit({ view: validView(e.location.hash), params: clean(e.location.parameter) }));
        resolve(current);
      });
    });
  }
  current = parseHash(location.hash);
  const onNav = () => emit(parseHash(location.hash));
  addEventListener('popstate', onNav);
  addEventListener('hashchange', onNav);
  return Promise.resolve(current);
}

export const route = () => current;

export function navigate(view, params = {}, { replace = false } = {}) {
  const next = { view: validView(view), params: clean(params) };
  current = next;
  if (IS_GAS) {
    window.google.script.history[replace ? 'replace' : 'push'](null, next.params, next.view);
  } else {
    const q = new URLSearchParams(next.params).toString();
    const h = `#/${next.view}${q ? `?${q}` : ''}`;
    if (replace) history.replaceState(null, '', h); else history.pushState(null, '', h);
  }
  return next;
}

export function hrefFor(view, params = {}) {
  const q = new URLSearchParams(clean(params)).toString();
  return `#/${view}${q ? `?${q}` : ''}`;
}
