import { fmt, esc, shortRo } from '../core/format.js';
import { ratio, ok, uniq, byText } from '../core/values.js';
import { pick, seg, onSeg, searchPick, bindSearchPick } from '../core/controls.js';
import { sortableTable, openDetail } from '../core/ui.js';
import { daysInMonth, shiftMonth, weekday } from '../core/dates.js';
import { icon } from '../core/icons.js';
import { SLA_STAGES, SLA_TARGET_HARI, SLA_AGE_BUCKETS, SLA_TYPE_LABEL, SLA_DETAIL_DAYS, SLA_DETAIL_TOP, SLA_CARD_RANGE, SLA_STAGE_COLOR } from '../config.js';
import { barChart, SERIES } from '../charts/charts.js';
import { loadSla } from '../services/datasets.js';
import { ACTIVE_STAGES, stageById, filterRows, tally, byStage, groupTally, activeRows, hasAge, filterDaily, byDate, lastDays, shiftDay, dayTotals } from '../models/sla-model.js';
import { chartBox, canvasOf, stats, empty, donutHtml, mountDonut } from '../widgets/widget-kit.js';

const rp = (v, d = 1) => (ok(v) ? `Rp ${fmt.rupiah(v, d)}` : '–');
const days = (v) => {
  if (!ok(v)) return '–';
  const hours = Math.round(Math.max(0, v) * 24);
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  if (!d && !h) return 'kurang dari 1 jam';
  return [d ? `${d} hari` : '', h ? `${h} jam` : ''].filter(Boolean).join(' ');
};
const share = (a, b) => fmt.pct(ratio(a, b), 1);
const S = (api) => api.ctx.sla || api.ctx;
const act = (api, c, patch) => (c.linked ? api.go('sla', patch) : api.set(patch));
const noData = () => empty('Data SLA belum ada', 'Taruh sla.xlsx di folder data_raw, lalu jalankan refresh-data.bat.');
const lateWord = `lebih dari ${SLA_TARGET_HARI} hari`;
const COUNT_MS = 650;
const TILT = { rest: 4, nod: 6, side: 10 };
const INTRO_MS = 2800;
const FLIP_MS = 900;
const FAN = [-3, -1, 1, 3];
const introDone = new WeakSet();
const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const sum = (list) => list.reduce((t, v) => t + v, 0);
const dayTitle = (iso) => `${DAY_NAMES[weekday(iso)]}, ${fmt.date(iso)}`;

function countUp(root) {
  const els = [...root.querySelectorAll('[data-count]')];
  if (!els.length || calm()) return;
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / COUNT_MS);
    const eased = 1 - (1 - k) ** 3;
    for (const el of els) el.textContent = fmt.num(Math.round(Number(el.dataset.count) * eased));
    if (k < 1 && root.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function introOnce(host, flow, onFaceUp) {
  if (introDone.has(host) || calm()) return false;
  introDone.add(host);
  flow.classList.add('is-intro');
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    flow.classList.add('is-live');
    setTimeout(onFaceUp, FLIP_MS);
    setTimeout(() => flow.classList.remove('is-intro', 'is-live'), INTRO_MS);
  }, { threshold: 0.3 });
  io.observe(flow);
  return true;
}

function bindTilt(scene) {
  if (calm() || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const cards = [...scene.querySelectorAll('.flow-card')];
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  let frame = 0;
  scene.addEventListener('pointermove', (e) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const box = scene.getBoundingClientRect();
      scene.style.setProperty('--px', ((e.clientX - box.left) / box.width - 0.5).toFixed(3));
      for (const el of cards) {
        const r = el.getBoundingClientRect();
        const dx = clamp(((e.clientX - (r.left + r.width / 2)) / box.width) * 2.4);
        const dy = clamp((e.clientY - (r.top + r.height / 2)) / box.height);
        el.style.setProperty('--ry', `${(dx * TILT.side).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${(TILT.rest - dy * TILT.nod).toFixed(2)}deg`);
        el.style.setProperty('--mx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
        el.style.setProperty('--my', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
      }
    });
  });
  scene.addEventListener('pointerleave', () => {
    cancelAnimationFrame(frame);
    scene.style.removeProperty('--px');
    for (const el of cards) for (const k of ['--rx', '--ry', '--mx', '--my']) el.style.removeProperty(k);
  });
}

function dayBars(values, dates, what) {
  const max = Math.max(...values, 1);
  return `<span class="day-bars" role="img" aria-label="${esc(what)} per hari, ${fmt.dateShort(dates[0])} sampai ${fmt.dateShort(dates.at(-1))}: total ${fmt.num(sum(values))} berkas">${values.map((v, i) =>
    `<i style="height:${Math.max(v ? 10 : 4, (v / max) * 100).toFixed(0)}%"${v ? '' : ' class="zero"'} title="${fmt.dateShort(dates[i])}: ${fmt.num(v)} berkas"></i>`).join('')}</span>`;
}

