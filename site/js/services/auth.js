import { API } from '../deploy.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const KEY = 'kpr.auth';
const PENDING = 'kpr.auth.pending';
const HINT = 'kpr.auth.hint';

const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '[::1]'];
export const isLocalHost = () => LOCAL_HOSTS.includes(location.hostname);
export const API_MODE = !!API.url && !!API.clientId && !isLocalHost();

export class AuthError extends Error {}

const ss = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { sessionStorage.removeItem(k); } catch {} },
};
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
const redirectUri = () => `${location.origin}${location.pathname.replace(/index\.html$/, '')}`;

function decodeJwt(token) {
  const part = token.split('.')[1] || '';
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function login({ silent = false, switchAccount = false } = {}) {
  const state = randomId();
  const nonce = randomId();
  ss.set(PENDING, { state, nonce, route: location.hash, silent });
  const p = new URLSearchParams({
    client_id: API.clientId,
    redirect_uri: redirectUri(),
    response_type: 'token id_token',
    scope: 'openid email',
    state, nonce,
    include_granted_scopes: 'false',
  });
  const hint = ls.get(HINT);
  if (silent) p.set('prompt', 'none');
  else if (switchAccount || !hint) p.set('prompt', 'select_account');
  if (hint && !switchAccount) p.set('login_hint', hint);
  location.assign(`${AUTH_URL}?${p}`);
}

export function handleRedirect() {
  const h = location.hash.replace(/^#/, '');
  if (!/(^|&)(id_token|error)=/.test(h)) return { status: 'none' };
  const p = new URLSearchParams(h);
  const pending = ss.get(PENDING);
  ss.del(PENDING);
  history.replaceState(null, '', `${location.pathname}${location.search}${pending?.route || ''}`);
  if (!pending || p.get('state') !== pending.state) return { status: 'error', message: 'Login tidak cocok dengan permintaan. Coba masuk lagi.' };
  if (p.get('error')) {
    return { status: 'error', silent: pending.silent, message: pending.silent ? '' : `Login dibatalkan (${p.get('error')}).` };
  }
  const token = p.get('id_token');
  let claims;
  try { claims = decodeJwt(token); } catch { return { status: 'error', message: 'Token login tidak terbaca.' }; }
  if (claims.nonce !== pending.nonce || claims.aud !== API.clientId) return { status: 'error', message: 'Token login tidak valid untuk dashboard ini.' };
  ss.set(KEY, { token, exp: claims.exp, email: claims.email || '' });
  if (claims.email) ls.set(HINT, claims.email);
  return { status: 'ok' };
}

export function session() {
  const s = ss.get(KEY);
  if (!s || !s.token || !s.exp || s.exp * 1000 - Date.now() < 60000) return null;
  return s;
}

export function hasHint() { return !!ls.get(HINT); }

export function logout() {
  ss.del(KEY);
  ls.del(HINT);
}

export function dropSession() { ss.del(KEY); }
