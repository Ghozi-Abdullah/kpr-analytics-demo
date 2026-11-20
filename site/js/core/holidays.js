const LISTED = {
  2026: [
    '01-01', '01-16', '02-16', '02-17', '03-18', '03-19', '03-20', '03-21', '03-22', '03-23', '03-24',
    '04-03', '04-05', '05-01', '05-14', '05-15', '05-27', '05-28', '05-31', '06-01', '06-16', '08-17',
    '08-25', '12-24', '12-25',
  ],
  2027: [
    '01-01', '01-05', '02-05', '02-06', '03-08', '03-09', '03-10', '03-11', '03-12', '03-15', '03-25',
    '03-26', '03-28', '05-01', '05-06', '05-17', '05-18', '05-19', '05-20', '06-01', '06-06', '08-15',
    '08-17', '12-24', '12-25', '12-26',
  ],
};
const FIXED = new Set(['01-01', '05-01', '06-01', '08-17', '12-25']);
const SETS = Object.fromEntries(Object.entries(LISTED).map(([y, days]) => [y, new Set(days)]));

export const holidaysListed = (year) => Object.prototype.hasOwnProperty.call(SETS, String(year));

export function isHoliday(iso) {
  const set = SETS[iso.slice(0, 4)] || FIXED;
  return set.has(iso.slice(5, 10));
}