export function slaContext(model, sel, { linked = false } = {}) {
  const scoped = filterRows(model, sel, { stage: false });
  const rows = sel.tahap ? scoped.filter((r) => r.stage === sel.tahap) : scoped;
  const active = activeRows(scoped);
  const stage = stageById(sel.tahap);
  const focus = (stage ? rows : active).filter(hasAge);
  const daily = filterDaily(model, sel);
  const end = model.snapshot && model.snapshot >= model.dayMax ? model.snapshot : model.dayMax || model.snapshot || '';
  const scope = [sel.ro || 'Nasional', sel.kanca, sel.pendapatan, sel.putusan].filter(Boolean).join(', ');
  return {
    model, sel, linked, scoped, rows, active, focus, stages: byStage(scoped),
    daily, cells: byDate(daily), end, scope,
    where: [scope, sel.bulan ? `prakarsa ${fmt.month(sel.bulan)}` : '', stage?.label].filter(Boolean).join(', '),
  };
}

function monthCount(c, stage, ym) {
  let n = 0;
  for (const [date, cell] of c.cells) if (date.startsWith(ym)) n += cell[stage].berkas;
  return n;
}

const span = (v) => (ok(v) && Math.round(Math.max(0, v) * 24) === 0 ? '< 1 jam' : days(v));

function rangeRows(caption, min, avg, max, judge) {
  const tone = (v) => (!judge || !ok(v) ? '' : v > SLA_TARGET_HARI ? ' class="flow-over"' : ' class="flow-in"');
  const row = (label, v) => `<span${tone(v)}><em>${label}</em><b>${span(v)}</b></span>`;
  return `<span class="flow-range"><span class="flow-cap">${esc(caption)}</span>${[['Min', min], ['Rata-rata', avg], ['Maks', max]].filter(([, v]) => ok(v)).map(([l, v]) => row(l, v)).join('')}</span>`;
}

const amount = (label, v) => `<span class="flow-amount"><span class="flow-cap">${esc(label)}</span><b>${rp(v)}</b></span>`;

function stageCard(s, t, c, i) {
  const range = SLA_CARD_RANGE[s.id];
  let facts = amount('Nominal pengajuan', t.nominal);
  if (range === 'umur') facts += rangeRows('Umur di tahap ini', t.umurMin, t.umurAvg, t.umurMax, true);
  if (range === 'lama') facts = amount('Nominal cair', t.cair) + rangeRows('Prakarsa sampai cair', t.lamaMin, t.lamaAvg, t.lamaMax, false);
  const corner = (end) => `<span class="card-corner${end ? ' end' : ''}"${end ? ' aria-hidden="true"' : ''}><b>${s.no}</b>${icon(s.icon, 13)}</span>`;
  return `<li class="flow-step" data-tone="${s.id}" style="--i:${i};--fan:${FAN[i] ?? 0}deg"><span class="flow-float"><span class="flow-deal">
    <button type="button" class="flow-card" data-stage="${s.id}" aria-haspopup="dialog"${c.sel.tahap === s.id ? ' data-on' : ''}>
      <span class="card-face">
        ${corner(false)}
        <span class="card-body">
          <span class="flow-name"><i style="background:${SLA_STAGE_COLOR[s.id]}"></i>${esc(s.label)}</span>
          <span class="flow-value"><span data-count="${t.berkas}">${fmt.num(t.berkas)}</span><small class="flow-unit">berkas</small></span>
          ${facts}
        </span>
        ${corner(true)}
      </span>
      <span class="card-back" aria-hidden="true"></span>
    </button></span></span></li>`;
}

