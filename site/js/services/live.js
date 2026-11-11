import { MODE, getVersion } from './data-source.js';

export const LIVE_INTERVAL = MODE === 'local' ? 60000 : 90000;
const MAX_WAIT = 10 * 60000;

export function startLive({ current, onUpdate, onState }) {
  let timer = 0;
  let last = 0;
  let failures = 0;
  let checking = false;
  let stopped = false;

  function schedule() {
    clearTimeout(timer);
    if (stopped) return;
    const wait = failures ? Math.min(LIVE_INTERVAL * 2 ** failures, MAX_WAIT) : LIVE_INTERVAL;
    timer = setTimeout(check, wait);
  }

  async function check() {
    if (stopped || checking) return;
    if (document.visibilityState !== 'visible') { schedule(); return; }
    if (navigator.onLine === false) { onState({ state: 'offline', checkedAt: last }); schedule(); return; }
    checking = true;
    try {
      const version = await getVersion();
      failures = 0;
      last = Date.now();
      onState({ state: 'live', checkedAt: last });
      if (version && version !== current()) await onUpdate(version);
    } catch (err) {
      failures += 1;
      onState({ state: 'error', checkedAt: last, error: err });
    } finally {
      checking = false;
      schedule();
    }
  }

  const onVisible = () => { if (document.visibilityState === 'visible' && Date.now() - last > LIVE_INTERVAL / 2) check(); };
  const onOnline = () => check();
  const onOffline = () => onState({ state: 'offline', checkedAt: last });
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  schedule();

  return {
    check,
    get lastCheck() { return last; },
    stop() {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    },
  };
}

export function ago(iso, now = Date.now()) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return 'baru saja';
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'kemarin' : `${d} hari lalu`;
}
