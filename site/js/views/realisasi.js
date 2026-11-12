import { fmt, esc, shortRo } from '../core/format.js';
import { ratio, uniq, byText, ok } from '../core/values.js';
import { daysInMonth, prevMonth, weekday, DAYS_SHORT } from '../core/dates.js';
import { pick, seg, onSeg, searchPick, bindSearchPick } from '../core/controls.js';
import { sparkline } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { REALISASI_HIGHLIGHT_MONTHS, REALISASI_PLAFOND_UNIT } from '../config.js';
import { colorIndexOf, groupedColumns, listOf, modeOptions, sumberKey, sumberMode, tipeFor, unassigned } from '../models/realisasi-sumber.js';
import { lineChart, barChart, bindLegend, emphasize, C, SERIES, CONTEXT_GRAY, seqColor } from '../charts/charts.js';
import { loadReal } from '../services/datasets.js';
import { chartBox, canvasOf, legend, legendOf, delta, rankList, donutHtml, mountDonut, onPick, empty } from '../widgets/widget-kit.js';
import { analysisWidget } from '../widgets/insights-panel.js';
import { renderBranchMap } from '../map/map-panel.js';

const UNIT = { rupiah: 1, juta: 1e6, miliar: 1e9 }[REALISASI_PLAFOND_UNIT] || 1;
export const plafondText = (v, d = 2) => fmt.rupiah(ok(v) ? v * UNIT : v, d);
const plafondAxis = (v) => {
  if (!ok(v)) return '–';
  const a = Math.abs(v * UNIT);
  const scaled = a >= 1e12 ? a / 1e12 : a >= 1e9 ? a / 1e9 : a >= 1e6 ? a / 1e6 : a;
  return plafondText(v, scaled < 10 && Math.abs(scaled - Math.round(scaled)) > 0.05 ? 1 : 0);
};

const sum = (rows, f) => rows.reduce((t, r) => t + (ok(r[f]) ? r[f] : 0), 0);
const groupSum = (rows, key, f) => {
  const m = new Map();
  for (const r of rows) m.set(r[key], (m.get(r[key]) || 0) + (ok(r[f]) ? r[f] : 0));
  return m;
};
const R = (api) => api.ctx.real || api.ctx;
const act = (api, c, patch) => (c.linked ? api.go('realisasi', { bulan: c.sel.bulan, ...patch }) : api.set(patch));
export const tipeColor = (model, t) => SERIES[colorIndexOf(t) % SERIES.length];

export function realContext(model, sel, { linked = false } = {}) {
  const base = model.rows.filter((r) => (!sel.ro || r.ro === sel.ro) && (!sel.kanca || r.kanca === sel.kanca) && (!sel.rm || r.rm === sel.rm));
  const mode = sumberMode(sel.sumber, model);
  const key = sumberKey(mode);
  const tipes = listOf(model, mode);
  const tb = sel.tipe ? base.filter((r) => r[key] === sel.tipe) : base;
  const field = sel.ukuran === 'debitur' ? 'debitur' : 'plafond';
  const isLatest = sel.bulan === model.months.at(-1);
  const lastDay = isLatest ? Number(model.maxDate.slice(8, 10)) : daysInMonth(sel.bulan);
  const pm = prevMonth(sel.bulan);
  const year = sel.bulan.slice(0, 4);
  return {
    model, sel, base, tb, field, linked, isLatest, lastDay, pm, mode, key, tipes,
    cur: tb.filter((r) => r.bulan === sel.bulan),
    prevSame: tb.filter((r) => r.bulan === pm && r.hari <= lastDay),
    yearMonths: model.months.filter((m) => m.startsWith(year) && m <= sel.bulan),
    fmtV: field === 'plafond' ? (v) => plafondText(v) : (v) => `${fmt.num(v)} deb`,
    axisV: field === 'plafond' ? plafondAxis : (v) => fmt.compact(v),
    word: field === 'plafond' ? 'plafond' : 'debitur',
    where: [sel.ro || 'Nasional', sel.kanca, sel.rm, sel.tipe].filter(Boolean).join(', '),
  };
}

function monthPalette(c) {
  const hl = c.yearMonths.slice(-Math.min(REALISASI_HIGHLIGHT_MONTHS, SERIES.length)).reverse();
  return (m) => { const k = hl.indexOf(m); return { color: k >= 0 ? SERIES[k] : CONTEXT_GRAY, rank: k }; };
}

function cumByMonth(c, rows, months) {
  return months.map((m) => {
    const daily = new Array(31).fill(0);
    for (const r of rows) if (r.bulan === m) daily[r.hari - 1] += ok(r[c.field]) ? r[c.field] : 0;
    const end = m === c.model.months.at(-1) ? Number(c.model.maxDate.slice(8, 10)) : daysInMonth(m);
    let run = 0;
    return { m, data: daily.map((v, i) => (i < end ? (run += v) : null)), total: run };
  });
}

function gapNote(api, c, rows, short) {
  const gaps = unassigned(rows, c.mode, c.field);
  if (!gaps.length) return '';
  const sum = gaps.reduce((a, g) => a + g.value, 0);
  const monthsOf = (g) => [...g.months].sort().map((m) => fmt.month(m, true)).join(', ');
  const lines = gaps.map((g) => `${g.label ? `Kolom ${g.column} berisi "${g.label}"` : `Kolom ${g.column} kosong`}: ${short(g.value)} (${monthsOf(g)}). ${g.targets.length
    ? `Belum bisa dirinci ke ${g.targets.join(', ')}.`
    : 'Isinya tidak ada di daftar sumber.'}`);
  const id = api.cid('gap');
  return `<div class="stats seg-gap-chip"><button type="button" class="seg-gap-btn" popovertarget="${id}" title="${esc(lines.join(' '))}">${icon('alert', 14)}${esc(short(sum))} belum masuk ${c.mode} sumber</button>
    <aside class="seg-gap-pop" id="${id}" popover><h3>Kenapa ada realisasi yang belum masuk sumber?</h3>
    <p>Angka ini tetap dihitung di Total realisasi, tetapi tidak masuk kotak sumber mana pun di tampilan ${c.mode} sumber.</p>
    <ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    <p>Supaya terbagi, isi kolom <code>${c.mode === '7' ? 'Tipe KPR' : `${c.mode} Sumber`}</code> di Excel dengan salah satu nama sumber, lalu jalankan refresh-data.bat.</p></aside></div>`;
}