const kpiTiles = (items) => `<dl class="pop-kpis">${items.map((k) => `<div${k.tone ? ` data-tone="${k.tone}"` : ''}><dt>${esc(k.label)}</dt><dd>${k.value}</dd>${k.sub ? `<small>${esc(k.sub)}</small>` : ''}</div>`).join('')}</dl>`;
const popCard = (title, html, note = '', wide = false) => `<section class="pop-card${wide ? ' wide' : ''}"><h3>${esc(title)}</h3>${note ? `<p>${esc(note)}</p>` : ''}${html}</section>`;
const popTable = (columns, rows) => `<div class="pop-table-wrap"><table class="pop-table"><thead><tr>${columns.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((r) => `<tr><th scope="row">${r[0]}</th>${r.slice(1).map((v) => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

function barList(items) {
  if (!items.length) return '<p class="pop-none">Tidak ada berkas.</p>';
  const max = Math.max(...items.map((i) => i.value), 1);
  return `<ul class="pop-bars">${items.map((i) => `<li${i.late ? ' class="late"' : ''}><span class="pop-bars-name">${esc(i.label)}</span><span class="pop-bars-val">${i.text}</span>
    <span class="pop-bars-bar"><i style="width:${((i.value / max) * 100).toFixed(1)}%"></i></span></li>`).join('')}</ul>`;
}

function trendCard(title, values, dates, what) {
  const peak = values.indexOf(Math.max(...values));
  const note = sum(values) ? `Total ${fmt.num(sum(values))} berkas. Paling ramai ${fmt.dateShort(dates[peak])}: ${fmt.num(values[peak])} berkas.` : 'Belum ada berkas di rentang ini.';
  return popCard(title, `<div class="pop-trend">${dayBars(values, dates, what)}<div class="pop-trend-axis"><span>${fmt.dateShort(dates[0])}</span><span>${fmt.dateShort(dates.at(-1))}</span></div></div>`, note, true);
}

function splitCard(title, rows, key, s, label = (k) => k || 'Tidak diisi') {
  const g = groupTally(rows, key);
  const items = [...g].map(([k, t]) => ({
    label: label(k), value: t.berkas,
    text: s.active ? `${fmt.num(t.berkas)} berkas, ${fmt.num(t.late)} lewat SLA` : `${fmt.num(t.berkas)} berkas, ${rp(t.cair)}`,
  })).sort((a, b) => b.value - a.value).slice(0, SLA_DETAIL_TOP);
  return popCard(title, barList(items), g.size > SLA_DETAIL_TOP ? `${SLA_DETAIL_TOP} terbanyak dari ${g.size}.` : '');
}

function rankCard(title, rows, key, s, c) {
  const g = groupTally(rows, key);
  const list = [...g].filter(([k]) => k).sort((a, b) => (s.active ? b[1].late - a[1].late : 0) || b[1].berkas - a[1].berkas);
  const name = (k) => (key === 'kanca' ? `${esc(k)}<small>${esc(shortRo(c.model.kancaRo.get(k) || ''))}</small>` : esc(shortRo(k)));
  const columns = s.active ? [key === 'kanca' ? 'Kantor cabang' : 'RO', 'Berkas', 'Lewat SLA', 'Terlama'] : [key === 'kanca' ? 'Kantor cabang' : 'RO', 'Berkas', 'Nominal cair', 'Prakarsa sampai cair'];
  const body = list.slice(0, SLA_DETAIL_TOP).map(([k, t]) => (s.active
    ? [name(k), fmt.num(t.berkas), t.late ? `<b class="late-t">${fmt.num(t.late)}</b>` : '0', days(t.umurMax)]
    : [name(k), fmt.num(t.berkas), rp(t.cair), days(t.lamaAvg)]));
  const note = list.length > SLA_DETAIL_TOP ? `${SLA_DETAIL_TOP} teratas dari ${fmt.num(list.length)}, diurutkan dari ${s.active ? 'yang paling banyak lewat SLA' : 'berkas terbanyak'}.` : '';
  return popCard(title, list.length ? popTable(columns, body) : '<p class="pop-none">Tidak ada berkas.</p>', note);
}

const stageTabs = (current) => `<div class="pop-tabs" role="group" aria-label="Pilih tahap">${SLA_STAGES.map((s) =>
  `<button type="button" data-tab="${s.id}" aria-pressed="${s.id === current}"><span>${s.no}</span>${esc(s.label)}</button>`).join('')}</div>`;

function openStage(id, api, c) {
  const s = stageById(id);
  const rows = c.scoped.filter((r) => r.stage === id);
  const t = tally(rows);
  const dates = lastDays(c.end, SLA_DETAIL_DAYS);
  const trend = dayTotals(c.cells, dates, id);
  const month = c.end.slice(0, 7);
  const kpis = s.active ? [
    { label: 'Berkas di tahap ini', value: fmt.num(t.berkas) },
    { label: 'Nominal diajukan', value: rp(t.nominal) },
    { label: 'Tepat SLA', value: fmt.pct(t.onTime, 1), sub: `${fmt.num(t.ok)} berkas paling lama ${SLA_TARGET_HARI} hari` },
    { label: 'Lewat SLA', value: fmt.num(t.late), sub: lateWord, tone: t.late ? 'late' : '' },
    { label: 'Umur tercepat', value: span(t.umurMin) },
    { label: 'Umur rata-rata', value: span(t.umurAvg) },
    { label: 'Umur terlama', value: span(t.umurMax), tone: ok(t.umurMax) && t.umurMax > SLA_TARGET_HARI ? 'late' : '' },
  ] : [
    { label: 'Berkas cair', value: fmt.num(t.berkas) },
    { label: 'Nominal cair', value: rp(t.cair) },
    { label: 'Prakarsa sampai cair', value: span(t.lamaAvg), sub: `rata-rata, tercepat ${span(t.lamaMin)}, terlama ${span(t.lamaMax)}` },
    { label: `Cair di ${fmt.month(month)}`, value: fmt.num(monthCount(c, id, month)), sub: 'berkas' },
  ];
  const buckets = SLA_AGE_BUCKETS.map((b, i) => {
    const from = i ? SLA_AGE_BUCKETS[i - 1].max : -1;
    const n = sum(rows.filter((r) => hasAge(r) && r.umur > from && r.umur <= b.max).map((r) => r.berkas || 0));
    return { label: b.label, value: n, text: `${fmt.num(n)} berkas`, late: from >= SLA_TARGET_HARI };
  });
  const typeLabel = (k) => SLA_TYPE_LABEL[String(k).toLowerCase()] || k || 'Tidak diisi';
  const html = `${stageTabs(id)}${kpiTiles(kpis)}<div class="pop-grid">
    ${trendCard(`${s.event} per hari, ${SLA_DETAIL_DAYS} hari terakhir`, trend, dates, s.event)}
    ${s.active ? popCard('Umur berkas', barList(buckets), `Kuning berarti sudah lewat SLA ${SLA_TARGET_HARI} hari.`) : splitCard('Type', rows, 'type', s, typeLabel)}
    ${splitCard('Jenis pendapatan', rows, 'pendapatan', s)}
    ${rankCard('Regional Office', rows, 'ro', s, c)}
    ${rankCard('Kantor cabang', rows, 'kanca', s, c)}
    ${splitCard('Putusan', rows, 'putusan', s, (k) => (k || 'Tidak diisi').replace(/^Putusan\s+/i, ''))}
    ${splitCard('Jenis KPR', rows, 'jenis_kpr', s)}
  </div>`;
  const on = c.sel.tahap === id;
  const apply = c.linked ? 'Buka di halaman SLA' : on ? 'Tampilkan semua tahap' : `Tampilkan ${s.label} saja di halaman`;
  const dlg = openDetail({
    title: `${s.no} ${s.label}`, tone: id,
    subtitle: `${s.note}. ${[c.scope, c.sel.bulan ? `prakarsa ${fmt.month(c.sel.bulan)}` : ''].filter(Boolean).join(', ')}, posisi ${fmt.date(c.model.snapshot)}.`,
    html, footer: `<button type="button" class="btn primary" data-apply>${esc(apply)}</button>`,
  });
  dlg.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => openStage(b.dataset.tab, api, c)));
  dlg.querySelector('[data-apply]').addEventListener('click', () => { dlg.close(); act(api, c, { tahap: on && !c.linked ? '' : id }); });
}

