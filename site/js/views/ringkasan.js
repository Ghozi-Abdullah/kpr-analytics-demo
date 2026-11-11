import { fmt } from '../core/format.js';
import { pick } from '../core/controls.js';
import { perfContext, NASIONAL } from '../models/performance-model.js';
import { perfWidgets } from './performance.js';
import { realWidgets, realContext } from './realisasi.js';
import { pfWidgets, pfContext } from './portofolio.js';
import { slaWidgets, slaContext } from './sla.js';
import { loadPerf, loadReal, loadPf, preparePf, loadSla } from '../services/datasets.js';
import { empty } from '../widgets/widget-kit.js';
import { analysisWidget } from '../widgets/insights-panel.js';
import { outlookWidget } from '../widgets/outlook-panel.js';
import { sectionWidget, explainWidget } from '../widgets/summary-rows.js';

const soft = (p) => p.catch((err) => { console.warn(err); return null; });

const insightSpec = (c) => ({
  data: { pm: c.pm, real: c.real?.model || null, pf: c.pf?.model || null },
  scope: {
    performance: { ro: c.sel.ro, bulan: c.sel.bulan },
    realisasi: { ro: c.real?.sel.ro || '', bulan: c.real?.sel.bulan || '' },
    portofolio: { ro: c.pf?.sel.ro || '', bulan: c.pf?.sel.bulan || '' },
  },
});

const needs = (key, label, def) => ({
  ...def,
  render(api) {
    if (!api.ctx[key]) { api.body.innerHTML = empty(`Data ${label} belum tersedia`, 'Panel lain tetap bisa dipakai.'); return; }
    def.render(api);
  },
});