export const realWidgets = {
  summary: () => ({
    title: 'Total realisasi per sumber', desc: 'Total tahun berjalan per sumber dan tabel per bulan (seperti dashboard Looker)',
    icon: 'table', w: 12, h: 9, minW: 8, minH: 5,
    render(api) {
      const c = R(api);
      const months = c.yearMonths;
      const tipes = c.tipes;
      const rows = c.base.filter((r) => months.includes(r.bulan));
      const cell = new Map();
      for (const r of rows) {
        const k = `${r.bulan}|${r[c.key]}`;
        cell.set(k, (cell.get(k) || 0) + (ok(r[c.field]) ? r[c.field] : 0));
      }
      const groupCell = new Map();
      const monthCell = new Map();
      for (const r of rows) {
        const v = ok(r[c.field]) ? r[c.field] : 0;
        monthCell.set(r.bulan, (monthCell.get(r.bulan) || 0) + v);
        const g = `${r.bulan}|${r.sumber5}`;
        groupCell.set(g, (groupCell.get(g) || 0) + v);
      }
      const byTipe = (t) => months.reduce((a, m) => a + (cell.get(`${m}|${t}`) || 0), 0);
      const byMonth = (m) => monthCell.get(m) || 0;
      const total = months.reduce((a, m) => a + byMonth(m), 0);
      const short = c.field === 'plafond' ? (v) => plafondText(v, 1) : (v) => fmt.num(v);
      const pal = monthPalette(c);
      const period = months.length ? `${fmt.month(months[0], true)} s.d. ${fmt.month(months.at(-1), true)}${c.isLatest ? ` (tgl ${c.lastDay})` : ''}` : '';
      const cols = groupedColumns(c.mode, tipes);
      const groupSumAt = (m, group) => groupCell.get(`${m}|${group}`) || 0;
      const headTop = cols.map((x) => (x.tipe
        ? `<th scope="col" rowspan="2">${esc(x.tipe)}</th>`
        : `<th scope="colgroup" colspan="${x.members.length + 1}" class="col-group">${esc(x.group)}</th>`)).join('');
      const headSub = cols.filter((x) => x.group).map((x) => `${x.members.map((t) => `<th scope="col">${esc(t)}</th>`).join('')}<th scope="col" class="col-group-total">Total ${esc(x.group)}</th>`).join('');
      const bodyCells = (m) => cols.map((x) => (x.tipe
        ? `<td${c.sel.tipe === x.tipe ? ' class="on"' : ''}>${esc(short(cell.get(`${m}|${x.tipe}`) || 0))}</td>`
        : `${x.members.map((t) => `<td${c.sel.tipe === t ? ' class="on"' : ''}>${esc(short(cell.get(`${m}|${t}`) || 0))}</td>`).join('')}<td class="col-group-total"><b>${esc(short(groupSumAt(m, x.group)))}</b></td>`)).join('');
      const twoRows = cols.some((x) => x.group);
      api.sub(`${[c.sel.ro || 'Nasional', c.sel.kanca, c.sel.rm].filter(Boolean).join(', ')}, ${c.word}, ${period}, ${c.mode} sumber. Klik sumber atau bulan untuk filter.`);
      api.body.innerHTML = `${gapNote(api, c, rows, short)}<div class="realisasi-totals tiles">
          <button type="button" class="tile lead realisasi-total" data-tipe="" aria-pressed="${!c.sel.tipe}">
            <span class="tile-body"><span class="tile-h"><span class="tile-l">Total realisasi</span></span>
            <span class="tile-v">${esc(short(total))}</span><span class="tile-sub">${months.length} bulan</span></span></button>
          ${tipes.map((t) => `<button type="button" class="tile realisasi-type" data-tipe="${esc(t)}" style="--c:${tipeColor(c.model, t)}" aria-pressed="${c.sel.tipe === t}">
            <span class="tile-body"><span class="tile-h"><i class="swatch" aria-hidden="true"></i><span class="tile-l">${esc(t)}</span></span>
            <span class="tile-v sm">${esc(short(byTipe(t)))}</span><span class="tile-sub">${fmt.pct(ratio(byTipe(t), total), 1)} dari total</span></span></button>`).join('')}
        </div>
        <div class="table-wrap scroll" tabindex="0" role="region" aria-label="Realisasi per bulan per sumber"><table class="data-table realisasi-table${twoRows ? ' grouped' : ''}">
          <thead><tr><th scope="col"${twoRows ? ' rowspan="2"' : ''}>Bulan</th><th scope="col"${twoRows ? ' rowspan="2"' : ''}>Total</th>${twoRows ? headTop : tipes.map((t) => `<th scope="col">${esc(t)}</th>`).join('')}</tr>
            ${twoRows ? `<tr>${headSub}</tr>` : ''}</thead>
          <tbody>${months.map((m) => `<tr data-bulan="${m}" tabindex="0"${m === c.sel.bulan ? ' aria-selected="true"' : ''}>
            <th scope="row"><i class="swatch" style="--c:${pal(m).color}"></i>${fmt.month(m)}</th><td><b>${esc(short(byMonth(m)))}</b></td>
            ${bodyCells(m)}</tr>`).join('')}</tbody></table></div>`;
      onPick(api, 'data-tipe', (t) => act(api, c, { tipe: t && c.sel.tipe !== t ? t : '' }));
      onPick(api, 'data-bulan', (m) => act(api, c, { bulan: m }));
      api.tools({
        table: () => ({
          title: 'Realisasi per bulan per sumber', subtitle: `${c.where}, ${c.word}, ${c.mode} sumber`,
          columns: ['Bulan', 'Total', ...cols.flatMap((x) => (x.tipe ? [x.tipe] : [...x.members, `Total ${x.group}`]))],
          rows: months.map((m) => [fmt.month(m), c.fmtV(byMonth(m)), ...cols.flatMap((x) => (x.tipe
            ? [c.fmtV(cell.get(`${m}|${x.tipe}`) || 0)]
            : [...x.members.map((t) => c.fmtV(cell.get(`${m}|${t}`) || 0)), c.fmtV(groupSumAt(m, x.group))]))]),
        }),
      });
    },
  }),

  cumGrid: () => ({
    title: 'Kumulatif harian: total dan per sumber', desc: 'Grafik Total di tengah, dikelilingi grafik tiap sumber. Satu garis per bulan',
    icon: 'grid', w: 12, h: 14, minW: 8, minH: 9, grow: true,
    render(api) {
      const c = R(api);
      const months = c.yearMonths;
      if (!months.length) { api.body.innerHTML = empty('Belum ada data'); return; }
      const pal = monthPalette(c);
      const cells = [{ key: 'total', label: 'Total realisasi', rows: c.base }, ...c.tipes.map((t) => ({ key: t, label: t, rows: c.base.filter((r) => r[c.key] === t), tipe: t }))];
      const colored = months.filter((m) => pal(m).rank >= 0).sort((a, b) => pal(a).rank - pal(b).rank);
      api.sub(`${[c.sel.ro || 'Nasional', c.sel.kanca, c.sel.rm].filter(Boolean).join(', ')}, ${c.word}, tanggal 1–31. ${c.linked ? '' : 'Klik nama sumber untuk filter.'}`);
      api.body.innerHTML = `<div class="cumulative-legend">${colored.map((m) => `<span style="--c:${pal(m).color}"><i></i>${fmt.month(m, true)}</span>`).join('')}
          ${months.length > colored.length ? `<span style="--c:${CONTEXT_GRAY}"><i></i>Bulan lain</span>` : ''}</div>
        <div class="cumulative-grid" data-count="${c.tipes.length}">${cells.map((x, i) => `<div class="cumulative-cell${x.key === 'total' ? ' cumulative-total' : ''}${c.sel.tipe && x.tipe === c.sel.tipe ? ' on' : ''}" style="--c:${x.tipe ? tipeColor(c.model, x.tipe) : 'var(--accent)'}">
            <div class="cumulative-head">${x.tipe ? `<button type="button" class="link" data-tipe="${esc(x.tipe)}"><i></i>${esc(x.label)}</button>` : `<b>${esc(x.label)}</b>`}
              <span id="${api.cid(`v${i}`)}"></span></div>
            <div class="chart-box"><canvas id="${api.cid(`g${i}`)}" role="img" aria-label="Kumulatif harian ${esc(x.label)} per bulan"></canvas></div></div>`).join('')}</div>`;
      cells.forEach((x, i) => {
        const ser = cumByMonth(c, x.rows, months);
        const cur = ser.find((q) => q.m === c.sel.bulan);
        api.body.querySelector(`#${CSS.escape(api.cid(`v${i}`))}`).textContent = c.fmtV(cur ? cur.total : 0);
        lineChart(canvasOf(api, `g${i}`), {
          labels: Array.from({ length: 31 }, (_, k) => String(k + 1)),
          series: ser.map((q) => {
            const p = pal(q.m);
            return { label: fmt.month(q.m, true), data: q.data, color: p.color, width: p.rank === 0 ? 2.4 : p.rank > 0 ? 1.6 : 1, order: p.rank >= 0 ? p.rank : 50 };
          }),
          yAxis: x.key === 'total', tickFormat: c.axisV, format: c.fmtV, labelFormat: c.axisV, sort: true, title: (pt) => `${x.label}, tanggal ${pt[0].label}`,
        });
      });
      onPick(api, 'data-tipe', (t) => act(api, c, { tipe: c.sel.tipe === t && !c.linked ? '' : t }));
      api.tools({
        table: () => {
          const ser = cumByMonth(c, c.base, months);
          return {
            title: 'Total realisasi kumulatif harian', subtitle: c.where,
            columns: ['Tanggal', ...months.map((m) => fmt.month(m, true))],
            rows: Array.from({ length: 31 }, (_, k) => [String(k + 1), ...ser.map((q) => (q.data[k] === null ? '' : c.fmtV(q.data[k])))]),
          };
        },
      });
    },
  }),

  hero: () => ({
    title: 'Realisasi bulan ini', desc: 'Total realisasi bulan terpilih dibanding periode yang sama bulan lalu',
    icon: 'trend', w: 4, h: 6, minW: 3, minH: 5, variant: 'feature',
    render(api) {
      const c = R(api);
      const total = sum(c.cur, c.field);
      const prev = sum(c.prevSame, c.field);
      const plaf = sum(c.cur, 'plafond'); const deb = sum(c.cur, 'debitur');
      const rmAktif = uniq(c.cur.filter((r) => r.rm && (r.debitur || 0) > 0).map((r) => r.rm)).length;
      const ytd = sum(c.tb.filter((r) => c.yearMonths.includes(r.bulan)), c.field);
      const daily = Array.from({ length: c.lastDay }, (_, i) => sum(c.cur.filter((r) => r.hari === i + 1), c.field));
      let run = 0; const cum = daily.map((v) => (run += v));
      api.sub(`${c.where}, ${fmt.month(c.sel.bulan)}${c.isLatest ? ` s.d. tanggal ${c.lastDay}` : ''}`);
      api.body.innerHTML = `<div class="feature real-hero">
        <div class="hero-top"><span class="hero-label">Total ${c.word}</span>${sparkline(cum, { w: 120, h: 36, color: '#0857C3' })}</div>
        <div class="feature-v">${esc(c.fmtV(total))}</div>
        <p class="hero-compare">${delta(ratio(total - prev, prev))} dibanding ${fmt.month(c.pm, true)} tanggal 1–${c.lastDay} (${esc(c.fmtV(prev))})</p>
        <div class="feature-meta">
          <span>${c.field === 'plafond' ? 'Debitur' : 'Plafond'} <b>${c.field === 'plafond' ? fmt.num(deb) : plafondText(plaf)}</b></span>
          <span>Rata-rata per debitur <b>${plafondText(ratio(plaf, deb))}</b></span>
          <span>RM aktif <b>${fmt.num(rmAktif)}</b></span>
          <span>Total ${c.sel.bulan.slice(0, 4)} <b>${esc(c.fmtV(ytd))}</b></span>
        </div></div>`;
    },
  }),

  tipe: () => ({
    title: 'Per sumber', desc: 'Realisasi per sumber dengan porsi dan perubahan dari bulan lalu',
    icon: 'bars-horizontal', w: 8, h: 6, minW: 3, minH: 4,
    render(api) {
      const c = R(api);
      const rows = c.base.filter((r) => r.bulan === c.sel.bulan);
      const prevRows = c.base.filter((r) => r.bulan === c.pm && r.hari <= c.lastDay);
      const now = groupSum(rows, c.key, c.field);
      const before = groupSum(prevRows, c.key, c.field);
      const total = [...now.values()].reduce((a, b) => a + b, 0);
      const items = c.tipes.map((t) => ({ t, v: now.get(t) || 0, p: before.get(t) || 0 }));
      if (!total) { api.body.innerHTML = empty('Belum ada realisasi di bulan ini'); return; }
      const max = Math.max(...items.map((i) => i.v), 1);
      api.sub(`${c.word === 'plafond' ? 'Plafond' : 'Debitur'}, ${fmt.month(c.sel.bulan)}. Perubahan dibanding periode sama bulan lalu. ${c.linked ? 'Klik untuk membuka Realisasi.' : 'Klik sumber untuk memfilter semua panel.'}`);
      api.body.innerHTML = `<ul class="type-list scroll">${items.map((i) => `<li><button type="button" data-tipe="${esc(i.t)}"${c.sel.tipe === i.t ? ' aria-pressed="true"' : ''}
          style="--c:${tipeColor(c.model, i.t)}">
          <span class="type-name"><i></i>${esc(i.t)}</span>
          <span class="type-bar"><b style="width:${Math.max(1, (i.v / max) * 100).toFixed(1)}%"></b></span>
          <span class="type-value">${esc(c.fmtV(i.v))}</span>
          <span class="type-sub">${fmt.pct(ratio(i.v, total), 1)}</span>
          <span class="type-delta">${delta(ratio(i.v - i.p, i.p))}</span></button></li>`).join('')}</ul>`;
      onPick(api, 'data-tipe', (t) => act(api, c, { tipe: c.sel.tipe === t && !c.linked ? '' : t }));
      api.tools({
        table: () => ({
          title: 'Realisasi per sumber', subtitle: `${c.where}, ${fmt.month(c.sel.bulan)}`,
          columns: ['Sumber', c.word, 'Porsi', `Periode sama ${fmt.month(c.pm, true)}`, 'Perubahan'],
          rows: items.map((i) => [i.t, c.fmtV(i.v), fmt.pct(ratio(i.v, total), 1), c.fmtV(i.p), fmt.signedPct(ratio(i.v - i.p, i.p))]),
        }),
      });
    },
  }),

  cum: () => ({
    title: 'Kumulatif harian per bulan', desc: 'Satu garis per bulan untuk membandingkan laju realisasi',
    icon: 'trend', w: 8, h: 6, minW: 4, minH: 4,
    render(api) {
      const c = R(api);
      const months = c.yearMonths;
      if (!months.length) { api.body.innerHTML = empty('Belum ada data'); return; }
      const hl = months.slice(-Math.min(REALISASI_HIGHLIGHT_MONTHS, SERIES.length)).reverse();
      const labels = Array.from({ length: 31 }, (_, i) => String(i + 1));
      const series = months.map((m) => {
        const rows = c.tb.filter((r) => r.bulan === m);
        const daily = new Array(31).fill(0);
        for (const r of rows) daily[r.hari - 1] += ok(r[c.field]) ? r[c.field] : 0;
        const end = m === c.model.months.at(-1) ? Number(c.model.maxDate.slice(8, 10)) : daysInMonth(m);
        let run = 0;
        const data = daily.map((v, i) => (i < end ? (run += v) : null));
        const k = hl.indexOf(m);
        return { key: m, label: fmt.month(m, true), data, color: k >= 0 ? SERIES[k] : CONTEXT_GRAY, width: k === 0 ? 3 : k > 0 ? 2 : 1.25, order: k >= 0 ? k : 50 };
      });
      api.sub(`${c.where}. Tiga bulan terakhir berwarna, lainnya abu-abu.`);
      api.body.innerHTML = `${legend(api)}${chartBox(api, 'c', 'Realisasi kumulatif harian per bulan')}`;
      const chart = lineChart(canvasOf(api, 'c'), {
        labels, series: [...series].reverse(), yAxis: true, tickFormat: c.axisV, format: c.fmtV, labelFormat: c.axisV, sort: true,
        title: (p) => `Tanggal ${p[0].label}, kumulatif`,
      });
      bindLegend(legendOf(api), chart, { onHover: (k) => emphasize(api.cid('c'), k) });
      api.tools({
        png: api.cid('c'),
        table: () => ({
          title: 'Realisasi kumulatif harian', subtitle: c.where,
          columns: ['Tanggal', ...months.map((m) => fmt.month(m, true))],
          rows: labels.map((l, i) => [l, ...series.map((s) => (s.data[i] === null ? '' : c.fmtV(s.data[i])))]),
        }),
      });
    },
  }),

  calendar: () => ({
    title: 'Kalender realisasi', desc: 'Realisasi per tanggal dalam bentuk kalender, warna makin pekat makin besar',
    icon: 'calendar', w: 4, h: 6, minW: 3, minH: 5,
    render(api) {
      const c = R(api);
      const m = c.sel.bulan;
      const D = daysInMonth(m);
      const daily = groupSum(c.cur, 'hari', c.field);
      const max = Math.max(...daily.values(), 0);
      const lead = weekday(`${m}-01`);
      const best = [...daily.entries()].sort((a, b) => b[1] - a[1])[0];
      api.sub(`${fmt.month(m)}. ${best ? `Tertinggi tanggal ${best[0]} (${c.fmtV(best[1])}).` : 'Belum ada realisasi.'}`);
      const cells = [];
      for (let i = 0; i < lead; i += 1) cells.push('<span class="calendar-pad" aria-hidden="true"></span>');
      for (let d = 1; d <= D; d += 1) {
        const v = daily.get(d) || 0;
        const future = c.isLatest && d > c.lastDay;
        const t = max ? v / max : 0;
        const label = `${d} ${fmt.month(m)}: ${future ? 'belum ada data' : c.fmtV(v)}`;
        cells.push(`<span class="calendar-day${future ? ' future' : ''}${v ? '' : ' zero'}" style="${v ? `--cbg:${seqColor(0.08 + t * 0.92)};--cfg:${t > 0.5 ? '#fff' : 'var(--ink)'}` : ''}" title="${esc(label)}" role="gridcell" aria-label="${esc(label)}">
          <b>${d}</b>${v && !future ? `<small>${esc(c.field === 'plafond' ? plafondText(v, 0) : fmt.num(v))}</small>` : ''}</span>`);
      }
      api.body.innerHTML = `<div class="calendar" role="grid" aria-label="Kalender realisasi ${esc(fmt.month(m))}">
        <div class="calendar-head" role="row">${DAYS_SHORT.map((d) => `<span role="columnheader">${d}</span>`).join('')}</div>
        <div class="calendar-grid" role="row">${cells.join('')}</div></div>
        <p class="calendar-legend"><span>Rendah</span><i></i><span>Tinggi</span></p>`;
      api.tools({
        table: () => ({
          title: 'Realisasi per tanggal', subtitle: fmt.month(m), columns: ['Tanggal', 'Hari', c.word],
          rows: Array.from({ length: D }, (_, i) => [String(i + 1), DAYS_SHORT[weekday(`${m}-${String(i + 1).padStart(2, '0')}`)], c.fmtV(daily.get(i + 1) || 0)]),
        }),
      });
    },
  }),

  dom: () => ({
    title: 'Pola per tanggal', desc: 'Rata-rata realisasi per tanggal dalam sebulan, dibanding bulan terpilih',
    icon: 'bars', w: 6, h: 5, minW: 4, minH: 4,
    render(api) {
      const c = R(api);
      const done = c.yearMonths.filter((m) => !(m === c.model.months.at(-1)) && m !== c.sel.bulan);
      const avg = Array.from({ length: 31 }, (_, i) => {
        const vals = done.filter((m) => i + 1 <= daysInMonth(m)).map((m) => sum(c.tb.filter((r) => r.bulan === m && r.hari === i + 1), c.field));
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      });
      const curDaily = Array.from({ length: 31 }, (_, i) => (i + 1 <= c.lastDay ? sum(c.cur.filter((r) => r.hari === i + 1), c.field) : null));
      if (!done.length) { api.body.innerHTML = empty('Butuh minimal satu bulan penuh lain di tahun ini'); return; }
      api.sub(`Batang: rata-rata ${done.length} bulan lain di ${c.sel.bulan.slice(0, 4)}. Garis: ${fmt.month(c.sel.bulan)}.`);
      api.body.innerHTML = `${legend(api)}${chartBox(api, 'c', 'Pola realisasi per tanggal')}`;
      const labels = Array.from({ length: 31 }, (_, i) => String(i + 1));
      const chart = barChart(canvasOf(api, 'c'), {
        labels, series: [{ label: 'Rata-rata bulan lain', data: avg, color: C.barPrev, lab: 'none' }],
        format: c.fmtV, labelFormat: c.axisV, tickFormat: c.axisV, title: (p) => `Tanggal ${p[0].label}`, sort: false,
      });
      chart.data.datasets.push({
        type: 'line', label: fmt.month(c.sel.bulan, true), data: curDaily, $color: C.accent, $base: C.accent, $lab: 'main', borderColor: C.accent, backgroundColor: C.accent,
        borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: 0.3, order: -1,
      });
      chart.update('none');
      bindLegend(legendOf(api), chart);
      api.tools({ png: api.cid('c') });
    },
  }),

  multiples: () => ({
    title: 'Tren bulanan per sumber', desc: 'Grafik kecil per sumber: realisasi tiap bulan tahun ini',
    icon: 'grid', w: 12, h: 6, minW: 6, minH: 4,
    render(api) {
      const c = R(api);
      const months = c.yearMonths;
      api.sub(`${[c.sel.ro || 'Nasional', c.sel.kanca, c.sel.rm].filter(Boolean).join(', ')}, ${c.word}. Bulan terpilih berwarna penuh. ${c.linked ? '' : 'Klik grafik untuk filter sumber.'}`);
      api.body.innerHTML = `<div class="multi">${c.tipes.map((t, i) => {
        const tot = sum(c.base.filter((r) => r[c.key] === t && months.includes(r.bulan)), c.field);
        return `<button type="button" class="multiple-card" data-tipe="${esc(t)}"${c.sel.tipe === t ? ' aria-pressed="true"' : ''} style="--c:${tipeColor(c.model, t)}">
          <span class="multiple-head"><i></i>${esc(t)}</span><span class="multiple-value">${esc(c.fmtV(tot))}</span>
          <span class="chart-box"><canvas id="${api.cid(`m${i}`)}" role="img" aria-label="Realisasi ${esc(t)} per bulan"></canvas></span></button>`;
      }).join('')}</div>`;
      c.tipes.forEach((t, i) => {
        const vals = months.map((m) => sum(c.base.filter((r) => r[c.key] === t && r.bulan === m), c.field));
        const color = tipeColor(c.model, t);
        barChart(canvasOf(api, `m${i}`), {
          labels: months.map((m) => fmt.monthOnly(m)), axis: false,
          series: [{ label: t, data: vals, color, colors: months.map((m) => (m === c.sel.bulan ? color : `${color}59`)) }],
          format: c.fmtV, labelFormat: c.axisV, title: (p) => fmt.month(months[p[0].dataIndex]),
        });
      });
      onPick(api, 'data-tipe', (t) => act(api, c, { tipe: c.sel.tipe === t && !c.linked ? '' : t }));
    },
  }),

  months: ({ chart = false } = {}) => ({
    title: chart ? 'Realisasi per bulan' : 'Tabel per bulan',
    desc: chart ? 'Total realisasi tiap bulan, bulan terpilih disorot' : 'Plafond, debitur, rata-rata, dan perubahan tiap bulan',
    icon: chart ? 'bars' : 'table', w: chart ? 8 : 6, h: chart ? 5 : 6, minW: 4, minH: 4,
    render(api) {
      const c = R(api);
      const months = c.yearMonths;
      const rows = months.map((m) => {
        const r = c.tb.filter((x) => x.bulan === m);
        return { m, plaf: sum(r, 'plafond'), deb: sum(r, 'debitur') };
      });
      const running = c.model.months.at(-1);
      const runDay = Number(c.model.maxDate.slice(8, 10));
      rows.forEach((r, i) => {
        r.v = c.field === 'plafond' ? r.plaf : r.deb;
        if (!i) { r.mom = null; return; }
        const p = r.m === running && runDay < daysInMonth(r.m)
          ? sum(c.tb.filter((x) => x.bulan === rows[i - 1].m && x.hari <= runDay), c.field)
          : rows[i - 1].v;
        r.mom = ratio(r.v - p, p);
      });
      if (!rows.length) { api.body.innerHTML = empty('Belum ada data'); return; }
      if (chart) {
        api.sub(`${c.where}, ${c.word}. ${c.isLatest ? 'Bulan berjalan belum penuh. ' : ''}Klik batang untuk membuka bulan.`);
        api.body.innerHTML = chartBox(api, 'c', 'Realisasi per bulan');
        barChart(canvasOf(api, 'c'), {
          labels: months.map((m) => fmt.month(m, true)),
          series: [{ label: c.word === 'plafond' ? 'Plafond' : 'Debitur', data: rows.map((r) => r.v), color: C.accent,
            colors: months.map((m) => (m === c.sel.bulan ? C.accent : C.barPrev)), hover: months.map(() => C.mid) }],
          format: c.fmtV, labelFormat: c.axisV, tickFormat: c.axisV, title: (p) => fmt.month(months[p[0].dataIndex]),
          hint: c.linked ? 'Klik untuk membuka Realisasi bulan ini' : 'Klik untuk membuka bulan ini',
          onClick: (i) => act(api, c, { bulan: months[i] }),
        });
        api.tools({ png: api.cid('c'), table: () => tableOf(c, rows) });
        return;
      }
      const max = Math.max(...rows.map((r) => r.v), 1);
      api.sub(`${c.where}. Makin pekat makin besar. Klik baris untuk membuka bulan.`);
      api.body.innerHTML = `<div class="table-wrap scroll" tabindex="0" role="region" aria-label="Realisasi per bulan"><table class="data-table">
        <thead><tr><th scope="col">Bulan</th><th scope="col">Plafond</th><th scope="col">Debitur</th><th scope="col">Rata-rata</th><th scope="col">vs bulan lalu</th></tr></thead>
        <tbody>${[...rows].reverse().map((r) => `<tr data-bulan="${r.m}" tabindex="0"${r.m === c.sel.bulan ? ' aria-selected="true"' : ''}>
          <th scope="row">${fmt.month(r.m)}${r.m === c.model.months.at(-1) && c.isLatest ? ' <span class="tag">berjalan</span>' : ''}</th>
          <td style="--heat:${(r.v / max).toFixed(3)}" class="heatcell">${plafondText(r.plaf)}</td>
          <td>${fmt.num(r.deb)}</td><td>${plafondText(ratio(r.plaf, r.deb))}</td><td>${delta(r.mom)}</td></tr>`).join('')}</tbody></table></div>`;
      onPick(api, 'data-bulan', (m) => act(api, c, { bulan: m }));
      api.tools({ table: () => tableOf(c, rows) });
    },
  }),

  rank: (dim) => {
    const label = dim === 'rm' ? 'RM' : 'kantor cabang';
    const state = { q: '', all: false };
    return {
      title: dim === 'rm' ? 'Peringkat RM' : 'Peringkat kantor cabang',
      desc: `${dim === 'rm' ? 'RM' : 'Kantor cabang'} dengan realisasi terbesar di bulan terpilih`,
      icon: dim === 'rm' ? 'users' : 'bank', w: 6, h: 7, minW: 3, minH: 4,
      render(api) {
        const c = R(api);
        const rows = c.model.rows.filter((r) => r.bulan === c.sel.bulan && (!c.sel.ro || r.ro === c.sel.ro)
          && (!c.sel.tipe || r[c.key] === c.sel.tipe) && (dim === 'rm' ? (!c.sel.kanca || r.kanca === c.sel.kanca) : true));
        const g = groupSum(rows.filter((r) => r[dim]), dim, c.field);
        const debs = groupSum(rows.filter((r) => r[dim]), dim, 'debitur');
        const home = new Map(rows.map((r) => [r[dim], dim === 'rm' ? r.kanca : r.ro]));
        const all = [...g.entries()].sort((a, b) => b[1] - a[1]).map(([k, v], i) => ({ k, v, rank: i + 1 }));
        const total = all.reduce((t, x) => t + x.v, 0);
        api.sub(`${fmt.month(c.sel.bulan)}, ${all.length} ${label}. ${c.linked ? '' : `Klik untuk filter ${label}.`}`);
        api.body.innerHTML = `<label class="search">${icon('search', 16)}<input type="search" placeholder="Cari ${label}" aria-label="Cari ${label}" value="${esc(state.q)}"></label>
          <div class="scroll" data-list></div><button type="button" class="link" data-more></button>`;
        const listEl = api.body.querySelector('[data-list]');
        const more = api.body.querySelector('[data-more]');
        const draw = () => {
          const term = state.q.trim().toLowerCase();
          const shown = all.filter((x) => !term || String(x.k).toLowerCase().includes(term));
          const cut = state.all || term ? shown : shown.slice(0, 10);
          listEl.innerHTML = rankList(cut.map((x) => ({
            key: x.k, label: x.k, value: x.v, active: c.sel[dim] === x.k,
            sub: `${esc(dim === 'rm' ? home.get(x.k) || '' : shortRo(home.get(x.k) || ''))}, ${fmt.num(debs.get(x.k))} debitur, ${fmt.pct(ratio(x.v, total), 1)}`,
          })), { format: c.fmtV, max: all[0]?.v, empty: term ? 'Tidak ditemukan' : 'Belum ada realisasi' });
          listEl.querySelectorAll('.rank-number').forEach((n, i) => { n.textContent = String(cut[i].rank); });
          more.hidden = !!term || shown.length <= 10;
          more.textContent = state.all ? 'Tampilkan 10 teratas' : `Tampilkan semua (${shown.length})`;
        };
        draw();
        api.body.querySelector('input').addEventListener('input', (e) => { state.q = e.target.value; draw(); });
        more.addEventListener('click', () => { state.all = !state.all; draw(); });
        onPick(api, 'data-pick', (k) => act(api, c, dim === 'rm' ? { rm: c.sel.rm === k ? '' : k } : { kanca: c.sel.kanca === k ? '' : k, rm: '' }));
        api.tools({
          table: () => ({
            title: `Peringkat ${label}`, subtitle: fmt.month(c.sel.bulan),
            columns: ['Peringkat', dim === 'rm' ? 'RM' : 'Kantor cabang', c.word, 'Debitur', 'Porsi'],
            rows: all.map((x) => [String(x.rank), x.k, c.fmtV(x.v), fmt.num(debs.get(x.k)), fmt.pct(ratio(x.v, total), 1)]),
          }),
        });
      },
    };
  },

  map: () => {
    const state = { metric: 'month', prov: '' };
    return {
      title: 'Peta Indonesia per provinsi', desc: 'Peta panas realisasi per provinsi dari data kantor cabang',
      icon: 'map', w: 12, h: 9, minW: 6, minH: 6, fit: true,
      render(api) {
        const c = R(api);
        const metrics = [
          { id: 'month', label: fmt.month(c.sel.bulan), calc: (t) => t.m, format: c.fmtV, note: `Realisasi ${c.word} bulan terpilih` },
          { id: 'ytd', label: `Jan s.d. ${fmt.month(c.sel.bulan, true)}`, calc: (t) => t.y, format: c.fmtV, note: `Realisasi ${c.word} tahun berjalan` },
          ...(c.field === 'plafond' ? [{ id: 'avg', label: 'Rata-rata per debitur', calc: (t) => ratio(t.p, t.d), format: (v) => plafondText(v), note: 'Plafond ÷ debitur, bulan terpilih' }] : []),
        ];
        if (!metrics.some((m) => m.id === state.metric)) state.metric = 'month';
        api.sub(`${[c.sel.ro || 'Nasional', c.sel.tipe].filter(Boolean).join(', ')}. Klik provinsi untuk detail per region atau pulau beserta kantor cabangnya.`);
        renderBranchMap(api, {
          state, metrics, scope: 'realisasi', selKanca: c.sel.kanca,
          collect: () => {
            const g = new Map();
            for (const r of c.model.rows) {
              if (!r.kanca || (c.sel.ro && r.ro !== c.sel.ro) || (c.sel.tipe && r[c.key] !== c.sel.tipe)) continue;
              const inYear = c.yearMonths.includes(r.bulan);
              const inMonth = r.bulan === c.sel.bulan;
              if (!inYear && !inMonth) continue;
              const o = g.get(r.kanca) || { ro: r.ro, sums: { m: 0, y: 0, p: 0, d: 0 } };
              const v = ok(r[c.field]) ? r[c.field] : 0;
              if (inYear) o.sums.y += v;
              if (inMonth) { o.sums.m += v; o.sums.p += ok(r.plafond) ? r.plafond : 0; o.sums.d += ok(r.debitur) ? r.debitur : 0; }
              g.set(r.kanca, o);
            }
            return g;
          },
          onKanca: (k) => act(api, c, { kanca: c.sel.kanca === k ? '' : k, rm: '' }),
        });
      },
    };
  },

  ro: () => ({
    title: 'Realisasi per RO', desc: 'Realisasi bulan terpilih per Regional Office, ditumpuk per tipe KPR',
    icon: 'bars-horizontal', w: 6, h: 6, minW: 4, minH: 4,
    render(api) {
      const c = R(api);
      const rows = c.model.rows.filter((r) => r.bulan === c.sel.bulan);
      const ros = c.model.ros;
      const totals = ros.map((ro) => sum(rows.filter((r) => r.ro === ro), c.field));
      const order = ros.map((ro, i) => ({ ro, t: totals[i] })).sort((a, b) => b.t - a.t).map((x) => x.ro);
      if (!rows.length) { api.body.innerHTML = empty('Belum ada realisasi di bulan ini'); return; }
      api.sub(`${fmt.month(c.sel.bulan)}, ${c.word}. ${c.linked ? '' : 'Klik batang untuk filter RO.'}`);
      api.body.innerHTML = `${legend(api)}${chartBox(api, 'c', 'Realisasi per RO per sumber')}`;
      const chart = barChart(canvasOf(api, 'c'), {
        labels: order.map(shortRo), horizontal: true, stacked: true,
        series: [...c.tipes.map((t) => {
          const color = tipeColor(c.model, t);
          return {
            label: t, color,
            colors: order.map((ro) => (c.sel.ro && c.sel.ro !== ro ? `${color}40` : color)),
            data: order.map((ro) => sum(rows.filter((r) => r.ro === ro && r[c.key] === t), c.field)),
          };
        }), ...(rows.some((r) => !r[c.key] && r[c.field] > 0) ? [{
          label: 'Belum masuk sumber', color: CONTEXT_GRAY,
          data: order.map((ro) => sum(rows.filter((r) => r.ro === ro && !r[c.key]), c.field)),
        }] : [])],
        format: c.fmtV, title: (p) => order[p[0].dataIndex],
        footer: { label: 'Total', value: (pts) => c.fmtV(pts.reduce((t, p) => t + (p.parsed.x || 0), 0)) },
        onClick: (i) => act(api, c, { ro: c.sel.ro === order[i] ? '' : order[i], kanca: '', rm: '' }),
      });
      bindLegend(legendOf(api), chart, { shape: 'box' });
      api.tools({ png: api.cid('c') });
    },
  }),

  donut: (dim) => ({
    title: dim === 'tujuan' ? 'Tujuan kredit' : 'Dev Local Champion',
    desc: dim === 'tujuan' ? 'Komposisi realisasi per tujuan kredit' : 'Porsi realisasi dari developer local champion',
    icon: 'donut', w: 3, h: 6, minW: 3, minH: 4,
    render(api) {
      const c = R(api);
      const g = groupSum(c.cur, dim, c.field);
      const keys = [...g.keys()].sort(byText);
      const items = keys.map((k, i) => ({
        label: k || 'Tidak diisi', value: g.get(k),
        color: dim === 'dev_local_champion' ? (/^y/i.test(k) ? C.accent : C.lancar) : SERIES[i % SERIES.length],
      })).sort((a, b) => b.value - a.value);
      const total = items.reduce((t, x) => t + x.value, 0);
      api.sub(`${fmt.month(c.sel.bulan)}, ${c.word}`);
      api.body.innerHTML = donutHtml(api, 'd', `Komposisi ${dim === 'tujuan' ? 'tujuan kredit' : 'dev local champion'}`);
      const lead = dim === 'dev_local_champion' ? items.find((x) => /^y/i.test(x.label)) || items[0] : items[0];
      mountDonut(api, 'd', items, { center: fmt.pct(ratio(lead?.value, total), 1), centerSub: lead?.label || '', format: c.fmtV });
    },
  }),
};