function pivotDay(rows, key) {
  const g = new Map();
  for (const r of rows) {
    const k = r[key] || '';
    if (!g.has(k)) g.set(k, Object.fromEntries(SLA_STAGES.map((s) => [s.id, 0])));
    g.get(k)[r.tahap] += r.berkas || 0;
  }
  return [...g].filter(([k]) => k).map(([k, v]) => ({ name: k, ...v, total: sum(Object.values(v)) })).sort((a, b) => b.total - a.total);
}

function openDay(date, c) {
  const rows = c.daily.filter((r) => r.tanggal === date);
  const cell = c.cells.get(date);
  const kpis = SLA_STAGES.map((s) => ({ label: s.event, value: fmt.num(cell?.[s.id].berkas || 0), sub: cell?.[s.id].berkas ? rp(cell[s.id].nominal) : 'tidak ada berkas', tone: s.id }));
  const columns = SLA_STAGES.map((s) => s.event);
  const table = (key, title, name) => {
    const list = pivotDay(rows, key);
    const top = key === 'kanca' ? list.slice(0, SLA_DETAIL_TOP + 2) : list;
    return popCard(title, list.length ? popTable([title, ...columns], top.map((r) => [name(r.name), ...SLA_STAGES.map((s) => (r[s.id] ? fmt.num(r[s.id]) : '<span class="pop-zero">0</span>'))]))
      : '<p class="pop-none">Tidak ada berkas yang bergerak di hari ini.</p>', top.length < list.length ? `${top.length} teratas dari ${fmt.num(list.length)} kantor cabang.` : '', true);
  };
  const first = c.model.dayMin;
  const dlg = openDetail({
    title: dayTitle(date), tone: 'day',
    subtitle: `${c.scope}. Angka adalah jumlah berkas yang masuk tahap itu pada hari ini.`,
    html: `${kpiTiles(kpis)}<div class="pop-grid">
      ${table('ro', 'Regional Office', (k) => esc(shortRo(k)))}
      ${table('kanca', 'Kantor cabang', (k) => `${esc(k)}<small>${esc(shortRo(c.model.kancaRo.get(k) || ''))}</small>`)}
    </div>`,
    footer: `<button type="button" class="btn" data-go="-1"${date <= first ? ' disabled' : ''}>Hari sebelumnya</button>
      <button type="button" class="btn" data-go="1"${date >= c.end ? ' disabled' : ''}>Hari berikutnya</button>`,
  });
  dlg.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => openDay(shiftDay(date, Number(b.dataset.go)), c)));
}

const flowWidget = () => ({
  title: 'Progres berkas', desc: `Jumlah berkas dan nominal di tiap proses. Analisa dan Cair juga menampilkan waktu tercepat, rata-rata, dan terlama. Lebih dari ${SLA_TARGET_HARI} hari berarti lewat SLA. Klik kartu untuk lihat detailnya`,
  icon: 'repeat', w: 12, h: 9, minW: 6, minH: 8, fit: true, variant: 'flow',
  render(api) {
    const c = S(api);
    if (!c.model.rows.length) { api.body.innerHTML = noData(); return; }
    const st = c.stages;
    const run = tally(c.active);
    const gap = '<li class="flow-gap" aria-hidden="true"></li>';
    api.sub(`${c.model.sample ? 'Data contoh. ' : ''}${c.where}. Posisi ${fmt.date(c.model.snapshot)}.`);
    api.body.innerHTML = `${stats([
      ...(c.model.sample ? [{ label: 'Sumber data', value: 'Data contoh', tone: 'sample-t', title: 'sla.xlsx belum ada di data_raw. Angka ini buatan, RO dan kanca diambil dari dashboard lain.' }] : []),
      { label: 'Berkas berjalan', value: fmt.num(run.berkas) },
      { label: 'Lewat SLA', value: `${fmt.num(run.late)} (${share(run.late, run.ok + run.late)})`, tone: run.late ? 'late-t' : '' },
      { label: 'Kepatuhan SLA', value: fmt.pct(run.onTime, 1) },
    ])}<div class="flow">
      <div class="flow-scene">
        <div class="flow-floor" aria-hidden="true">
          <span class="flow-plinth"></span>
          <span class="flow-line"><b></b></span>
          ${SLA_STAGES.slice(1).map((s, i) => `<span class="flow-chev" style="grid-column:${i * 2 + 2}"></span>`).join('')}
        </div>
        <ol class="flow-track">${SLA_STAGES.map((s, i) => stageCard(s, st.get(s.id), c, i)).join(gap)}</ol>
      </div>
      <div class="flow-key"><span>Warna kartu sama dengan warna di grafik Progres harian.</span><span><i class="in"></i>Hijau: paling lama ${SLA_TARGET_HARI} hari (tepat SLA)</span><span><i class="late"></i>Kuning: lebih dari ${SLA_TARGET_HARI} hari (lewat SLA)</span><span class="flow-hint">Klik kartu untuk lihat detailnya</span></div>
    </div>`;
    if (!introOnce(api.body, api.body.querySelector('.flow'), () => countUp(api.body))) countUp(api.body);
    bindTilt(api.body.querySelector('.flow-scene'));
    api.body.querySelector('.flow').addEventListener('click', (e) => {
      const card = e.target.closest('[data-stage]');
      if (card) openStage(card.dataset.stage, api, c);
    });
    api.tools({
      table: () => ({
        title: 'Progres berkas', subtitle: c.where,
        columns: ['Tahap', 'Berkas', 'Nominal pengajuan', `≤ ${SLA_TARGET_HARI} hari`, `> ${SLA_TARGET_HARI} hari`, 'Rata-rata umur', 'Terlama'],
        rows: SLA_STAGES.map((s) => {
          const t = st.get(s.id);
          return [s.label, fmt.num(t.berkas), rp(t.nominal), s.active ? fmt.num(t.ok) : '', s.active ? fmt.num(t.late) : '', s.active ? days(t.umurAvg) : '', s.active ? days(t.umurMax) : ''];
        }),
      }),
    });
  },
});

