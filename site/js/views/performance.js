import { fmt, esc, shortRo } from '../core/format.js';
import { ratio, ok } from '../core/values.js';
import { prevMonth, daysInMonth } from '../core/dates.js';
import { achLevel, achPill, tbar, LEVEL_WORD } from '../core/achievement.js';
import { pick } from '../core/controls.js';
import { signalsHtml, sortableTable } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { PERF_CARDS, PERF_TREND_CHARTS, PERF_QUALITY_CHARTS } from '../config.js';
import { lineChart, barChart, bandCombo, bindLegend, bubbleChart, C, SERIES, CONTEXT_GRAY } from '../charts/charts.js';
import { loadPerf } from '../services/datasets.js';
import { perfContext, cardValues, kpiCard, featureBody, trendSeries, badgeValue, kuadranAt, roSummary, osGrowth, pctValue, workdayIndex, signalItems, dayOf, NASIONAL } from '../models/performance-model.js';
import { chartBox, canvasOf, legend, legendOf, stats, onPick, empty } from '../widgets/widget-kit.js';
import { renderMapPanel, nameList } from '../map/map-panel.js';
import { provinceName } from '../map/indonesia-map.js';
import { METRO_AREAS, METRO_NAME, metroArea } from '../map/metro-areas.js';
import { kancaLabel } from '../map/branch-locations.js';
import { openMapPopout } from '../map/map-popout.js';
import { perfKancaSource } from '../map/kanca-source.js';
import { analysisWidget } from '../widgets/insights-panel.js';
import { outlookWidget } from '../widgets/outlook-panel.js';

const CARD = Object.fromEntries(PERF_CARDS.map((c) => [c.id, c]));
const roColor = (pm, ro) => SERIES[Math.max(0, pm.regions.indexOf(ro)) % SERIES.length];
const sinceText = (s) => `s.d. ${fmt.dateShort(s.end.tanggal)}`;

const FOCUS_OF = { os: 'trend-os', deb: 'rank', sml: 'sml', npl: 'npl', disb: 'pace', disbrm: 'prod-rm' };

function stripCard(card, s, lead = false) {
  const c = cardValues(card, s.end);
  const d = card.decimals ?? 0;
  const disb = card.type === 'disburse';
  const r = disb ? c.achProg : c.ach;
  const cap = disb ? 'vs prognosa' : 'vs RKA';
  const tip = `Capaian ${card.label} ${cap}: ${fmt.pct(r, 1)} (${LEVEL_WORD[achLevel(r)]})${card.inverse ? '. Makin kecil nilainya makin baik' : ''}`;
  const gapCls = (c.gap ?? 0) < 0 ? 'bad-t' : 'good-t';
  const kv = (k, v, cls = '') => `<span><small>${k}</small><b${cls ? ` class="${cls}"` : ''}>${v}</b></span>`;
  const meta = disb
    ? kv('Guidance', fmt.num(c.guidance, d)) + kv('Prognosa', fmt.num(c.prognosa, d)) + kv('vs RKA', fmt.pct(c.achRka, 1), `${achLevel(c.achRka)}-t`)
    : card.type === 'ratio'
      ? kv('RKA', fmt.num(c.target, d)) + kv(esc(card.ratioLabel), fmt.pct(c.share)) + kv('GAP', fmt.signed(c.gap, d))
      : kv('RKA', fmt.num(c.target, d)) + kv('GAP', fmt.signed(c.gap, d), gapCls);
  return `<button type="button" class="tile kpi-tile${lead ? ' lead' : ''}" data-card="${card.id}">
    <span class="tile-body">
      <span class="tile-h"><span class="tile-l">${esc(card.title)}</span>${icon(card.icon || 'pulse', 15)}</span>
      <span class="tile-main"><span class="tile-v">${fmt.num(c.value, d)}${card.unit ? `<small>${esc(card.unit)}</small>` : ''}</span>
        <span class="tile-ach" title="${esc(tip)}"><span class="pill ${achLevel(r)}">${fmt.pct(r, 1)}</span><small>${cap}</small></span></span>
      <span class="tile-kv">${meta}</span></span></button>`;
}