function tableOf(c, rows) {
  return {
    title: 'Realisasi per bulan', subtitle: c.where,
    columns: ['Bulan', 'Plafond', 'Debitur', 'Rata-rata per debitur', 'vs bulan lalu'],
    rows: rows.map((r) => [fmt.month(r.m), plafondText(r.plaf), fmt.num(r.deb), plafondText(ratio(r.plaf, r.deb)), fmt.signedPct(r.mom)]),
  };
}

export default {
  id: 'realisasi', title: 'Realisasi', icon: 'trend',
  load: loadReal,
  normalize(p, m) {
    return {
      bulan: m.months.includes(p.bulan) ? p.bulan : m.months.at(-1),
      ro: m.ros.includes(p.ro) ? p.ro : '',
      kanca: p.kanca || '', rm: p.rm || '',
      tipe: tipeFor(p.sumber, p.tipe, m),
      sumber: sumberMode(p.sumber, m),
      ukuran: p.ukuran === 'debitur' ? 'debitur' : 'plafond',
    };
  },
  context(m, sel) {
    const inRo = m.rows.filter((r) => !sel.ro || r.ro === sel.ro);
    const kancas = uniq(inRo.map((r) => r.kanca)).filter(Boolean).sort(byText);
    if (sel.kanca && !kancas.includes(sel.kanca)) sel.kanca = '';
    const rms = uniq(inRo.filter((r) => !sel.kanca || r.kanca === sel.kanca).map((r) => r.rm)).filter(Boolean).sort(byText);
    if (sel.rm && !rms.includes(sel.rm)) sel.rm = '';
    return { ...realContext(m, sel), kancas, rms, view: 'realisasi' };
  },
  subtitle(c) {
    return `${c.where}, ${fmt.month(c.sel.bulan)}${c.isLatest ? `, data s.d. ${fmt.date(c.model.maxDate)}` : ''}`;
  },
  filters(c) {
    const { model: m, sel } = c;
    const dirty = sel.ro || sel.kanca || sel.rm || sel.tipe || sel.ukuran !== 'plafond' || sel.sumber !== sumberMode('', m) || sel.bulan !== m.months.at(-1);
    return `${pick({ id: 'f-ro', label: 'Regional Office', value: sel.ro, on: !!sel.ro, options: [{ value: '', label: 'Nasional' }, ...m.ros.map((r) => ({ value: r, label: r }))] })}
      ${searchPick({ id: 'f-kanca', label: 'Kantor cabang', value: sel.kanca, allLabel: 'Semua' })}
      ${searchPick({ id: 'f-rm', label: 'Nama RM', value: sel.rm, allLabel: 'Semua' })}
      ${pick({ id: 'f-bulan', label: 'Bulan', value: sel.bulan, on: sel.bulan !== m.months.at(-1), options: [...m.months].reverse().map((x) => ({ value: x, label: fmt.month(x) })) })}
      ${seg({ name: 'f-sumber', label: 'Rincian sumber', value: sel.sumber, small: true, options: modeOptions(m) })}
      ${pick({ id: 'f-tipe', label: 'Sumber', value: sel.tipe, on: !!sel.tipe, options: [{ value: '', label: 'Semua' }, ...c.tipes.map((t) => ({ value: t, label: t }))] })}
      ${seg({ name: 'f-ukuran', label: 'Ukuran', value: sel.ukuran, small: true, options: [{ value: 'plafond', label: 'Plafond' }, { value: 'debitur', label: 'Debitur' }] })}
      ${dirty ? '<button class="reset" type="button" data-reset>Reset filter</button>' : ''}`;
  },
  bindFilters(root, c, set) {
    root.querySelector('#f-ro').addEventListener('change', (e) => set({ ro: e.target.value, kanca: '', rm: '' }));
    root.querySelector('#f-bulan').addEventListener('change', (e) => set({ bulan: e.target.value }));
    root.querySelector('#f-tipe').addEventListener('change', (e) => set({ tipe: e.target.value }));
    bindSearchPick({ id: 'f-kanca', options: c.kancas, value: c.sel.kanca, allLabel: 'Semua', onChange: (v) => set({ kanca: v, rm: '' }) });
    bindSearchPick({ id: 'f-rm', options: c.rms, value: c.sel.rm, allLabel: 'Semua', onChange: (v) => set({ rm: v }) });
    onSeg(root, 'f-ukuran', (v) => set({ ukuran: v === 'plafond' ? '' : v }));
    onSeg(root, 'f-sumber', (v) => set({ sumber: v === sumberMode('', c.model) ? '' : v, tipe: tipeFor(v, c.sel.tipe, c.model) }));
    root.querySelector('[data-reset]')?.addEventListener('click', () => set({ ro: '', kanca: '', rm: '', tipe: '', ukuran: '', sumber: '', bulan: '' }));
  },
  widgets: {
    summary: realWidgets.summary(),
    'cum-grid': realWidgets.cumGrid(),
    analysis: analysisWidget((c) => ({ data: { real: c.model }, scope: { ro: c.sel.ro, kanca: c.sel.kanca, rm: c.sel.rm, tipe: c.sel.tipe, sumber: c.mode, bulan: c.sel.bulan }, sources: ['realisasi'] })),
    hero: realWidgets.hero(),
    tipe: realWidgets.tipe(),
    cum: realWidgets.cum(),
    calendar: realWidgets.calendar(),
    multiples: realWidgets.multiples(),
    months: realWidgets.months(),
    'months-chart': realWidgets.months({ chart: true }),
    rm: realWidgets.rank('rm'),
    kanca: realWidgets.rank('kanca'),
    ro: realWidgets.ro(),
    tujuan: realWidgets.donut('tujuan'),
    dlc: realWidgets.donut('dev_local_champion'),
    dom: realWidgets.dom(),
    map: realWidgets.map(),
  },
  layout: [
    { id: 'summary', x: 0, y: 0, w: 12, h: 9 },
    { id: 'cum-grid', x: 0, y: 9, w: 12, h: 14 },
    { id: 'calendar', x: 0, y: 23, w: 4, h: 7 },
    { id: 'rm', x: 4, y: 23, w: 4, h: 7 },
    { id: 'kanca', x: 8, y: 23, w: 4, h: 7 },
    { id: 'map', x: 0, y: 30, w: 12, h: 9 },
    { id: 'ro', x: 0, y: 39, w: 6, h: 6 },
    { id: 'tujuan', x: 6, y: 39, w: 3, h: 6 },
    { id: 'dlc', x: 9, y: 39, w: 3, h: 6 },
    { id: 'analysis', x: 0, y: 45, w: 12, h: 8 },
  ],
};