export default {
  id: 'ringkasan', title: 'Summary', icon: 'home',
  async load() {
    const [pm, real, pf, sla] = await Promise.all([loadPerf(), soft(loadReal()), soft(loadPf()), soft(loadSla())]);
    return { pm, real, pf, sla };
  },
  async prepare(m) {
    if (m.pf) await soft(preparePf(m.pf, { bulan: m.pf.index.months.at(-1) }));
  },
  normalize(p, m) {
    return { ro: m.pm.regions.includes(p.ro) ? p.ro : '', bulan: m.pm.months.includes(p.bulan) ? p.bulan : m.pm.months.at(-1) };
  },
  context(m, sel) {
    const perf = perfContext(m.pm, sel.ro, sel.bulan);
    const real = m.real ? realContext(m.real, {
      bulan: m.real.months.includes(sel.bulan) ? sel.bulan : m.real.months.at(-1),
      ro: m.real.ros.includes(sel.ro) ? sel.ro : '', kanca: '', rm: '', tipe: '', ukuran: 'plafond',
    }, { linked: true }) : null;
    let pf = null;
    if (m.pf && m.pf.monthData.has(m.pf.index.months.at(-1))) {
      const bulan = m.pf.index.months.at(-1);
      const ros = new Set((m.pf.monthData.get(bulan) || []).map((r) => r.ro));
      pf = pfContext(m.pf, { bulan, ro: ros.has(sel.ro) ? sel.ro : '', kanca: '', ukuran: 'os', node: 'all' }, { linked: true });
    }
    const sla = m.sla?.rows.length ? slaContext(m.sla, { ro: '', kanca: '', tahap: '', pendapatan: '', putusan: '', bulan: '' }, { linked: true }) : null;
    return { ...perf, sel, real, pf, sla, view: 'ringkasan' };
  },
  subtitle(c) {
    const s = c.slice;
    return `${c.roLabel}, ${s ? `posisi ${fmt.date(s.end.tanggal)}` : fmt.month(c.bulan)}. Ringkasan per dashboard, analisis lengkap di bagian bawah.`;
  },
  filters(c) {
    const { pm, sel } = c;
    const latest = sel.bulan === pm.months.at(-1);
    return `${pick({ id: 'f-ro', label: 'Regional Office', value: sel.ro, on: !!sel.ro, options: [{ value: '', label: NASIONAL }, ...pm.regions.map((r) => ({ value: r, label: r }))] })}
      ${pick({ id: 'f-bulan', label: 'Bulan', value: sel.bulan, on: !latest, options: [...pm.months].reverse().map((x) => ({ value: x, label: fmt.month(x) })) })}
      ${sel.ro || !latest ? '<button class="reset" type="button" data-reset>Reset filter</button>' : ''}`;
  },
  bindFilters(root, c, set) {
    root.querySelector('#f-ro').addEventListener('change', (e) => set({ ro: e.target.value }));
    root.querySelector('#f-bulan').addEventListener('change', (e) => set({ bulan: e.target.value }));
    root.querySelector('[data-reset]')?.addEventListener('click', () => set({ ro: '', bulan: '' }));
  },
  widgets: {
    'sec-perf': sectionWidget({ title: 'Performance', desc: 'Outstanding, debitur, kualitas, dan disburse dibanding RKA', view: 'performance', action: 'Buka Performance' }),
    strip: perfWidgets.strip(),
    'os-trend': perfWidgets.trend('growth-os'),
    map: perfWidgets.map(),
    'explain-perf': explainWidget({ source: 'performance', label: 'Performance', resolve: insightSpec }),
    'sec-real': sectionWidget({ title: 'Realisasi', desc: 'Pencairan KPR per bulan dan per sumber', view: 'realisasi', action: 'Buka Realisasi' }),
    'real-months': needs('real', 'realisasi', realWidgets.months({ chart: true })),
    'real-tipe': needs('real', 'realisasi', { ...realWidgets.tipe(), w: 5, h: 6 }),
    'explain-real': needs('real', 'realisasi', explainWidget({ source: 'realisasi', label: 'Realisasi', resolve: insightSpec })),
    'sec-pf': sectionWidget({ title: 'Portofolio', desc: 'Posisi OS dan kualitas kredit seluruh segmen KPR', view: 'portofolio', action: 'Buka Portofolio' }),
    'pf-trend': needs('pf', 'portofolio', { ...pfWidgets.trend(), title: 'Tren OS portofolio' }),
    'pf-quality': needs('pf', 'portofolio', { ...pfWidgets.quality(), title: 'Kualitas portofolio' }),
    'explain-pf': needs('pf', 'portofolio', explainWidget({ source: 'portofolio', label: 'Portofolio', resolve: insightSpec })),
    'sec-sla': sectionWidget({ title: 'SLA', desc: 'Progres berkas dari prakarsa sampai cair, dan berapa yang lewat SLA', view: 'sla', action: 'Buka SLA' }),
    'sla-flow': needs('sla', 'SLA', slaWidgets.flow()),
    'sec-text': sectionWidget({ title: 'Analisis dan outlook', desc: 'Temuan lengkap lintas dashboard dan kebutuhan disburse bulan depan' }),
    analysis: analysisWidget(insightSpec, { title: 'Analisis lengkap', brief: true, limit: 6 }),
    outlook: outlookWidget((c) => ({ pm: c.pm, real: c.real?.model || null, ro: c.sel.ro })),
    hero: perfWidgets.hero(),
    kpis: perfWidgets.kpis({ compact: true }),
    heat: perfWidgets.heat(),
    signals: perfWidgets.signals(),
    quality: perfWidgets.quality12(),
    'pf-ks': needs('pf', 'portofolio', pfWidgets.split('ks')),
    'pf-qtrend': needs('pf', 'portofolio', { ...pfWidgets.qtrend(), title: 'Kualitas portofolio per bulan' }),
    risk: perfWidgets.risk(),
    'disb-pace': perfWidgets.pace(),
  },
  layout: [
    { id: 'sec-perf', x: 0, y: 0, w: 12, h: 1 },
    { id: 'strip', x: 0, y: 1, w: 12, h: 3 },
    { id: 'os-trend', x: 0, y: 4, w: 5, h: 7 },
    { id: 'map', x: 5, y: 4, w: 7, h: 7 },
    { id: 'explain-perf', x: 0, y: 11, w: 12, h: 4 },
    { id: 'sec-real', x: 0, y: 15, w: 12, h: 1 },
    { id: 'real-months', x: 0, y: 16, w: 7, h: 6 },
    { id: 'real-tipe', x: 7, y: 16, w: 5, h: 6 },
    { id: 'explain-real', x: 0, y: 22, w: 12, h: 4 },
    { id: 'sec-pf', x: 0, y: 26, w: 12, h: 1 },
    { id: 'pf-trend', x: 0, y: 27, w: 7, h: 6 },
    { id: 'pf-quality', x: 7, y: 27, w: 5, h: 6 },
    { id: 'explain-pf', x: 0, y: 33, w: 12, h: 4 },
    { id: 'sec-sla', x: 0, y: 37, w: 12, h: 1 },
    { id: 'sla-flow', x: 0, y: 38, w: 12, h: 9 },
    { id: 'sec-text', x: 0, y: 47, w: 12, h: 1 },
    { id: 'analysis', x: 0, y: 48, w: 12, h: 10 },
    { id: 'outlook', x: 0, y: 58, w: 12, h: 13 },
  ],
};
