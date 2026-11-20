import { esc } from '../core/format.js';
import { ok, ratio } from '../core/values.js';
import { icon } from '../core/icons.js';
import { simTarget, simAnchors } from '../analytics/outlook.js';
import { rpM, rpMSigned, pct, monthName } from '../analytics/wording.js';
import { liftText, tierOf } from '../analytics/outlook-text.js';

const OS_LABEL = { base: 'Laju biasa', best: 'Laju terbaik', combo: 'Kombinasi', step: 'Tumbuh sesuai RKA', rka: 'RKA' };
const FROM_LABEL = { rka: 'RKA OS', input: 'Target Anda', estimate: 'Perkiraan RKA', 'rka-growth': 'Target awal', 'rka-trend': 'Target awal', trend: 'Target awal' };
const Q = {
  npl: { name: 'NPL', ratio: '%NPL', fix: 'Perlu diselesaikan', how: 'lewat pelunasan, restrukturisasi, atau lelang' },
  sml: { name: 'SML', ratio: '%SML', fix: 'Perlu ditagih', how: 'agar tidak turun ke NPL' },
};

function niceStep(x) {
  if (!(x > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(x));
  const m = x / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

function scale(values, at, minSpan) {
  const vals = values.filter(ok);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const span = Math.max(hi - lo, minSpan);
  lo -= span * 0.3;
  hi += span * 0.3;
  const step = niceStep((hi - lo) / 400);
  const below = Math.min(Math.ceil((at - Math.max(0, lo)) / step), Math.floor(at / step));
  return { lo: at - below * step, hi: at + Math.ceil((hi - at) / step) * step, step };
}

const pos = (v, s) => Math.min(1, Math.max(0, (v - s.lo) / (s.hi - s.lo)));
const near = (a, b, s) => Math.abs(a - b) <= s.step / 2;

function rowHtml(api, row) {
  const id = api.cid(`sim-${row.key}`);
  const s = row.scale;
  const ticks = row.anchors.map((a) => `<span class="sim-tick" data-k="${a.key}" style="--p:${pos(a.v, s).toFixed(4)}"></span>`).join('');
  const chips = row.anchors.map((a) => `<button type="button" class="sim-chip" data-k="${a.key}" data-v="${a.v}" aria-pressed="false"><i aria-hidden="true"></i>${esc(a.label)} <b>${esc(rpM(a.v))}</b></button>`).join('');
  return `<div class="sim-row" data-row="${row.key}">
    <div class="sim-head"><label for="${id}">${esc(row.label)}</label><output for="${id}" class="sim-value" data-value></output><span class="sim-tag" data-tag></span></div>
    <div class="sim-track">${ticks}<input class="sim-range" type="range" id="${id}" min="${s.lo}" max="${s.hi}" step="${s.step}" value="${row.value}"></div>
    <div class="sim-chips">${chips}</div>
    <dl class="sim-stats" data-stats aria-live="polite"></dl>
    <p class="sim-note" data-note></p>
  </div>`;
}

export function simSection(api, o, mode, state) {
  const A = simAnchors(o, mode);
  const period = mode === 'year' ? String(o.year.year) : monthName(mode === 'current' ? o.current.month : o.next.month);
  const osAnchors = A.os.map((a) => ({ key: a.key, v: a.v, label: a.key === 'rka' ? (FROM_LABEL[a.from] || 'Target') : OS_LABEL[a.key] }));
  const osValue = mode === 'year' ? (ok(o.year.target) ? o.year.target : A.reset) : (ok(state.os) ? state.os : A.reset);
  const rows = [{ key: 'os', label: `OS akhir ${period}`, anchors: osAnchors, value: osValue }];
  for (const key of ['npl', 'sml']) {
    const q = A.quality?.[key];
    if (!q || !ok(q.now)) continue;
    const anchors = [
      { key: 'now', v: q.now, label: 'Sekarang' },
      ok(q.base) && Math.abs(q.base - q.now) > 1e-6 ? { key: 'trend', v: q.base, label: 'Tren berlanjut' } : null,
      ok(q.rka) ? { key: 'rka', v: q.rka, label: q.rkaFrom === 'rka' ? 'RKA' : 'Rasio RKA' } : null,
    ].filter(Boolean);
    const def = ok(q.rka) ? q.rka : ok(q.base) ? q.base : q.now;
    rows.push({ key, label: `${Q[key].name} akhir ${period}`, anchors, value: ok(state[key]) ? state[key] : def, def, q });
  }
  for (const row of rows) {
    const span = row.key === 'os' ? Math.abs(row.value) * 0.01 : Math.abs(row.value) * 0.08;
    row.scale = scale([...row.anchors.map((a) => a.v), row.value], row.value, span);
  }
  const resetWord = mode === 'year' && o.year.sourceDefault !== 'rka' ? 'Kembali ke target awal' : 'Kembali ke RKA';
  const html = `<section class="outlook-sim" aria-labelledby="${api.cid('sim')}">
    <header><h3 id="${api.cid('sim')}">${icon('target', 15)}Simulasi target</h3><button type="button" class="outlook-ro-table" data-sim-reset>${esc(resetWord)}</button></header>
    <p class="outlook-muted">Geser target OS, NPL, dan SML. Disburse yang dibutuhkan dan rasionya ikut berubah.</p>
    ${rowHtml(api, rows[0])}
    ${rows.length > 1 ? `<div class="sim-quality">${rows.slice(1).map((r) => rowHtml(api, r)).join('')}</div>` : ''}
  </section>`;
  return { html, rows, reset: A.reset };
}

function osStats(o, mode, v) {
  const s = simTarget(o, mode, v);
  const t = tierOf(s.tier);
  const year = mode === 'year';
  const cells = [
    [year ? 'Disburse per bulan' : mode === 'current' ? 'Disburse sisa bulan' : 'Disburse dibutuhkan', rpM(Math.max(0, year ? s.per : s.disb))],
    ['Per hari kerja', ok(s.perWd) ? rpM(Math.max(0, s.perWd)) : '–'],
    [year ? `OS tumbuh ${o.year.year}` : 'OS tumbuh', rpMSigned(s.growth)],
  ];
  return {
    stats: cells,
    pill: `<span class="lift-pill ${t.tone}">${esc(liftText(s.lift))}</span>`,
    note: `${esc(liftText(s.lift))} dari laju biasa ${esc(rpM(s.base))}${year ? ' per bulan' : ''}: ${esc(t.word.toLowerCase())}.${ok(s.growthRka) && !year ? ` RKA minta OS tumbuh ${esc(rpMSigned(s.growthRka))}.` : ''}`,
    tag: ok(s.ach) ? `capaian ${year ? 'target' : 'RKA'} ${pct(s.ach, 1)}` : '',
  };
}

function qualityStats(key, q, v, os) {
  const w = Q[key];
  const change = v - q.now;
  const fix = ok(q.base) ? Math.max(0, q.base - v) : null;
  const vsRka = ok(q.rka) ? v - q.rka : null;
  return {
    stats: [
      [w.ratio, ok(ratio(v, os)) ? pct(ratio(v, os), 2) : '–'],
      ['Dari sekarang', Math.abs(change) < 0.5 ? 'tetap' : change < 0 ? `perlu turun ${rpM(-change)}` : `boleh naik ${rpM(change)}`],
      [w.fix, ok(fix) ? (fix < 0.5 ? 'tidak perlu' : rpM(fix)) : '–'],
    ],
    note: [
      ok(fix) && fix >= 0.5 ? `Tren 3 bulan terakhir membawa ${w.name} ke ${rpM(q.base)}, jadi ${rpM(fix)} perlu ditekan ${w.how}.` : '',
      ok(vsRka) && vsRka >= 0.5 ? `${rpM(vsRka)} di atas RKA.` : '',
    ].filter(Boolean).join(' '),
    tag: ok(q.ratioNow) ? `kini ${pct(q.ratioNow, 2)}` : '',
  };
}

export function bindSim(api, o, mode, state, sim, { onCommit, onReset }) {
  const root = api.body.querySelector('.outlook-sim');
  if (!root) return;
  const el = {};
  for (const row of sim.rows) {
    const box = root.querySelector(`[data-row="${row.key}"]`);
    el[row.key] = { box, input: box.querySelector('input'), value: box.querySelector('[data-value]'), tag: box.querySelector('[data-tag]'), stats: box.querySelector('[data-stats]'), note: box.querySelector('[data-note]'), chips: [...box.querySelectorAll('.sim-chip')], row };
  }
  const exact = {};
  for (const row of sim.rows) exact[row.key] = row.value;
  const val = (k) => (ok(exact[k]) ? exact[k] : Number(el[k].input.value));
  const dl = (cells) => cells.map(([dt, dd]) => `<div><dt>${esc(dt)}</dt><dd>${esc(dd)}</dd></div>`).join('');
  const press = (k) => {
    const v = val(k);
    for (const c of el[k].chips) c.setAttribute('aria-pressed', String(near(Number(c.dataset.v), v, el[k].row.scale)));
  };
  const paint = () => {
    const os = val('os');
    const r = osStats(o, mode, os);
    el.os.value.textContent = rpM(os);
    el.os.input.setAttribute('aria-valuetext', `${rpM(os)}, ${r.tag}`);
    el.os.tag.textContent = r.tag;
    el.os.stats.innerHTML = `${dl(r.stats)}<div><dt>Dari laju biasa</dt><dd>${r.pill}</dd></div>`;
    el.os.note.innerHTML = r.note;
    press('os');
    for (const k of ['npl', 'sml']) {
      if (!el[k]) continue;
      const v = val(k);
      const q = qualityStats(k, el[k].row.q, v, os);
      el[k].value.textContent = rpM(v);
      el[k].input.setAttribute('aria-valuetext', `${rpM(v)}, ${q.stats[0][0]} ${q.stats[0][1]}`);
      el[k].tag.textContent = q.tag;
      el[k].stats.innerHTML = dl(q.stats);
      el[k].note.textContent = q.note;
      press(k);
    }
  };
  for (const k of Object.keys(el)) {
    const { input, chips } = el[k];
    input.addEventListener('input', () => {
      exact[k] = null;
      if (!(mode === 'year' && k === 'os')) state[k] = val(k);
      paint();
    });
    if (mode === 'year' && k === 'os') input.addEventListener('change', () => onCommit(val('os')));
    for (const c of chips) {
      c.addEventListener('click', () => {
        input.value = c.dataset.v;
        exact[k] = Number(c.dataset.v);
        if (mode === 'year' && k === 'os') { onCommit(exact[k]); return; }
        state[k] = exact[k];
        paint();
      });
    }
  }
  root.querySelector('[data-sim-reset]').addEventListener('click', () => {
    state.os = null;
    state.npl = null;
    state.sml = null;
    if (mode === 'year') { onReset(); return; }
    el.os.input.value = sim.reset;
    exact.os = sim.reset;
    for (const k of ['npl', 'sml']) {
      if (!el[k]) continue;
      el[k].input.value = el[k].row.def;
      exact[k] = el[k].row.def;
    }
    paint();
  });
  paint();
}