const dailyWidget = () => {
  const state = { month: '', hidden: new Set() };
  return {
    title: 'Progres harian', desc: 'Jumlah berkas yang bergerak tiap hari, ditumpuk per proses. Klik batang untuk rincian hari itu per RO dan kantor cabang',
    icon: 'bars', w: 12, h: 10, minW: 6, minH: 8, fit: true,
    render(api) {
      const c = S(api);
      if (!c.model.rows.length) { api.body.innerHTML = noData(); return; }
      if (!c.model.daily.length) { api.body.innerHTML = empty('Data harian belum ada', 'Jalankan refresh-data.bat sekali lagi supaya grafik terisi.'); return; }
      const first = c.model.dayMin.slice(0, 7);
      const last = c.end.slice(0, 7);
      if (!state.month || state.month < first || state.month > last) state.month = last;
      const ym = state.month;
      const dates = Array.from({ length: daysInMonth(ym) }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`);
      const hasData = (d) => d >= c.model.dayMin && d <= c.end;
      const count = (d, id) => c.cells.get(d)?.[id].berkas || 0;
      const shown = dates.filter(hasData);
      const perDay = (id) => (shown.length ? sum(shown.map((d) => count(d, id))) / shown.length : 0);
      const wide = api.body.clientWidth >= 720;

      api.sub(`${c.scope}. Data sampai ${fmt.date(c.end)}.`);
      api.body.innerHTML = `<div class="daily">
        <div class="cal-top">
          <div class="cal-nav">
            <button type="button" class="icon-btn flip" data-step="-1" aria-label="Bulan sebelumnya"${ym <= first ? ' disabled' : ''}>${icon('chevron', 16)}</button>
            <b aria-live="polite">${fmt.month(ym)}</b>
            <button type="button" class="icon-btn" data-step="1" aria-label="Bulan berikutnya"${ym >= last ? ' disabled' : ''}>${icon('chevron', 16)}</button>
          </div>
          <p class="daily-note">Tinggi batang = jumlah berkas yang masuk tiap proses pada hari itu. Klik kotak proses untuk menyembunyikan atau menampilkannya.</p>
        </div>
        <div class="cal-sum" role="group" aria-label="Tampilkan proses">${SLA_STAGES.map((s) => `<button type="button" data-toggle="${s.id}" aria-pressed="${!state.hidden.has(s.id)}" style="--dot:${SLA_STAGE_COLOR[s.id]}">
          <span class="cal-sum-name"><i></i><span><b>${esc(s.label)}</b>${esc(s.event === s.label ? 'Kredit dicairkan' : s.event)}</span></span>
          <span class="cal-sum-value"><b>${fmt.num(sum(shown.map((d) => count(d, s.id))))}</b><small>rata-rata ${fmt.num(Math.round(perDay(s.id)))}/hari</small></span></button>`).join('')}</div>
        ${chartBox(api, 'c', `Berkas per hari per proses, ${fmt.month(ym)}`, 'daily-chart')}
      </div>`;

      const stack = [...SLA_STAGES].reverse();
      const chart = barChart(canvasOf(api, 'c'), {
        labels: dates.map((d) => String(Number(d.slice(8)))),
        stacked: true, segments: true,
        valueLabels: wide ? 'auto' : false,
        series: stack.map((s) => ({
          label: s.event, color: SLA_STAGE_COLOR[s.id], hidden: state.hidden.has(s.id),
          data: dates.map((d) => (hasData(d) ? count(d, s.id) : null)),
        })),
        format: (v) => `${fmt.num(v)} berkas`, labelFormat: (v) => fmt.num(v), sort: 'stack',
        title: (pts) => dayTitle(dates[pts[0].dataIndex]),
        footer: { label: 'Total', value: (pts) => `${fmt.num(pts.reduce((t, x) => t + (x.parsed.y || 0), 0))} berkas` },
        onClick: (i) => { if (hasData(dates[i])) openDay(dates[i], c); },
      });

      const root = api.body.querySelector('.daily');
      root.addEventListener('click', (e) => {
        const step = e.target.closest('[data-step]');
        if (step) { state.month = shiftMonth(ym, Number(step.dataset.step)); this.render(api); return; }
        const toggle = e.target.closest('[data-toggle]');
        if (!toggle) return;
        const id = toggle.dataset.toggle;
        const off = !state.hidden.has(id);
        if (off && state.hidden.size >= SLA_STAGES.length - 1) return;
        if (off) state.hidden.add(id); else state.hidden.delete(id);
        toggle.setAttribute('aria-pressed', String(!off));
        chart.setDatasetVisibility(stack.findIndex((s) => s.id === id), !off);
        chart.update();
      });
      api.tools({
        png: api.cid('c'),
        table: () => ({
          title: `Progres harian, ${fmt.month(ym)}`, subtitle: c.scope,
          columns: ['Tanggal', ...SLA_STAGES.map((s) => s.event), 'Total'],
          rows: shown.map((d) => [fmt.date(d), ...SLA_STAGES.map((s) => fmt.num(count(d, s.id))), fmt.num(sum(SLA_STAGES.map((s) => count(d, s.id))))]),
        }),
      });
    },
  };
};

const needAge = (c) => (c.focus.length ? null : empty('Belum ada berkas berjalan di filter ini',
  stageById(c.sel.tahap) && !stageById(c.sel.tahap).active ? 'Umur berkas hanya dihitung untuk Prakarsa, Analisa, dan Putusan.' : 'Coba ubah filter.'));

export const slaWidgets = {
  flow: flowWidget,
  daily: dailyWidget,

  income: () => ({
    title: 'SLA per jenis pendapatan', desc: `Fix Income dan Non Fix Income per tahap: porsi berkas yang paling lama ${SLA_TARGET_HARI} hari`,
    icon: 'users', w: 6, h: 7, minW: 4, minH: 5,
    render(api) {
      const c = S(api);
      if (!c.model.rows.length) { api.body.innerHTML = noData(); return; }
      const gate = needAge(c);
      if (gate) { api.body.innerHTML = gate; return; }
      const stages = c.sel.tahap ? ACTIVE_STAGES.filter((s) => s.id === c.sel.tahap) : ACTIVE_STAGES;
      const groups = uniq(c.focus.map((r) => r.pendapatan)).sort(byText);
      api.sub(`${c.where}. Bar biru = porsi berkas yang paling lama ${SLA_TARGET_HARI} hari.`);
      api.body.innerHTML = `<div class="sla-income scroll">${groups.map((g) => {
        const all = tally(c.focus.filter((r) => r.pendapatan === g));
        return `<section class="sla-income-col"><header><h3>${esc(g || 'Tidak diisi')}</h3><span><b>${fmt.pct(all.onTime, 1)}</b> tepat SLA</span></header>
          <ul>${stages.map((s) => {
            const t = tally(c.focus.filter((r) => r.pendapatan === g && r.stage === s.id));
            return `<li><span class="sla-income-name">${esc(s.label)}</span>
              <span class="sla-income-pct">${fmt.pct(t.onTime, 1)}</span>
              <span class="sla-income-bar" role="img" aria-label="${esc(s.label)} ${esc(g)}: ${fmt.pct(t.onTime, 1)} tepat SLA"><i style="width:${((t.onTime || 0) * 100).toFixed(1)}%"></i></span>
              <span class="sla-income-meta">${t.berkas ? `${fmt.num(t.berkas)} berkas, ${fmt.num(t.late)} lewat SLA, rata-rata ${days(t.umurAvg)}` : 'Tidak ada berkas'}</span></li>`;
          }).join('')}</ul></section>`;
      }).join('')}</div>`;
    },
  }),

  kanca: () => {
    const state = { key: 'late', dir: 'desc' };
    return {
      title: 'Kantor cabang dengan berkas lewat SLA', desc: 'Per kantor cabang: berkas berjalan, lewat SLA, dan umur terlama. Klik baris untuk memfilter',
      icon: 'bank', w: 6, h: 8, minW: 4, minH: 5,
      render(api) {
        const c = S(api);
        if (!c.model.rows.length) { api.body.innerHTML = noData(); return; }
        const gate = needAge(c);
        if (gate) { api.body.innerHTML = gate; return; }
        const g = groupTally(c.focus, 'kanca');
        const rows = [...g].filter(([k]) => k).map(([kanca, t]) => ({
          kanca, ro: c.model.kancaRo.get(kanca) || '', berkas: t.berkas, late: t.late, pct: ratio(t.late, t.ok + t.late), avg: t.umurAvg, max: t.umurMax,
        }));
        const lateKanca = rows.filter((r) => r.late > 0).length;
        api.sub(`${c.where}. ${fmt.num(lateKanca)} dari ${fmt.num(rows.length)} kantor cabang punya berkas lewat SLA.`);
        const draw = () => {
          api.body.innerHTML = `<div class="scroll">${sortableTable({
            id: api.cid('t'), caption: 'Kantor cabang dengan berkas lewat SLA', sortKey: state.key, sortDir: state.dir,
            rowAttrs: (r) => `data-kanca="${esc(r.kanca)}" tabindex="0"${c.sel.kanca === r.kanca ? ' aria-selected="true"' : ''}`,
            columns: [
              { key: 'kanca', label: 'Kantor cabang', render: (r) => `<span class="cell-main">${esc(r.kanca)}</span><small class="cell-sub">${esc(shortRo(r.ro))}</small>` },
              { key: 'berkas', label: 'Berjalan', render: (r) => fmt.num(r.berkas) },
              { key: 'late', label: 'Lewat SLA', render: (r) => (r.late ? `<b class="late-t">${fmt.num(r.late)}</b>` : '0') },
              { key: 'pct', label: '% lewat', render: (r) => fmt.pct(r.pct, 0) },
              { key: 'max', label: 'Terlama', render: (r) => days(r.max) },
            ],
            rows,
          })}</div>`;
        };
        draw();
        api.body.addEventListener('click', (e) => {
          const th = e.target.closest('[data-sort]');
          if (th) {
            const k = th.getAttribute('data-sort');
            state.dir = k === state.key && state.dir === 'desc' ? 'asc' : 'desc';
            state.key = k;
            draw();
            return;
          }
          const tr = e.target.closest('[data-kanca]');
          if (tr) { const k = tr.getAttribute('data-kanca'); act(api, c, { kanca: c.sel.kanca === k ? '' : k }); }
        });
        api.body.addEventListener('keydown', (e) => {
          const tr = e.target.closest('[data-kanca]');
          if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tr.click(); }
        });
        api.tools({
          table: () => ({
            title: 'Kantor cabang dengan berkas lewat SLA', subtitle: c.where,
            columns: ['Kantor cabang', 'RO', 'Berjalan', 'Lewat SLA', '% lewat', 'Rata-rata umur', 'Terlama'],
            rows: [...rows].sort((a, b) => b.late - a.late).map((r) => [r.kanca, r.ro, fmt.num(r.berkas), fmt.num(r.late), fmt.pct(r.pct, 1), days(r.avg), days(r.max)]),
          }),
        });
      },
    };
  },

  putusan: () => ({
    title: 'Putusan Cabang dan CLF', desc: 'Perbandingan kecepatan dan hasil berkas yang diputus cabang dan CLF',
    icon: 'scatter', w: 4, h: 7, minW: 3, minH: 5,
    render(api) {
      const c = S(api);
      if (!c.model.rows.length) { api.body.innerHTML = noData(); return; }
      const kinds = uniq(c.scoped.map((r) => r.putusan)).filter(Boolean).sort(byText);
      if (!kinds.length) { api.body.innerHTML = empty('Tidak ada berkas di filter ini'); return; }
      api.sub(`${[c.sel.ro || 'Nasional', c.sel.kanca, c.sel.pendapatan, c.sel.bulan ? `prakarsa ${fmt.month(c.sel.bulan)}` : ''].filter(Boolean).join(', ')}, semua tahap.`);
      api.body.innerHTML = `<div class="sla-compare scroll">${kinds.map((k) => {
        const mine = c.scoped.filter((r) => r.putusan === k);
        const run = tally(mine.filter((r) => ACTIVE_STAGES.some((s) => s.id === r.stage)));
        const cair = tally(mine.filter((r) => r.stage === 'cair'));
        return `<section><h3>${esc(k)}</h3><dl>
          <div><dt>Berkas berjalan</dt><dd>${fmt.num(run.berkas)}</dd></div>
          <div><dt>Lewat SLA</dt><dd class="${run.late ? 'late-t' : ''}">${fmt.num(run.late)} (${share(run.late, run.ok + run.late)})</dd></div>
          <div><dt>Rata-rata umur</dt><dd>${days(run.umurAvg)}</dd></div>
          <div><dt>Sudah cair</dt><dd>${fmt.num(cair.berkas)}</dd></div>
          <div><dt>Nominal cair</dt><dd>${rp(cair.cair)}</dd></div>
          <div><dt>Prakarsa sampai cair</dt><dd>${days(cair.lamaAvg)}</dd></div>
        </dl></section>`;
      }).join('')}</div>`;
    },
  }),

  komposisi: () => {
    const state = { dim: 'pekerjaan' };
    const DIMS = [{ value: 'pekerjaan', label: 'Pekerjaan' }, { value: 'pendapatan', label: 'Pendapatan' }];
    return {
      title: 'Komposisi berkas', desc: 'Porsi berkas menurut jenis pekerjaan atau jenis pendapatan',
      icon: 'donut', w: 4, h: 7, minW: 3, minH: 5,
      render(api) {
        const c = S(api);
        if (!c.model.rows.length) { api.body.innerHTML = noData(); return; }
        const g = groupTally(c.rows, state.dim);
        const label = (k) => SLA_TYPE_LABEL[String(k).toLowerCase()] || (k || 'Tidak diisi').replace(/^KPR Perorangan\s+/i, '');
        const items = [...g].map(([k, t], i) => ({ label: label(k), value: t.berkas, color: SERIES[i % SERIES.length] }))
          .sort((a, b) => b.value - a.value).map((x, i) => ({ ...x, color: SERIES[i % SERIES.length] }));
        const total = items.reduce((t, x) => t + x.value, 0);
        api.sub(`${c.where}, ${fmt.num(total)} berkas.`);
        api.body.innerHTML = `<div class="sla-comp-top">${seg({ name: api.cid('dim'), label: 'Tampilkan', value: state.dim, small: true, options: DIMS })}</div>${donutHtml(api, 'd', 'Komposisi berkas')}`;
        mountDonut(api, 'd', items, { center: fmt.num(total), centerSub: 'berkas', format: (v) => `${fmt.num(v)} berkas` });
        onSeg(api.body, api.cid('dim'), (v) => { state.dim = v; this.render(api); });
      },
    };
  },
};

export default {
  id: 'sla', title: 'SLA', icon: 'clock',
  load: loadSla,
  normalize(p, m) {
    return {
      ro: m.ros.includes(p.ro) ? p.ro : '',
      kanca: p.kanca || '',
      tahap: SLA_STAGES.some((s) => s.id === p.tahap) ? p.tahap : '',
      pendapatan: m.pendapatan.includes(p.pendapatan) ? p.pendapatan : '',
      putusan: m.putusan.includes(p.putusan) ? p.putusan : '',
      bulan: m.months.includes(p.bulan) ? p.bulan : '',
    };
  },
  context(m, sel) {
    const kancas = uniq(m.rows.filter((r) => !sel.ro || r.ro === sel.ro).map((r) => r.kanca)).filter(Boolean).sort(byText);
    if (sel.kanca && !kancas.includes(sel.kanca)) sel.kanca = '';
    return { ...slaContext(m, sel), kancas, view: 'sla' };
  },
  subtitle(c) {
    if (!c.model.rows.length) return 'Data SLA belum ada';
    return `${c.model.sample ? 'Data contoh (sla.xlsx belum ada). ' : ''}${c.where}, posisi ${fmt.date(c.model.snapshot)}. Batas SLA ${SLA_TARGET_HARI} hari per proses.`;
  },
  filters(c) {
    const { model: m, sel } = c;
    if (!m.rows.length) return '';
    const dirty = sel.ro || sel.kanca || sel.tahap || sel.pendapatan || sel.putusan || sel.bulan;
    return `${pick({ id: 'f-ro', label: 'Regional Office', value: sel.ro, on: !!sel.ro, options: [{ value: '', label: 'Nasional' }, ...m.ros.map((r) => ({ value: r, label: r }))] })}
      ${searchPick({ id: 'f-kanca', label: 'Kantor cabang', value: sel.kanca, allLabel: 'Semua' })}
      ${pick({ id: 'f-tahap', label: 'Tahap', value: sel.tahap, on: !!sel.tahap, options: [{ value: '', label: 'Semua' }, ...SLA_STAGES.map((s) => ({ value: s.id, label: s.label }))] })}
      ${m.pendapatan.length > 1 ? seg({ name: 'f-pendapatan', label: 'Jenis pendapatan', value: sel.pendapatan, small: true, options: [{ value: '', label: 'Semua' }, ...m.pendapatan.map((p) => ({ value: p, label: p }))] }) : ''}
      ${pick({ id: 'f-putusan', label: 'Putusan', value: sel.putusan, on: !!sel.putusan, options: [{ value: '', label: 'Semua' }, ...m.putusan.map((p) => ({ value: p, label: p.replace(/^Putusan\s+/i, '') }))] })}
      ${pick({ id: 'f-bulan', label: 'Bulan prakarsa', value: sel.bulan, on: !!sel.bulan, options: [{ value: '', label: 'Semua' }, ...[...m.months].reverse().map((x) => ({ value: x, label: fmt.month(x) }))] })}
      ${dirty ? '<button class="reset" type="button" data-reset>Reset filter</button>' : ''}`;
  },
  bindFilters(root, c, set) {
    if (!c.model.rows.length) return;
    root.querySelector('#f-ro').addEventListener('change', (e) => set({ ro: e.target.value, kanca: '' }));
    root.querySelector('#f-tahap').addEventListener('change', (e) => set({ tahap: e.target.value }));
    root.querySelector('#f-putusan').addEventListener('change', (e) => set({ putusan: e.target.value }));
    root.querySelector('#f-bulan').addEventListener('change', (e) => set({ bulan: e.target.value }));
    onSeg(root, 'f-pendapatan', (v) => set({ pendapatan: v }));
    bindSearchPick({ id: 'f-kanca', options: c.kancas, value: c.sel.kanca, allLabel: 'Semua', onChange: (v) => set({ kanca: v }) });
    root.querySelector('[data-reset]')?.addEventListener('click', () => set({ ro: '', kanca: '', tahap: '', pendapatan: '', putusan: '', bulan: '' }));
  },
  widgets: {
    flow: slaWidgets.flow(),
    daily: slaWidgets.daily(),
    income: slaWidgets.income(),
    kanca: slaWidgets.kanca(),
    putusan: slaWidgets.putusan(),
    komposisi: slaWidgets.komposisi(),
  },
  layout: [
    { id: 'flow', x: 0, y: 0, w: 12, h: 9 },
    { id: 'daily', x: 0, y: 9, w: 12, h: 10 },
    { id: 'income', x: 0, y: 19, w: 6, h: 6 },
    { id: 'putusan', x: 6, y: 19, w: 6, h: 6 },
    { id: 'kanca', x: 0, y: 25, w: 6, h: 8 },
    { id: 'komposisi', x: 6, y: 25, w: 6, h: 8 },
  ],
};