export const perfWidgets = {
  strip: () => ({
    title: 'KPI utama', desc: 'Enam KPI berjajar seperti kartu Looker: nilai, capaian, target, dan GAP',
    icon: 'target', w: 12, h: 3, minW: 6, minH: 3, fit: true, variant: 'strip',
    render(api) {
      const { slice: s } = api.ctx;
      if (!s) { api.body.innerHTML = empty('Belum ada data Performance di bulan ini'); return; }
      api.body.innerHTML = `<div class="kpi-strip tiles">${PERF_CARDS.map((c, i) => stripCard(c, s, i === 0)).join('')}</div>`;
      onPick(api, 'data-card', (id) => {
        if (api.ctx.view === 'performance') api.focus(FOCUS_OF[id]);
        else api.go('performance', { bulan: api.ctx.bulan });
      });
    },
  }),

  hero: () => ({
    title: 'Capaian Outstanding', desc: 'Gauge capaian OS terhadap RKA, dengan pertumbuhan sejak akhir bulan lalu',
    icon: 'wallet', w: 4, h: 6, minW: 3, minH: 5, variant: 'feature',
    render(api) {
      const { slice: s, roLabel } = api.ctx;
      if (!s) { api.body.innerHTML = empty('Belum ada data Performance di bulan ini'); return; }
      api.sub(`${roLabel}, ${sinceText(s)}`);
      const g = osGrowth(s);
      api.body.innerHTML = `<div class="feature">${featureBody(CARD.os, s,
        `<span>Sejak akhir bulan lalu <b>${fmt.signed(g.abs, 0)}</b></span>`)}</div>`;
    },
  }),

  kpis: ({ compact = false } = {}) => ({
    title: 'KPI utama', desc: 'Enam KPI dengan capaian terhadap RKA atau prognosa',
    icon: 'target', w: 8, h: 6, minW: 4, minH: 4, fit: true,
    render(api) {
      const { slice: s, roLabel } = api.ctx;
      if (!s) { api.body.innerHTML = empty('Belum ada data Performance di bulan ini'); return; }
      api.sub(`${roLabel}, ${sinceText(s)}. Hijau ≥100%, kuning ≥90%, merah <90%.`);
      api.body.innerHTML = `<div class="kpis${compact ? ' compact' : ''}">${PERF_CARDS.map((c) => kpiCard(c, s)).join('')}</div>`;
      onPick(api, 'data-card', (id) => {
        const target = { os: 'trend-os', deb: 'rank', sml: 'sml', npl: 'npl', disb: 'pace', disbrm: 'prod-rm' }[id];
        if (api.ctx.view === 'performance') api.focus(target);
        else api.go('performance', {});
      });
    },
  }),

  trend: (cfgId) => {
    const cfg = PERF_TREND_CHARTS.find((c) => c.id === cfgId);
    const meta = {
      'growth-os': { title: 'Growth OS harian (Rp M)', icon: 'trend' },
      disburse: { title: 'Disburse kumulatif (Rp M)', icon: 'send' },
      'prod-rm': { title: 'Produktivitas RM (Rp M per RM)', icon: 'user-check' },
    }[cfgId];
    return {
      title: meta.title, desc: `${cfg.long}, bulan ini dibanding bulan lalu`, icon: meta.icon, w: 6, h: 5, minW: 4, minH: 4,
      render(api) {
        const { slice: s, bulan } = api.ctx;
        if (!s) { api.body.innerHTML = empty('Belum ada data di bulan ini'); return; }
        const ser = trendSeries(cfg, s);
        api.sub(`${cfg.long}. Klik tanggal untuk detail.`);
        api.body.innerHTML = `${stats(cfg.badges.map((b) => ({ label: b.label, value: fmt.num(badgeValue(b, s, ser, cfg), b.decimals), series: /lalu/i.test(b.label) ? 'previous' : 'current' })))}
          ${legend(api)}${chartBox(api, 'c', `${meta.title} bulan ini dan bulan lalu`)}`;
        const chart = lineChart(canvasOf(api, 'c'), {
          labels: ser.labels,
          series: [
            { label: fmt.month(bulan), data: ser.cur, color: C.accent, fill: true },
            { label: fmt.month(prevMonth(bulan)), data: ser.prev, color: C.prev, width: 2 },
          ],
          yAxis: true, pulse: true, format: (v) => fmt.num(v, cfg.decimals), tickFormat: (v) => fmt.num(v, cfg.decimals),
          title: (p) => `Tanggal ${p[0].label}`, hint: 'Klik untuk melihat KPI per tanggal ini',
          beginAtZero: cfgId === 'growth-os' ? false : null,
          onClick: (i) => {
            if (!(i + 1 <= s.endDay && s.byDay.has(i + 1))) return;
            if (api.ctx.view === 'performance') api.set({ sd: String(i + 1) });
            else api.go('performance', { bulan, sd: String(i + 1) });
          },
        });
        bindLegend(legendOf(api), chart);
        api.tools({
          png: api.cid('c'),
          table: () => ({
            title: meta.title, subtitle: cfg.long,
            columns: ['Tanggal', fmt.month(bulan), fmt.month(prevMonth(bulan))],
            rows: ser.labels.map((l, i) => [l, fmt.num(ser.cur[i], cfg.decimals), fmt.num(ser.prev[i], cfg.decimals)]),
          }),
        });
      },
    };
  },

  pace: () => ({
    title: 'Laju disburse (Rp M)', desc: 'Disburse kumulatif dibanding jalur menuju guidance bulan ini',
    icon: 'send', w: 6, h: 5, minW: 4, minH: 4,
    render(api) {
      const { slice: s, bulan } = api.ctx;
      if (!s) { api.body.innerHTML = empty('Belum ada data di bulan ini'); return; }
      const D = daysInMonth(bulan);
      const hk = workdayIndex(s);
      const total = Math.max(1, hk[D - 1]);
      const guidance = s.end.guidance_disb;
      const prognosa = s.end.prognosa_disb;
      const actual = []; const ideal = [];
      for (let d = 1; d <= D; d += 1) {
        const r = d <= s.endDay ? s.byDay.get(d) : null;
        actual.push(r && ok(r.disburse) ? r.disburse : null);
        ideal.push(ok(guidance) ? (guidance * hk[d - 1]) / total : null);
      }
      const now = s.end.disburse;
      const elapsed = hk[s.endDay - 1];
      const left = Math.max(0, total - elapsed);
      const need = left && ok(guidance) && ok(now) ? Math.max(0, guidance - now) / left : null;
      const gapToPath = ok(now) && ok(ideal[s.endDay - 1]) ? now - ideal[s.endDay - 1] : null;
      api.sub(`Rp M. Jalur target = guidance ÷ ${total} hari kerja (sisa bulan dihitung Senin–Jumat).`);
      api.body.innerHTML = `${stats([
        { label: 'Capaian vs guidance', html: achPill(ratio(now, guidance)) },
        { label: 'Selisih dari jalur', value: fmt.signed(gapToPath, 0), tone: (gapToPath ?? 0) < 0 ? 'bad-t' : 'good-t' },
        { label: left ? `Perlu per hari kerja (${left} hari)` : 'Sisa hari kerja', value: left ? fmt.num(need, 1) : 'Bulan selesai' },
      ])}${legend(api)}${chartBox(api, 'c', 'Disburse kumulatif dan jalur target')}`;
      const chart = lineChart(canvasOf(api, 'c'), {
        labels: Array.from({ length: D }, (_, i) => String(i + 1)),
        series: [
          { label: 'Disburse kumulatif', data: actual, color: C.accent, fill: true },
          { label: 'Jalur guidance', data: ideal, color: '#86868B', dash: true, width: 1.75 },
        ],
        refs: ok(prognosa) ? [{ axis: 'y', value: prognosa, label: `Prognosa ${fmt.num(prognosa, 0)}` }] : [],
        yAxis: true, pulse: true, format: (v) => fmt.num(v, 1), labelFormat: (v) => fmt.num(v, 0), title: (p) => `Tanggal ${p[0].label}`,
      });
      bindLegend(legendOf(api), chart);
      api.tools({
        png: api.cid('c'),
        table: () => ({
          title: 'Laju disburse', subtitle: `Guidance ${fmt.num(guidance, 1)}, prognosa ${fmt.num(prognosa, 1)}`,
          columns: ['Tanggal', 'Hari kerja ke', 'Disburse kumulatif', 'Jalur guidance'],
          rows: actual.map((v, i) => [String(i + 1), String(hk[i]), fmt.num(v, 1), fmt.num(ideal[i], 1)]),
        }),
      });
    },
  }),

  quality: (qid) => {
    const q = PERF_QUALITY_CHARTS.find((c) => c.id === qid);
    const card = CARD[qid];
    return {
      title: `${q.title} harian (Rp M)`, desc: `Nominal ${q.title} per tanggal dan persentasenya terhadap OS`,
      icon: qid === 'npl' ? 'shield' : 'flag', w: 4, h: 6, minW: 3, minH: 5,
      render(api) {
        const { slice: s } = api.ctx;
        if (!s) { api.body.innerHTML = empty('Belum ada data di bulan ini'); return; }
        const days = [...s.byDay.keys()].sort((a, b) => a - b);
        const labels = days.map(String);
        const bars = days.map((d) => s.byDay.get(d)[q.bar] ?? null);
        const pcts = days.map((d) => pctValue(s.byDay.get(d)[q.line]));
        const c = cardValues(card, s.end);
        const barBlue = '#307FE2';
        api.sub(`Batang: Rp M. Garis: %${q.title}/OS, makin kecil makin baik.`);
        api.body.innerHTML = `${stats([
          { label: `${q.title} ${sinceText(s)}`, value: fmt.num(c.value, 0) },
          { label: `%${q.title}/OS`, value: fmt.pct(c.share) },
          { label: 'Capaian vs RKA', html: achPill(c.ach) },
        ])}${chartBox(api, 'b', `${q.title} per tanggal: nominal (batang) dan persentase terhadap OS (garis)`)}`;
        bandCombo(canvasOf(api, 'b'), {
          labels, bars, pct: pcts, color: barBlue, lineColor: '#06357A', barColors: days.map((d) => (d === s.endDay ? C.accent : `${barBlue}A6`)),
          barLabel: `${q.title} (Rp M)`, pctLabel: `%${q.title}/OS`,
          format: (v) => fmt.num(v, 1), labelFormat: (v) => fmt.num(v, 0), title: (p) => `Tanggal ${p[0].label}`,
          refs: ok(c.target) ? [{ axis: 'y', value: c.target, label: `RKA ${fmt.num(c.target, 0)}` }] : [],
        });
        api.tools({
          png: api.cid('b'),
          table: () => ({
            title: `${q.title} harian`, columns: ['Tanggal', q.title, `%${q.title}/OS`],
            rows: days.map((d, i) => [String(d), fmt.num(bars[i], 1), fmt.pct(pcts[i])]),
          }),
        });
      },
    };
  },

  kuadran: () => ({
    title: 'Kuadran RM (jumlah RM)', desc: 'Jumlah RM per kuadran, bulan ini dibanding bulan lalu',
    icon: 'team', w: 3, h: 6, minW: 3, minH: 4,
    render(api) {
      const { slice: s, roKey, pm } = api.ctx;
      const hit = s ? kuadranAt(pm, roKey, s.end.tanggal) : null;
      const rows = hit?.rows || [];
      if (!rows.length) { api.body.innerHTML = empty('Data kuadran RM belum ada untuk bulan ini'); return; }
      const sorted = [...rows].sort((a, b) => String(a.kuadran).localeCompare(String(b.kuadran)));
      const total = sorted.reduce((t, r) => t + (r.jumlah_rm || 0), 0);
      api.sub(`${api.ctx.roLabel}, data kuadran ${fmt.date(hit.date)}. Total ${fmt.num(total)} RM.`);
      api.body.innerHTML = `${legend(api)}${chartBox(api, 'c', 'Jumlah RM per kuadran')}`;
      const chart = barChart(canvasOf(api, 'c'), {
        labels: sorted.map((r) => r.kuadran), horizontal: true, valueLabels: true, labelFormat: (v) => fmt.num(v),
        series: [
          { label: 'Bulan ini', data: sorted.map((r) => r.jumlah_rm ?? null), color: C.accent },
          { label: 'Bulan lalu', data: sorted.map((r) => r.jumlah_rm_lalu ?? null), color: C.prev },
        ],
        format: (v) => `${fmt.num(v)} RM`, sort: false,
      });
      bindLegend(legendOf(api), chart, { shape: 'box' });
      api.tools({
        png: api.cid('c'),
        table: () => ({
          title: 'Kuadran RM', columns: ['Kuadran', 'Bulan ini', 'Bulan lalu', 'Porsi'],
          rows: sorted.map((r) => [r.kuadran, fmt.num(r.jumlah_rm), fmt.num(r.jumlah_rm_lalu), fmt.pct(ratio(r.jumlah_rm, total), 1)]),
        }),
      });
    },
  }),

  risk: () => ({
    title: 'Peta risiko RO', desc: 'Capaian OS (sumbu datar) terhadap %NPL (sumbu tegak), ukuran = OS',
    icon: 'scatter', w: 6, h: 6, minW: 4, minH: 5,
    render(api) {
      const { pm, bulan, slice: s, sel } = api.ctx;
      const sum = roSummary(pm, bulan, s?.endDay);
      if (!sum.length) { api.body.innerHTML = empty('Belum ada data per RO'); return; }
      const maxOs = Math.max(...sum.map((r) => r.end.os || 0), 1);
      api.sub('Kanan bawah = baik: capaian tinggi, NPL rendah. Klik titik untuk filter RO.');
      api.body.innerHTML = chartBox(api, 'c', 'Capaian OS terhadap persentase NPL per RO');
      bubbleChart(canvasOf(api, 'c'), {
        points: sum.map((r) => ({
          label: shortRo(r.ro), ro: r.ro, x: r.os.ach, y: r.npl.share, r: 6 + Math.sqrt((r.end.os || 0) / maxOs) * 18,
          color: !sel.ro || sel.ro === r.ro ? roColor(pm, r.ro) : CONTEXT_GRAY,
          rows: [['Capaian OS', fmt.pct(r.os.ach, 1)], ['%NPL/OS', fmt.pct(r.npl.share)], ['OS (Rp M)', fmt.num(r.end.os, 0)]],
        })),
        xFormat: (v) => fmt.pct(v, 1), yFormat: (v) => fmt.pct(v, 1), xTitle: 'Capaian OS vs RKA', yTitle: '%NPL/OS', refX: 1,
        onClick: (label) => { const ro = sum.find((r) => shortRo(r.ro) === label)?.ro; if (ro) api.set({ ro: sel.ro === ro ? '' : ro }); },
      });
      api.tools({
        png: api.cid('c'),
        table: () => ({
          title: 'Peta risiko RO', columns: ['RO', 'Capaian OS', '%NPL/OS', 'OS (Rp M)'],
          rows: sum.map((r) => [r.ro, fmt.pct(r.os.ach, 1), fmt.pct(r.npl.share), fmt.num(r.end.os, 0)]),
        }),
      });
    },
  }),

  contrib: () => ({
    title: 'Kontribusi pertumbuhan OS (Rp M)', desc: 'Pertumbuhan OS per RO sejak akhir bulan lalu',
    icon: 'bars-horizontal', w: 6, h: 5, minW: 4, minH: 4,
    render(api) {
      const { pm, bulan, slice: s, sel } = api.ctx;
      const sum = roSummary(pm, bulan, s?.endDay).map((r) => ({ ro: r.ro, g: osGrowth(r.slice) }))
        .filter((r) => ok(r.g.abs)).sort((a, b) => b.g.abs - a.g.abs);
      if (!sum.length) { api.body.innerHTML = empty('Belum ada data pertumbuhan'); return; }
      const total = sum.reduce((t, r) => t + r.g.abs, 0);
      api.sub(`Rp M, ${sinceText(s)}. Total ${fmt.signed(total, 0)}. Klik batang untuk filter RO.`);
      api.body.innerHTML = chartBox(api, 'c', 'Pertumbuhan OS per RO');
      barChart(canvasOf(api, 'c'), {
        labels: sum.map((r) => shortRo(r.ro)), horizontal: true, valueLabels: true, labelFormat: (v) => fmt.signed(v, 0),
        series: [{ label: 'Pertumbuhan OS', data: sum.map((r) => r.g.abs), color: C.accent,
          colors: sum.map((r) => (sel.ro && sel.ro !== r.ro ? CONTEXT_GRAY : r.g.abs < 0 ? C.neg : C.accent)) }],
        format: (v) => fmt.signed(v, 1), title: (p) => sum[p[0].dataIndex].ro,
        onClick: (i) => api.set({ ro: sel.ro === sum[i].ro ? '' : sum[i].ro }),
      });
      api.tools({
        png: api.cid('c'),
        table: () => ({
          title: 'Pertumbuhan OS per RO', columns: ['RO', 'Pertumbuhan (Rp M)', 'Pertumbuhan (%)', 'Porsi dari total'],
          rows: sum.map((r) => [r.ro, fmt.signed(r.g.abs, 1), fmt.signedPct(r.g.rel, 2), fmt.pct(ratio(r.g.abs, total), 1)]),
        }),
      });
    },
  }),

  prodRo: () => ({
    title: 'Disburse per RM per RO (Rp M)', desc: 'Produktivitas RM tiap RO dibanding guidance per RM',
    icon: 'user-check', w: 6, h: 5, minW: 4, minH: 4,
    render(api) {
      const { pm, bulan, slice: s, sel } = api.ctx;
      const sum = roSummary(pm, bulan, s?.endDay).sort((a, b) => (b.disbrm.value ?? 0) - (a.disbrm.value ?? 0));
      if (!sum.length) { api.body.innerHTML = empty('Belum ada data per RO'); return; }
      api.sub(`Rp M per RM, ${sinceText(s)}. Klik batang untuk filter RO.`);
      api.body.innerHTML = `${legend(api)}${chartBox(api, 'c', 'Disburse per RM per RO')}`;
      const chart = barChart(canvasOf(api, 'c'), {
        labels: sum.map((r) => shortRo(r.ro)),
        series: [
          { label: 'Disburse/RM', data: sum.map((r) => r.disbrm.value ?? null), color: C.accent,
            colors: sum.map((r) => (sel.ro && sel.ro !== r.ro ? CONTEXT_GRAY : C.accent)) },
          { label: 'Guidance/RM', data: sum.map((r) => r.disbrm.guidance ?? null), color: C.barPrev },
        ],
        format: (v) => fmt.num(v, 2), title: (p) => sum[p[0].dataIndex].ro, sort: false,
        onClick: (i) => api.set({ ro: sel.ro === sum[i].ro ? '' : sum[i].ro }),
      });
      bindLegend(legendOf(api), chart, { shape: 'box' });
      api.tools({ png: api.cid('c') });
    },
  }),

  rank: () => {
    let sortKey = 'os'; let sortDir = 'desc';
    return {
      title: 'Peringkat RO', desc: 'Tabel capaian semua KPI per Regional Office, bisa diurutkan',
      icon: 'table', w: 12, h: 7, minW: 6, minH: 4,
      render(api) {
        const { pm, bulan, slice: s, sel } = api.ctx;
        const sum = roSummary(pm, bulan, s?.endDay);
        if (!sum.length) { api.body.innerHTML = empty('Belum ada data per RO'); return; }
        api.sub(`${sinceText(s)}. Klik judul kolom untuk mengurutkan, baris untuk filter RO.`);
        const achCell = (r, id, label) => `<span class="cell-ach">${tbar(r[id].ach, { label: `${r.ro} ${label}`, small: true })}${achPill(r[id].ach)}</span>`;
        const columns = [
          { key: 'ro', label: 'Regional Office', sort: (r) => r.ro, render: (r) => `<span class="ro-dot" style="--c:${roColor(pm, r.ro)}"></span>${esc(r.ro)}` },
          { key: 'os', label: 'OS (Rp M)', sort: (r) => r.end.os, render: (r) => fmt.num(r.end.os, 0) },
          { key: 'osach', label: 'Capaian OS', sort: (r) => r.os.ach, render: (r) => achCell(r, 'os', 'capaian OS') },
          { key: 'debach', label: 'Debitur', sort: (r) => r.deb.ach, render: (r) => achPill(r.deb.ach) },
          { key: 'smlach', label: 'SML', sort: (r) => r.sml.ach, render: (r) => achPill(r.sml.ach) },
          { key: 'nplach', label: 'NPL', sort: (r) => r.npl.ach, render: (r) => achPill(r.npl.ach) },
          { key: 'npl', label: '%NPL/OS', sort: (r) => r.npl.share, render: (r) => fmt.pct(r.npl.share) },
          { key: 'disb', label: 'Disburse vs prognosa', sort: (r) => r.disb.achProg, render: (r) => achPill(r.disb.achProg) },
          { key: 'disbrm', label: 'Disburse/RM', sort: (r) => r.disbrm.value, render: (r) => fmt.num(r.disbrm.value, 2) },
        ];
        const draw = () => {
          api.body.innerHTML = sortableTable({
            id: api.cid('t'), columns, rows: sum, sortKey, sortDir, caption: 'Peringkat RO',
            rowAttrs: (r) => `data-ro="${esc(r.ro)}" tabindex="0"${sel.ro === r.ro ? ' aria-selected="true"' : ''}`,
          });
        };
        draw();
        api.body.addEventListener('click', (e) => {
          const th = e.target.closest('[data-sort]');
          if (th) {
            const k = th.dataset.sort;
            sortDir = k === sortKey && sortDir === 'desc' ? 'asc' : 'desc';
            sortKey = k;
            draw();
            return;
          }
          const tr = e.target.closest('tr[data-ro]');
          if (tr) api.set({ ro: sel.ro === tr.dataset.ro ? '' : tr.dataset.ro });
        });
        api.body.addEventListener('keydown', (e) => {
          const tr = e.target.closest('tr[data-ro]');
          if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); api.set({ ro: sel.ro === tr.dataset.ro ? '' : tr.dataset.ro }); }
        });
        api.tools({
          table: () => ({
            title: 'Peringkat RO', subtitle: sinceText(s),
            columns: ['RO', 'OS (Rp M)', 'Capaian OS', 'Capaian Debitur', 'Capaian SML', 'Capaian NPL', '%NPL/OS', 'Disburse vs prognosa', 'Disburse/RM'],
            rows: sum.map((r) => [r.ro, fmt.num(r.end.os, 0), fmt.pct(r.os.ach, 1), fmt.pct(r.deb.ach, 1), fmt.pct(r.sml.ach, 1),
              fmt.pct(r.npl.ach, 1), fmt.pct(r.npl.share), fmt.pct(r.disb.achProg, 1), fmt.num(r.disbrm.value, 2)]),
          }),
        });
      },
    };
  },

  signals: () => ({
    title: 'Perlu perhatian', desc: 'KPI yang capaiannya di bawah 100% target',
    icon: 'alert', w: 4, h: 6, minW: 3, minH: 4,
    render(api) {
      const { pm, bulan, slice: s, sel } = api.ctx;
      const items = signalItems(pm, bulan, s?.endDay, sel.ro);
      api.sub(`${items.length ? `${items.length} KPI di bawah target` : 'Tidak ada KPI di bawah target'}${s && !s.full ? '. Disburse dinilai setelah bulan selesai.' : '.'}`);
      api.body.innerHTML = `<div class="scroll">${signalsHtml(items.slice(0, 40))}</div>`;
      onPick(api, 'data-action', (ro) => { if (!sel.ro) api.set({ ro }); });
    },
  }),

  heat: () => ({
    title: 'Capaian RO per KPI', desc: 'Peta panas: baris RO, kolom KPI, warna = status capaian',
    icon: 'heatmap', w: 7, h: 6, minW: 5, minH: 4,
    render(api) {
      const { pm, bulan, slice: s, sel } = api.ctx;
      const sum = roSummary(pm, bulan, s?.endDay);
      if (!sum.length) { api.body.innerHTML = empty('Belum ada data per RO'); return; }
      const nas = pm.hasNasional ? perfContext(pm, '', bulan, s?.endDay).slice : null;
      const rows = [...(nas ? [{ ro: NASIONAL, nas: true, ...Object.fromEntries(PERF_CARDS.map((c) => [c.id, cardValues(c, nas.end)])) }] : []), ...sum];
      const cell = (r, c) => {
        const v = c.type === 'disburse' ? r[c.id].achProg : r[c.id].ach;
        const lvl = achLevel(v);
        return `<td class="heat-cell ${lvl}" title="${esc(`${r.ro}, ${c.label}: ${fmt.pct(v, 1)} ${c.type === 'disburse' ? 'vs prognosa' : 'vs RKA'}`)}">${fmt.pct(v, 0)}</td>`;
      };
      api.sub(`${sinceText(s)}. Disburse vs prognosa, lainnya vs RKA. Klik baris untuk filter RO.`);
      api.body.innerHTML = `<div class="table-wrap scroll" tabindex="0" role="region" aria-label="Capaian RO per KPI"><table class="heatmap">
        <thead><tr><th scope="col">RO</th>${PERF_CARDS.map((c) => `<th scope="col">${esc(c.title)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r) => `<tr data-ro="${r.nas ? '' : esc(r.ro)}" class="${r.nas ? 'national' : ''}${sel.ro === r.ro ? ' on' : ''}" tabindex="0">
          <th scope="row">${esc(r.nas ? 'Nasional' : shortRo(r.ro))}</th>${PERF_CARDS.map((c) => cell(r, c)).join('')}</tr>`).join('')}</tbody></table></div>
        <p class="heat-legend"><span class="heat-cell good">≥100%</span><span class="heat-cell warn">90–99%</span><span class="heat-cell bad">&lt;90%</span></p>`;
      onPick(api, 'data-ro', (ro) => api.set({ ro: sel.ro === ro ? '' : ro }));
      api.tools({
        table: () => ({
          title: 'Capaian RO per KPI', columns: ['RO', ...PERF_CARDS.map((c) => c.title)],
          rows: rows.map((r) => [r.ro, ...PERF_CARDS.map((c) => fmt.pct(c.type === 'disburse' ? r[c.id].achProg : r[c.id].ach, 1))]),
        }),
      });
    },
  }),

  map: () => {
    const F = { os: CARD.os.value, rka: CARD.os.target, sml: CARD.sml.value, npl: CARD.npl.value, disb: CARD.disb.value, prog: CARD.disb.prognosa };
    const METRICS = [
      { id: 'os', label: 'Capaian OS', calc: (t) => ratio(t.os, t.rka), format: (v) => fmt.pct(v, 1), note: 'OS ÷ RKA' },
      { id: 'npl', label: '%NPL', calc: (t) => ratio(t.npl, t.os), format: (v) => fmt.pct(v, 2), note: 'NPL ÷ OS' },
      { id: 'sml', label: '%SML', calc: (t) => ratio(t.sml, t.os), format: (v) => fmt.pct(v, 2), note: 'SML ÷ OS' },
      { id: 'disb', label: 'Disburse', calc: (t) => ratio(t.disb, t.prog), format: (v) => fmt.pct(v, 1), note: 'Disburse ÷ prognosa' },
      { id: 'osv', label: 'Outstanding', calc: (t) => t.os, format: (v) => `${fmt.num(v, 0)} M`, note: 'Rp miliar' },
    ];
    const state = { metric: 'os', view: 'nasional' };
    return {
      title: 'Peta Indonesia per Regional Office', desc: 'Wilayah RO menurut kantor cabangnya, termasuk pembagian Jakarta 1, 2, dan 3 di Jabodetabek',
      icon: 'map', w: 12, h: 8, minW: 6, minH: 6, fit: true,
      render(api) {
        const { pm, bulan, slice: s, sel } = api.ctx;
        const sum = roSummary(pm, bulan, s?.endDay);
        if (!sum.length) { api.body.innerHTML = empty('Belum ada data per RO'); return; }
        const T = pm.territory;
        const endOf = new Map(sum.map((r) => [r.ro, r.end]));
        const totals = (ros) => {
          const t = Object.fromEntries(Object.keys(F).map((k) => [k, 0]));
          for (const ro of ros) { const e = endOf.get(ro) || {}; for (const k of Object.keys(F)) t[k] += Number.isFinite(e[F[k]]) ? e[F[k]] : 0; }
          return t;
        };
        const metricOf = (mid) => METRICS.find((x) => x.id === mid) || METRICS[0];
        const valueOf = (m, ro) => m.calc(totals([ro]));
        const present = (list) => list.filter((x) => endOf.has(x.ro));
        const metroRos = sum.map((r) => r.ro).filter((ro) => T.isMetro(ro));
        const unmapped = T.unmapped.filter((ro) => endOf.has(ro)).map(shortRo);
        const kancaNames = (list) => {
          const names = list.map((k) => kancaLabel(k).replace(/^KC\s+/i, ''));
          return names.length > 4 ? `${names.slice(0, 4).join(', ')}, +${names.length - 4}` : names.join(', ');
        };
        const popout = ({ prov, ro }) => openMapPopout({
          load: () => perfKancaSource(pm.regions), mode: 'region', prov, ro,
          onRegion: (r) => api.set({ ro: r }),
          onKanca: (k, r) => api.go('portofolio', { ro: r, kanca: k }),
          kancaHint: 'Klik nama kantor cabang untuk membukanya di Portofolio.',
        });
        api.sub(`${sinceText(s)}. Wilayah RO mengikuti kantor cabangnya. Klik wilayah di peta untuk detail per region atau pulau, klik nama RO untuk filter.${unmapped.length ? ` Belum dipetakan: ${unmapped.join(', ')}.` : ''}`);
        renderMapPanel(api, {
          state,
          metrics: METRICS,
          build: (mid) => {
            const m = metricOf(mid);
            const provinces = new Map();
            for (const p of T.provinces()) {
              const ros = present(T.rosIn(p));
              if (!ros.length) continue;
              const lines = ros.map((x) => `<span>${esc(shortRo(x.ro))}: ${x.n} kanca, ${esc(m.format(valueOf(m, x.ro)))}</span>`).join('');
              const hint = metroRos.includes(ros[0].ro) ? `Klik untuk membuka peta ${METRO_NAME}` : ros.length > 1 ? `Warna mengikuti ${shortRo(ros[0].ro)}, RO dengan kanca terbanyak` : '';
              provinces.set(p, { value: valueOf(m, ros[0].ro), tip: `<b>${esc(provinceName(p))}</b>${lines}${hint ? `<em>${esc(hint)}</em>` : ''}` });
            }
            const labels = sum.filter((r) => !metroRos.includes(r.ro)).map((r) => {
              const home = T.homeOf(r.ro).filter((p) => provinces.has(p));
              return home.length ? { prov: home, name: shortRo(r.ro), value: valueOf(m, r.ro), own: T.owner(home[0]) === r.ro } : null;
            }).filter(Boolean);
            if (metroRos.length) {
              const home = [...new Set(metroRos.flatMap((ro) => T.homeOf(ro)))].filter((p) => provinces.has(p) && metroRos.includes(T.owner(p)));
              if (home.length) labels.push({ prov: home, name: nameList(metroRos.map(shortRo), 3), value: m.calc(totals(metroRos)), own: false });
            }
            const items = sum.map((r) => ({
              key: r.ro, label: shortRo(r.ro), value: valueOf(m, r.ro), active: sel.ro === r.ro,
              sub: T.isMetro(r.ro) ? T.metroAreasOf(r.ro).map((id) => metroArea(id).short).join(', ') : nameList(T.provincesOf(r.ro).map(provinceName), 2) || 'Belum dipetakan',
            })).sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
            return {
              provinces, labels, format: m.format, note: m.note, emptyTip: 'Tidak ada kantor cabang di provinsi ini',
              selected: new Set(sel.ro ? T.provincesOf(sel.ro) : []),
              list: { title: `Peringkat RO, ${m.label}`, items },
              aria: `Peta Indonesia, ${m.label} per wilayah Regional Office. Peringkat lengkap ada di daftar di samping peta.`,
            };
          },
          metro: metroRos.length ? (mid) => {
            const m = metricOf(mid);
            const tiles = new Map();
            for (const a of METRO_AREAS) {
              const ros = present(T.metroIn(a.id));
              if (!ros.length) continue;
              const total = ros.reduce((t, x) => t + x.n, 0);
              const roText = ros.map((x) => shortRo(x.ro)).join(', ');
              tiles.set(a.id, {
                value: valueOf(m, ros[0].ro), owner: ros[0].ro, roText,
                split: ros[1] ? { value: valueOf(m, ros[1].ro), share: ros[0].n / total } : null,
                sub: nameList(ros.map((x) => shortRo(x.ro)), 3),
                tip: `<b>${esc(a.name)}</b>${ros.map((x) => `<span>${esc(shortRo(x.ro))}: ${x.n} kanca${x.kanca.length ? ` (${esc(kancaNames(x.kanca))})` : ''}</span><em>${esc(m.label)} ${esc(shortRo(x.ro))} ${esc(m.format(valueOf(m, x.ro)))}</em>`).join('')}`,
                aria: `${a.name}: ${ros.map((x) => `${shortRo(x.ro)} ${x.n} kanca, ${m.label} ${m.format(valueOf(m, x.ro))}`).join('; ')}`,
              });
            }
            const items = metroRos.map((ro) => ({
              key: ro, label: shortRo(ro), value: valueOf(m, ro), active: sel.ro === ro,
              sub: `${T.kancaCount(ro)} kanca: ${T.metroAreasOf(ro).map((id) => metroArea(id).short).join(', ')}`,
            })).sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
            return {
              tiles, format: m.format, note: m.note, split: [...tiles.values()].some((t) => t.split),
              selected: new Set(sel.ro ? T.metroAreasOf(sel.ro) : []),
              list: { title: `RO di ${METRO_NAME}, ${m.label}`, items },
              aria: `Peta ${METRO_NAME}, ${m.label} per Regional Office. Wilayah dibagi menurut kantor cabang; garis tebal memisahkan wilayah RO.`,
            };
          } : null,
          onProv: (p) => {
            const ros = present(T.rosIn(p)).map((x) => x.ro);
            if (ros.length) popout({ prov: p, ro: ros[0] });
          },
          onArea: (id) => {
            const ros = present(T.metroIn(id)).map((x) => x.ro);
            if (ros.length) popout({ prov: metroArea(id).prov, ro: ros[0] });
          },
          onItem: (ro) => api.set({ ro: sel.ro === ro ? '' : ro }),
        });
      },
    };
  },

  quality12: () => ({
    title: 'Kualitas kredit per bulan', desc: '%SML dan %NPL terhadap OS di akhir tiap bulan',
    icon: 'shield', w: 8, h: 5, minW: 4, minH: 4,
    render(api) {
      const { pm, roKey, roLabel, bulan } = api.ctx;
      const rows = pm.months.map((m) => {
        const all = (pm.byRo.get(roKey) || []).filter((r) => r.tanggal.startsWith(m));
        return { bulan: m, row: all.at(-1) || null };
      }).filter((x) => x.row && x.bulan <= bulan).slice(-12);
      if (!rows.length) { api.body.innerHTML = empty('Belum ada data bulanan'); return; }
      const sml = rows.map((x) => ratio(x.row.dpk, x.row.os));
      const npl = rows.map((x) => ratio(x.row.npl, x.row.os));
      const first = npl.find(ok); const last = npl.at(-1);
      api.sub(`${roLabel}, nilai akhir bulan (bulan berjalan: tanggal terakhir).`);
      api.body.innerHTML = `${stats([
        { label: '%SML terakhir', value: fmt.pct(sml.at(-1)) },
        { label: '%NPL terakhir', value: fmt.pct(last) },
        { label: `Perubahan %NPL sejak ${fmt.month(rows[0].bulan, true)}`, html: `${fmt.signed(ok(last) && ok(first) ? (last - first) * 100 : null, 2)} poin` },
      ])}${legend(api)}${chartBox(api, 'c', 'Persentase SML dan NPL per bulan')}`;
      const chart = lineChart(canvasOf(api, 'c'), {
        labels: rows.map((x) => fmt.month(x.bulan, true)),
        series: [
          { label: '%SML', data: sml, color: C.sml, points: 3 },
          { label: '%NPL', data: npl, color: C.npl, points: 3 },
        ],
        yAxis: true, tickFormat: (v) => fmt.pct(v, 1), format: (v) => fmt.pct(v), title: (p) => fmt.month(rows[p[0].dataIndex].bulan),
      });
      bindLegend(legendOf(api), chart);
      api.tools({
        png: api.cid('c'),
        table: () => ({
          title: 'Kualitas kredit per bulan', subtitle: roLabel, columns: ['Bulan', '%SML', '%NPL', 'OS (Rp M)'],
          rows: rows.map((x, i) => [fmt.month(x.bulan), fmt.pct(sml[i]), fmt.pct(npl[i]), fmt.num(x.row.os, 0)]),
        }),
      });
    },
  }),
};

export default {
  id: 'performance', title: 'Performance', icon: 'pulse',
  load: loadPerf,
  normalize(p, pm) {
    const bulan = pm.months.includes(p.bulan) ? p.bulan : pm.months.at(-1);
    const sd = /^\d{1,2}$/.test(p.sd || '') ? Number(p.sd) : null;
    return { ro: pm.regions.includes(p.ro) ? p.ro : '', bulan, sd };
  },
  context(pm, sel) {
    const ctx = perfContext(pm, sel.ro, sel.bulan, sel.sd);
    if (ctx.slice && sel.sd && ctx.slice.endDay !== sel.sd) sel.sd = null;
    return { ...ctx, sel, view: 'performance' };
  },
  subtitle(ctx) {
    const s = ctx.slice;
    if (!s) return `${ctx.roLabel}, ${fmt.month(ctx.bulan)}`;
    return `${ctx.roLabel}, posisi ${fmt.date(s.end.tanggal)}${s.full ? '' : ' (bulan berjalan)'}`;
  },
  filters(ctx) {
    const { pm, sel, slice } = ctx;
    const latest = sel.bulan === pm.months.at(-1);
    return `${pick({ id: 'f-ro', label: 'Regional Office', value: sel.ro, on: !!sel.ro, options: [{ value: '', label: 'Nasional' }, ...pm.regions.map((r) => ({ value: r, label: r }))] })}
      ${pick({ id: 'f-bulan', label: 'Bulan', value: sel.bulan, on: !latest, options: [...pm.months].reverse().map((m) => ({ value: m, label: fmt.month(m) })) })}
      ${pick({ id: 'f-sd', label: 'S.d. tanggal', value: sel.sd ? String(sel.sd) : '', on: !!sel.sd,
    options: [{ value: '', label: 'Terakhir' }, ...(slice ? [...slice.days].sort((a, b) => b - a).map((d) => ({ value: String(d), label: fmt.dateShort(`${sel.bulan}-${String(d).padStart(2, '0')}`) })) : [])] })}
      ${sel.ro || !latest || sel.sd ? '<button class="reset" type="button" data-reset>Reset filter</button>' : ''}`;
  },
  bindFilters(root, ctx, set) {
    root.querySelector('#f-ro').addEventListener('change', (e) => set({ ro: e.target.value }));
    root.querySelector('#f-bulan').addEventListener('change', (e) => set({ bulan: e.target.value, sd: '' }));
    root.querySelector('#f-sd').addEventListener('change', (e) => set({ sd: e.target.value }));
    root.querySelector('[data-reset]')?.addEventListener('click', () => set({ ro: '', bulan: '', sd: '' }));
  },
  widgets: {
    strip: perfWidgets.strip(),
    hero: perfWidgets.hero(),
    kpis: perfWidgets.kpis(),
    'trend-os': perfWidgets.trend('growth-os'),
    'trend-disb': perfWidgets.trend('disburse'),
    pace: perfWidgets.pace(),
    'prod-rm': perfWidgets.trend('prod-rm'),
    sml: perfWidgets.quality('sml'),
    npl: perfWidgets.quality('npl'),
    risk: perfWidgets.risk(),
    kuadran: perfWidgets.kuadran(),
    signals: perfWidgets.signals(),
    rank: perfWidgets.rank(),
    contrib: perfWidgets.contrib(),
    'prod-ro': perfWidgets.prodRo(),
    map: perfWidgets.map(),
    outlook: outlookWidget((c) => ({ pm: c.pm, real: null, ro: c.sel.ro })),
    analysis: analysisWidget((c) => ({ data: { pm: c.pm }, scope: { ro: c.sel.ro, bulan: c.sel.bulan, sd: c.sel.sd }, sources: ['performance'] })),
  },
  layout: [
    { id: 'strip', x: 0, y: 0, w: 12, h: 3 },
    { id: 'trend-os', x: 0, y: 3, w: 5, h: 6 },
    { id: 'kuadran', x: 5, y: 3, w: 3, h: 6 },
    { id: 'prod-rm', x: 8, y: 3, w: 4, h: 6 },
    { id: 'trend-disb', x: 0, y: 9, w: 5, h: 6 },
    { id: 'sml', x: 5, y: 9, w: 3, h: 6 },
    { id: 'npl', x: 8, y: 9, w: 4, h: 6 },
    { id: 'pace', x: 0, y: 15, w: 6, h: 6 },
    { id: 'risk', x: 6, y: 15, w: 6, h: 6 },
    { id: 'outlook', x: 0, y: 21, w: 12, h: 13 },
    { id: 'map', x: 0, y: 34, w: 12, h: 9 },
    { id: 'rank', x: 0, y: 43, w: 12, h: 6 },
    { id: 'analysis', x: 0, y: 49, w: 12, h: 8 },
  ],
};

export { dayOf, icon };
