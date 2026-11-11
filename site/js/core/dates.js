export const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September',
  'Oktober', 'November', 'Desember'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const DAYS_SHORT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
export function daysInMonth(ym) { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
export function shiftMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}
export const prevMonth = (ym) => shiftMonth(ym, -1);
export function weekday(iso) { const [y, m, d] = iso.split('-').map(Number); return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; }
export function weekdaysInMonth(ym, upToDay = 31) {
  let n = 0;
  const D = Math.min(daysInMonth(ym), upToDay);
  for (let d = 1; d <= D; d += 1) if (weekday(`${ym}-${String(d).padStart(2, '0')}`) < 5) n += 1;
  return n;
}
