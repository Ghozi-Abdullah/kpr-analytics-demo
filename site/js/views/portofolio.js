import { fmt, esc, shortRo } from '../core/format.js';
import { uniq, ratio, byText, ok } from '../core/values.js';
import { pick, seg, onSeg, searchPick, bindSearchPick } from '../core/controls.js';
import { icon } from '../core/icons.js';
import { PORTFOLIO_NODES } from '../config.js';
import { PORTFOLIO_UNIT, NODE, kolOf, jpOf, denomOf, matches, labelsFor, nodeTotals, segmentGaps } from '../models/portfolio-model.js';
import { barChart, lineChart, bindLegend, C } from '../charts/charts.js';
import { loadPf, preparePf } from '../services/datasets.js';
import { chartBox, canvasOf, legend, legendOf, stats, delta, rankList, donutHtml, mountDonut, onPick, empty } from '../widgets/widget-kit.js';
import { analysisWidget } from '../widgets/insights-panel.js';
import { renderBranchMap } from '../map/map-panel.js';

const UNIT = PORTFOLIO_UNIT;
const P = (api) => api.ctx.pf || api.ctx;
const act = (api, c, patch) => (c.linked ? api.go('portofolio', patch) : api.set(patch));

export function pfContext(m, sel, { linked = false } = {}) {
  const L = labelsFor(m.index, sel.ukuran);
  const monthRows = m.monthData.get(sel.bulan) || [];
  const all = monthRows.filter((r) => r.m === sel.ukuran);
  const rows = all.filter((r) => (!sel.ro || r.ro === sel.ro) && (!sel.kanca || r.kanca === sel.kanca));
  const totals = nodeTotals(rows);
  const node = NODE[sel.node] || NODE.all;
  const os = sel.ukuran === 'os';
  return {
    model: m, sel, L, all, rows, totals, node, linked,
    base: (id) => totals.get(id)?.get(L.base) || 0,
    get: (id, label) => (label ? totals.get(id)?.get(label) || 0 : 0),
    valueText: (v, d = 2) => (os ? fmt.rupiah(ok(v) ? v * UNIT : v, d) : fmt.num(v)),
    axisText: (v) => (os ? fmt.rupiah(v * UNIT, 0) : fmt.compact(v)),
    word: os ? 'OS' : 'debitur',
    where: [sel.ro || 'Nasional', sel.kanca].filter(Boolean).join(', '),
  };
}

function nodeTrend(c, nodeId) {
  const n = NODE[nodeId];
  const rows = c.model.trend.filter((r) => r.m === c.sel.ukuran && (!c.sel.ro || r.ro === c.sel.ro) && matches(r, n.filter));
  const months = c.model.index.months;
  const by = (label) => months.map((m) => (label ? rows.filter((r) => r.bulan === m && r.kat === label).reduce((s, r) => s + r.v, 0) : null));
  return { months, base: by(c.L.base), sml: by(c.L.sml), npl: by(c.L.npl) };
}

function gapNote(api, c) {
  if (!c.base('all')) return '';
  const gaps = segmentGaps(c.all);
  if (!gaps.length) return '';
  const quote = (list) => list.map((v) => `"${v}"`).join(', ');
  const lines = gaps.map((g) => `Kolom ${g.column} di data berisi ${g.values.length ? quote(g.values.slice(0, 12)) : 'nilai kosong'}${g.values.length > 12 ? `, dan ${g.values.length - 12} lainnya` : ''}; segmen mencari ${quote(g.missing)}.`);
  const id = api.cid('gap');
  return `<div class="stats seg-gap-chip"><button type="button" class="seg-gap-btn" popovertarget="${id}" title="${esc(lines.join(' '))}">${icon('alert', 14)}Isi segmen beda dengan data</button>
    <aside class="seg-gap-pop" id="${id}" popover><h3>Kenapa sebagian segmen 0?</h3>
    <p>Nama segmen di dashboard tidak sama dengan isi kolom di file Excel, jadi datanya tidak terhitung ke segmen itu.</p>
    <ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    <p>Samakan isinya di <code>site/js/config.js</code> bagian <code>PORTFOLIO_NODES</code>.</p></aside></div>`;
}

export const pfWidgets = {
  seg: () => ({
    title: 'Segmen portofolio', desc: 'Delapan segmen dengan nilai, porsi, dan %NPL. Klik untuk memilih segmen',
    icon: 'layers', w: 12, h: 3, minW: 6, minH: 3, fit: true,
    render(api) {
      const c = P(api);
      const all = c.base('all');
      api.sub(`${c.where}, ${fmt.month(c.sel.bulan)}. Klik segmen untuk memilihnya di semua panel.`);
      api.body.innerHTML = `${gapNote(api, c)}<div class="segcards tiles">${PORTFOLIO_NODES.map((n) => {
        const b = c.base(n.id);
        const npl = ratio(c.get(n.id, c.L.npl), b);
        return `<button type="button" class="tile segcard${n.id === 'all' ? ' lead' : ''}" data-node="${n.id}" aria-pressed="${n.id === c.node.id}">
          <span class="tile-body"><span class="tile-h"><span class="tile-l" title="${esc(n.card)}">${esc(n.card)}</span></span>
          <span class="tile-v sm">${c.valueText(b)}</span>
          <span class="tile-sub"><span>NPL <b>${fmt.pct(npl, 2)}</b></span>${n.id === 'all' ? '' : `<span class="tile-share" title="Porsi ${esc(n.card)} dari ALL KPR">${fmt.pct(ratio(b, all), 1)}</span>`}</span></span></button>`;
      }).join('')}</div>`;
      onPick(api, 'data-node', (id) => act(api, c, { node: id === 'all' ? '' : id }));
    },
  }),

  tree: () => ({
    title: 'Pohon portofolio', desc: 'ALL KPR sampai Tier developer, tiap segmen dengan tabel kategori lengkap (seperti dashboard Looker)',
    icon: 'tree', w: 12, h: 11, minW: 9, minH: 9, fit: true,
    render(api) {
      const c = P(api);
      const all = c.base('all');
      const L = c.L;
      const ROWS = [
        { name: L.base, cells: [L.base, L.fi, L.nfi] },
        { name: 'SML', kol: 'sml', cells: [L.sml, L.smlFi, L.smlNfi] },
        { name: 'NPL', kol: 'npl', cells: [L.npl, L.nplFi, L.nplNfi] },
      ];
      const mtx = (id) => {
        const den = ROWS[0].cells.map((l) => c.get(id, l));
        return `<table class="tree-node-table"><thead><tr><th scope="col"><span class="sr-only">Kategori</span></th><th scope="col">Total</th><th scope="col">FI</th><th scope="col">NFI</th></tr></thead>
          <tbody>${ROWS.map((r) => `<tr${r.kol ? ` class="row-${r.kol}"` : ''}><th scope="row">${r.kol ? `<i></i>` : ''}${esc(r.name)}</th>${r.cells.map((l, k) => {
            const v = c.get(id, l);
            return `<td title="${esc(l)}"><span>${c.valueText(v)}</span>${r.kol ? `<small>${fmt.pct(ratio(v, den[k]))}</small>` : ''}</td>`;
          }).join('')}</tr>`).join('')}</tbody></table>`;
      };
      const qbar = (id) => {
        const b = c.base(id); const s = c.get(id, L.sml); const n = c.get(id, L.npl);
        const w = (v) => `${Math.max(0, (ratio(v, b) || 0) * 100).toFixed(2)}%`;
        const tip = `Lancar ${fmt.pct(ratio(Math.max(0, b - s - n), b), 1)}, SML ${fmt.pct(ratio(s, b), 1)}, NPL ${fmt.pct(ratio(n, b), 1)}`;
        return `<span class="tree-node-quality" role="img" aria-label="Kualitas: ${tip}" title="${tip}"><i style="width:${w(Math.max(0, b - s - n))};background:${C.lancar}"></i><i style="width:${w(s)};background:${C.sml}"></i><i style="width:${w(n)};background:${C.npl}"></i></span>`;
      };
      const rootHead = () => {
        const fi = c.get('all', L.fi); const nfi = c.get('all', L.nfi);
        return `<div class="tree-node-total"><span>${esc(c.word === 'OS' ? 'Outstanding' : 'Debitur')} ALL KPR</span><b>${c.valueText(all)}</b></div>
          <div class="tree-node-kpis">
            <span><small>%SML</small><b>${fmt.pct(ratio(c.get('all', L.sml), all))}</b></span>
            <span><small>%NPL</small><b>${fmt.pct(ratio(c.get('all', L.npl), all))}</b></span>
            <span><small>Porsi FI</small><b>${fmt.pct(ratio(fi, fi + nfi), 1)}</b></span></div>`;
      };
      api.sub('Biru = jalur utama. Klik judul segmen untuk memilih. % SML/NPL terhadap OS di kolom yang sama.');
      api.body.innerHTML = `<div class="portfolio-tree" data-tree><svg class="tree-wires" aria-hidden="true"></svg>${PORTFOLIO_NODES.map((n) => `
        <div class="tree-node${n.main || n.id === 'all' ? ' main' : ''}${n.id === 'all' ? ' root' : ''}${n.id === c.node.id ? ' on' : ''}" data-node="${n.id}" style="grid-column:${n.col};grid-row:${n.row}">
          <button type="button" class="tree-node-head" aria-pressed="${n.id === c.node.id}"><span class="tree-node-icon">${icon(n.icon || 'layers', 14)}</span><span class="tree-node-label">${esc(n.card)}</span>
            ${n.id === 'all' ? '' : `<em title="Porsi dari ALL KPR">${fmt.pct(ratio(c.base(n.id), all), 1)}</em>`}</button>
          <div class="tree-node-body">${n.id === 'all' ? rootHead() : ''}${mtx(n.id)}${qbar(n.id)}</div></div>`).join('')}
        <div class="tree-fill" style="grid-column:1;grid-row:3"><b>Kualitas ${esc(c.node.label)}</b>${donutHtml(api, 'q', 'Komposisi kualitas segmen terpilih')}</div>
        <div class="tree-fill" style="grid-column:2;grid-row:3"><b>Komersial dan Subsidi</b>${donutHtml(api, 'k', 'Porsi Komersial dan Subsidi')}</div>
        <div class="tree-fill" style="grid-column:4;grid-row:3"><b>Tier developer</b>${donutHtml(api, 't', 'Porsi Tier 1 dan Non Tier 1')}</div></div>`;
      const id = c.node.id;
      const b = c.base(id); const sml = c.get(id, c.L.sml); const npl = c.get(id, c.L.npl);
      const fmtV = (v) => c.valueText(v);
      mountDonut(api, 'q', [
        { label: 'Lancar', value: Math.max(0, b - sml - npl), color: C.lancar },
        { label: 'SML', value: sml, color: C.sml }, { label: 'NPL', value: npl, color: C.npl },
      ], { center: fmt.pct(ratio(npl, b), 2), centerSub: 'NPL', format: fmtV });
      const ko = c.base('komersial'); const su = c.base('subsidi');
      mountDonut(api, 'k', [{ label: 'Komersial', value: ko, color: C.accent }, { label: 'Subsidi', value: su, color: C.prev }],
        { center: fmt.pct(ratio(ko, ko + su), 1), centerSub: 'Komersial', format: fmtV });
      const t1 = c.base('tier1'); const nt = c.base('nontier1');
      mountDonut(api, 't', [{ label: 'Tier 1', value: t1, color: C.accent }, { label: 'Non Tier 1', value: nt, color: C.prev }],
        { center: fmt.pct(ratio(t1, t1 + nt), 1), centerSub: 'Tier 1', format: fmtV });

      const tree = api.body.querySelector('[data-tree]');
      const svg = tree.querySelector('.tree-wires');
      const pathOf = (nid) => { const out = []; let n = NODE[nid]; while (n) { out.push(n.id); n = NODE[n.parent]; } return out; };
      const highlight = (nid) => {
        const p = pathOf(nid);
        tree.querySelectorAll('.tree-node').forEach((el) => el.classList.toggle('highlighted', p.includes(el.dataset.node)));
        svg.querySelectorAll('path[data-to]').forEach((el) => el.classList.toggle('on', p.includes(el.dataset.to) && p.includes(el.dataset.from)));
      };
      const draw = () => {
        const box = tree.getBoundingClientRect();
        if (!box.width) return;
        const rect = (nid) => tree.querySelector(`.tree-node[data-node="${nid}"]`)?.getBoundingClientRect();
        svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
        svg.innerHTML = `<defs><marker id="${api.cid('arrow')}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8Z" class="tree-wire-head"/></marker></defs>${PORTFOLIO_NODES.filter((n) => n.parent).map((n) => {
          const a = rect(n.parent); const bb = rect(n.id);
          if (!a || !bb) return '';
          const x1 = a.right - box.left; const y1 = a.top + 15 - box.top;
          const x2 = bb.left - box.left - 2; const y2 = bb.top + 15 - box.top;
          const mx = x1 + (x2 - x1) / 2; const r = Math.min(8, Math.abs(y2 - y1) / 2);
          const dir = y2 > y1 ? 1 : -1;
          const d = Math.abs(y2 - y1) < 1 ? `M${x1} ${y1}H${x2}`
            : `M${x1} ${y1}H${mx - r}Q${mx} ${y1} ${mx} ${y1 + dir * r}V${y2 - dir * r}Q${mx} ${y2} ${mx + r} ${y2}H${x2}`;
          return `<path d="${d}" data-from="${n.parent}" data-to="${n.id}" marker-end="url(#${api.cid('arrow')})"/>`;
        }).join('')}`;
        highlight(c.node.id);
      };
      const ro = new ResizeObserver(draw);
      ro.observe(tree);
      api.cleanup(() => ro.disconnect());
      tree.addEventListener('pointerover', (e) => { const n = e.target.closest('.tree-node'); if (n) highlight(n.dataset.node); });
      tree.addEventListener('pointerleave', () => highlight(c.node.id));
      tree.addEventListener('focusin', (e) => { const n = e.target.closest('.tree-node'); if (n) highlight(n.dataset.node); });
      api.body.addEventListener('click', (e) => {
        const n = e.target.closest('.tree-node');
        if (n) act(api, c, { node: n.dataset.node === 'all' ? '' : n.dataset.node });
      });
      api.tools({
        table: () => ({
          title: 'Pohon portofolio', subtitle: `${c.where}, ${fmt.month(c.sel.bulan)}`,
          columns: ['Kategori', ...PORTFOLIO_NODES.map((n) => n.label)],
          rows: c.L.order.map((label) => [label, ...PORTFOLIO_NODES.map((n) => c.valueText(c.get(n.id, label)))]),
        }),
      });
    },
  }),

  quality: () => ({
    title: 'Kualitas kredit', desc: 'Komposisi Lancar, SML, NPL pada segmen terpilih',
    icon: 'donut', w: 4, h: 6, minW: 3, minH: 5,
    render(api) {
      const c = P(api);
      const id = c.node.id;
      const b = c.base(id); const sml = c.get(id, c.L.sml); const npl = c.get(id, c.L.npl);
      api.sub(`${c.node.label}, ${fmt.month(c.sel.bulan)}`);
      api.body.innerHTML = donutHtml(api, 'd', 'Komposisi kualitas kredit');
      mountDonut(api, 'd', [
        { label: 'Lancar', value: Math.max(0, b - sml - npl), color: C.lancar },
        { label: 'SML', value: sml, color: C.sml },
        { label: 'NPL', value: npl, color: C.npl },
      ], { center: fmt.pct(ratio(npl, b), 2), centerSub: 'NPL', format: (v) => c.valueText(v) });
    },
  }),

  split: (kind) => ({
    title: kind === 'ks' ? 'Komersial dan Subsidi' : 'Tier developer',
    desc: kind === 'ks' ? 'Porsi Komersial dan Subsidi terhadap ALL KPR' : 'Porsi Tier 1 dan Non Tier 1 di Komersial Primary',
    icon: 'donut', w: 4, h: 6, minW: 3, minH: 5,
    render(api) {
      const c = P(api);
      const [a, b] = kind === 'ks' ? ['komersial', 'subsidi'] : ['tier1', 'nontier1'];
      const va = c.base(a); const vb = c.base(b);
      api.sub(kind === 'ks' ? `ALL KPR, ${fmt.month(c.sel.bulan)}` : `Komersial Primary, ${fmt.month(c.sel.bulan)}`);
      api.body.innerHTML = donutHtml(api, 'd', `Porsi ${NODE[a].label} dan ${NODE[b].label}`);
      mountDonut(api, 'd', [
        { label: NODE[a].label, value: va, color: C.accent },
        { label: NODE[b].label, value: vb, color: C.prev },
      ], { center: fmt.pct(ratio(va, va + vb), 1), centerSub: NODE[a].label, format: (v) => c.valueText(v) });
    },
  }),

  trend: () => ({
    title: 'Tren bulanan segmen', desc: 'Nilai segmen terpilih tiap bulan dengan pertumbuhan bulanan',
    icon: 'bars', w: 6, h: 6, minW: 4, minH: 4,
    render(api) {
      const c = P(api);
      const t = nodeTrend(c, c.node.id);
      const i = t.months.indexOf(c.sel.bulan);
      const mom = i > 0 ? ratio(t.base[i] - t.base[i - 1], t.base[i - 1]) : null;
      const yoy = i >= 0 ? ratio(t.base[i] - t.base[0], t.base[0]) : null;
      api.sub(`${c.node.label}, ${c.sel.ro || 'Nasional'}${c.sel.kanca ? ' (level RO, filter kantor cabang tidak dipakai)' : ''}. Klik batang untuk membuka bulan.`);
      api.body.innerHTML = `${stats([
        { label: `${c.word} ${fmt.month(c.sel.bulan, true)}`, value: c.valueText(t.base[i]) },
        { label: 'vs bulan lalu', html: delta(mom, { d: 2 }) },
        { label: `vs ${fmt.month(t.months[0], true)}`, html: delta(yoy, { d: 2 }) },
      ])}${chartBox(api, 'c', 'Nilai segmen per bulan')}`;
      barChart(canvasOf(api, 'c'), {
        labels: t.months.map((m) => fmt.month(m, true)),
        series: [{ label: c.node.label, data: t.base, color: C.accent, colors: t.months.map((m) => (m === c.sel.bulan ? C.accent : C.barPrev)), hover: t.months.map(() => C.mid) }],
        format: (v) => c.valueText(v, 3), labelFormat: (v) => c.valueText(v), tickFormat: c.axisText, title: (p) => fmt.month(t.months[p[0].dataIndex]),
        hint: 'Klik untuk membuka bulan ini', onClick: (k) => act(api, c, { bulan: t.months[k] }),
      });
      api.tools({
        png: api.cid('c'),
        table: () => ({
          title: `${c.node.label} per bulan`, subtitle: c.sel.ro || 'Nasional', columns: ['Bulan', c.word, 'vs bulan lalu'],
          rows: t.months.map((m, k) => [fmt.month(m), c.valueText(t.base[k], 3), k ? fmt.signedPct(ratio(t.base[k] - t.base[k - 1], t.base[k - 1]), 2) : '–']),
        }),
      });
    },
  }),

  qtrend: () => ({
    title: 'Kualitas per bulan', desc: '%SML dan %NPL segmen terpilih tiap bulan',
    icon: 'shield', w: 6, h: 6, minW: 4, minH: 4,
    render(api) {
      const c = P(api);
      const t = nodeTrend(c, c.node.id);
      const sml = t.sml.map((v, i) => ratio(v, t.base[i]));
      const npl = t.npl.map((v, i) => ratio(v, t.base[i]));
      api.sub(`${c.node.label}, ${c.sel.ro || 'Nasional'}. Persentase terhadap ${c.word} segmen.`);
      api.body.innerHTML = `${legend(api)}${chartBox(api, 'c', 'Persentase SML dan NPL per bulan')}`;
      const chart = lineChart(canvasOf(api, 'c'), {
        labels: t.months.map((m) => fmt.month(m, true)),
        series: [{ label: '%SML', data: sml, color: C.sml, points: 3 }, { label: '%NPL', data: npl, color: C.npl, points: 3, lab: 'main', align: 'bottom' }],
        yAxis: true, tickFormat: (v) => fmt.pct(v, 1), format: (v) => fmt.pct(v), title: (p) => fmt.month(t.months[p[0].dataIndex]),
      });
      bindLegend(legendOf(api), chart);
      api.tools({
        png: api.cid('c'),
        table: () => ({ title: `Kualitas ${c.node.label}`, columns: ['Bulan', '%SML', '%NPL'], rows: t.months.map((m, i) => [fmt.month(m), fmt.pct(sml[i]), fmt.pct(npl[i])]) }),
      });
    },
  }),

  matrix: () => ({
    title: 'Matriks kategori', desc: 'Semua kategori (FI, NFI, SML, NPL) untuk delapan segmen dalam satu tabel',
    icon: 'table', w: 12, h: 7, minW: 6, minH: 4,
    render(api) {
      const c = P(api);
      const grp = (l) => (jpOf(l) ? `jp${kolOf(l)}` : 'b');
      api.sub('Persentase SML/NPL dihitung terhadap kategori induknya. Klik judul kolom untuk memilih segmen.');
      api.body.innerHTML = `<div class="table-wrap scroll" tabindex="0" role="region" aria-label="Matriks kategori"><table class="data-table matrix">
        <thead><tr><th scope="col">Kategori</th>${PORTFOLIO_NODES.map((n) => `<th scope="col"${n.id === c.node.id ? ' class="on"' : ''}><button type="button" data-node="${n.id}">${esc(n.label)}</button></th>`).join('')}</tr></thead>
        <tbody>${c.L.order.map((label, i) => `<tr${i > 0 && grp(label) !== grp(c.L.order[i - 1]) ? ' class="group-start"' : ''}><th scope="row">${esc(label)}</th>${PORTFOLIO_NODES.map((n) => {
          const v = c.get(n.id, label);
          const pct = kolOf(label) ? ratio(v, c.get(n.id, denomOf(label))) : null;
          return `<td${n.id === c.node.id ? ' class="on"' : ''}>${c.valueText(v)}${kolOf(label) ? `<span class="sub">${fmt.pct(pct)}</span>` : ''}</td>`;
        }).join('')}</tr>`).join('')}</tbody></table></div>`;
      onPick(api, 'data-node', (id) => act(api, c, { node: id === 'all' ? '' : id }));
      api.tools({
        table: () => ({
          title: 'Matriks kategori', subtitle: `${c.where}, ${fmt.month(c.sel.bulan)}`,
          columns: ['Kategori', ...PORTFOLIO_NODES.map((n) => n.label)],
          rows: c.L.order.map((label) => [label, ...PORTFOLIO_NODES.map((n) => c.valueText(c.get(n.id, label)))]),
        }),
      });
    },
  }),

  ro: () => ({
    title: 'Kualitas per RO', desc: 'Lancar, SML, NPL segmen terpilih per Regional Office',
    icon: 'bars-horizontal', w: 6, h: 6, minW: 4, minH: 4,
    render(api) {
      const c = P(api);
      const rows = c.all.filter((r) => matches(r, c.node.filter));
      const ros = uniq(rows.map((r) => r.ro)).filter(Boolean);
      const sumOf = (ro, label) => rows.filter((r) => r.ro === ro && r.kat === label).reduce((s, r) => s + r.v, 0);
      const data = ros.map((ro) => {
        const b = sumOf(ro, c.L.base); const s = sumOf(ro, c.L.sml); const n = sumOf(ro, c.L.npl);
        return { ro, b, s, n, l: Math.max(0, b - s - n) };
      }).sort((a, b) => b.b - a.b);
      if (!data.length) { api.body.innerHTML = empty('Tidak ada data segmen ini'); return; }
      api.sub(`${c.node.label}, ${fmt.month(c.sel.bulan)}. ${c.linked ? '' : 'Klik batang untuk filter RO.'}`);
      api.body.innerHTML = `${legend(api)}${chartBox(api, 'c', 'Kualitas kredit per RO')}`;
      const dim = (ro, col) => (c.sel.ro && c.sel.ro !== ro ? `${col}55` : col);
      const chart = barChart(canvasOf(api, 'c'), {
        labels: data.map((d) => shortRo(d.ro)), horizontal: true, stacked: true,
        series: [
          { label: 'Lancar', data: data.map((d) => d.l), color: C.lancar, colors: data.map((d) => dim(d.ro, C.lancar)) },
          { label: 'SML', data: data.map((d) => d.s), color: C.sml, colors: data.map((d) => dim(d.ro, C.sml)) },
          { label: 'NPL', data: data.map((d) => d.n), color: C.npl, colors: data.map((d) => dim(d.ro, C.npl)) },
        ],
        format: (v) => c.valueText(v), sort: false, title: (p) => {
          const d = data[p[0].dataIndex];
          return `${d.ro}: NPL ${fmt.pct(ratio(d.n, d.b))}`;
        },
        footer: { label: 'Total', value: (pts) => c.valueText(pts.reduce((t, p) => t + (p.parsed.x || 0), 0)) },
        onClick: (i) => act(api, c, { ro: c.sel.ro === data[i].ro ? '' : data[i].ro, kanca: '' }),
      });
      bindLegend(legendOf(api), chart, { shape: 'box' });
      api.tools({
        png: api.cid('c'),
        table: () => ({
          title: `Kualitas ${c.node.label} per RO`, columns: ['RO', c.word, 'SML', 'NPL', '%SML', '%NPL'],
          rows: data.map((d) => [d.ro, c.valueText(d.b), c.valueText(d.s), c.valueText(d.n), fmt.pct(ratio(d.s, d.b)), fmt.pct(ratio(d.n, d.b))]),
        }),
      });
    },
  }),

  map: () => {
    const state = { metric: 'npl', prov: '' };
    return {
      title: 'Peta Indonesia per provinsi', desc: 'Peta panas provinsi dari data kantor cabang: OS, %NPL, atau %SML segmen terpilih',
      icon: 'map', w: 12, h: 9, minW: 6, minH: 6, fit: true,
      render(api) {
        const c = P(api);
        const metrics = [
          { id: 'npl', label: '%NPL', calc: (t) => ratio(t.n, t.b), format: (v) => fmt.pct(v, 2), note: `NPL ÷ ${c.word}` },
          { id: 'sml', label: '%SML', calc: (t) => ratio(t.s, t.b), format: (v) => fmt.pct(v, 2), note: `SML ÷ ${c.word}` },
          { id: 'os', label: c.word, calc: (t) => t.b, format: (v) => c.valueText(v), note: c.word === 'OS' ? 'Outstanding' : 'Jumlah debitur' },
        ];
        api.sub(`${c.node.label}, ${c.sel.ro || 'Nasional'}, ${fmt.month(c.sel.bulan)}. Klik provinsi untuk detail per region atau pulau beserta kantor cabangnya.`);
        renderBranchMap(api, {
          state, metrics, scope: `segmen ${c.node.label}`, selKanca: c.sel.kanca,
          collect: () => {
            const g = new Map();
            for (const r of c.all) {
              if (!r.kanca || (c.sel.ro && r.ro !== c.sel.ro) || !matches(r, c.node.filter)) continue;
              const o = g.get(r.kanca) || { ro: r.ro, sums: { b: 0, s: 0, n: 0 } };
              if (r.kat === c.L.base) o.sums.b += r.v;
              if (r.kat === c.L.sml) o.sums.s += r.v;
              if (r.kat === c.L.npl) o.sums.n += r.v;
              g.set(r.kanca, o);
            }
            return g;
          },
          onKanca: (k) => act(api, c, { kanca: c.sel.kanca === k ? '' : k }),
        });
      },
    };
  },

  topNpl: () => ({
    title: 'Kantor cabang %NPL tertinggi', desc: 'Sepuluh kantor cabang dengan %NPL tertinggi di segmen terpilih',
    icon: 'alert', w: 6, h: 6, minW: 4, minH: 4,
    render(api) {
      const c = P(api);
      const rows = c.all.filter((r) => (!c.sel.ro || r.ro === c.sel.ro) && matches(r, c.node.filter));
      const g = new Map();
      for (const r of rows) {
        if (!r.kanca) continue;
        const o = g.get(r.kanca) || { b: 0, n: 0, ro: r.ro };
        if (r.kat === c.L.base) o.b += r.v;
        if (r.kat === c.L.npl) o.n += r.v;
        g.set(r.kanca, o);
      }
      const total = [...g.values()].reduce((t, o) => t + o.b, 0);
      const list = [...g.entries()].filter(([, o]) => o.b >= total * 0.005)
        .map(([k, o]) => ({ k, ...o, p: ratio(o.n, o.b) })).filter((x) => ok(x.p)).sort((a, b) => b.p - a.p);
      api.sub(`${c.node.label}, ${c.sel.ro || 'Nasional'}, ${fmt.month(c.sel.bulan)}. Porsi <0,5% tidak ikut. ${c.linked ? '' : 'Klik untuk filter.'}`);
      api.body.innerHTML = `<div class="scroll">${rankList(list.slice(0, 10).map((x) => ({
        key: x.k, label: x.k, value: x.p, active: c.sel.kanca === x.k, color: C.npl,
        sub: `${esc(shortRo(x.ro))}, NPL ${esc(c.valueText(x.n))} dari ${esc(c.valueText(x.b))}`,
      })), { format: (v) => fmt.pct(v, 2), max: list[0]?.p, empty: 'Tidak ada kantor cabang' })}</div>`;
      onPick(api, 'data-pick', (k) => act(api, c, { kanca: c.sel.kanca === k ? '' : k }));
      api.tools({
        table: () => ({
          title: 'Kantor cabang menurut %NPL', subtitle: c.node.label, columns: ['Kantor cabang', 'RO', c.word, 'NPL', '%NPL'],
          rows: list.map((x) => [x.k, x.ro, c.valueText(x.b), c.valueText(x.n), fmt.pct(x.p)]),
        }),
      });
    },
  }),

  fi: () => ({
    title: 'FI dan NFI', desc: 'Perbandingan jenis pendapatan FI dan NFI: porsi, %SML, %NPL',
    icon: 'bars', w: 6, h: 6, minW: 4, minH: 4,
    render(api) {
      const c = P(api);
      const id = c.node.id;
      const L = c.L;
      if (!L.fi || !L.nfi) { api.body.innerHTML = empty('Kategori FI/NFI tidak ada di data'); return; }
      const fi = c.get(id, L.fi); const nfi = c.get(id, L.nfi);
      const v = {
        sml: [ratio(c.get(id, L.smlFi), fi), ratio(c.get(id, L.smlNfi), nfi)],
        npl: [ratio(c.get(id, L.nplFi), fi), ratio(c.get(id, L.nplNfi), nfi)],
      };
      api.sub(`${c.node.label}, ${fmt.month(c.sel.bulan)}`);
      api.body.innerHTML = `${stats([
        { label: 'Porsi FI', value: fmt.pct(ratio(fi, fi + nfi), 1) },
        { label: `${c.word} FI`, value: c.valueText(fi) },
        { label: `${c.word} NFI`, value: c.valueText(nfi) },
      ])}${legend(api)}${chartBox(api, 'c', 'Persentase SML dan NPL untuk FI dan NFI')}`;
      const chart = barChart(canvasOf(api, 'c'), {
        labels: ['FI', 'NFI'],
        series: [{ label: '%SML', data: v.sml, color: C.sml }, { label: '%NPL', data: v.npl, color: C.npl }],
        format: (x) => fmt.pct(x), tickFormat: (x) => fmt.pct(x, 1), valueLabels: true, labelFormat: (x) => fmt.pct(x, 2), sort: false,
      });
      bindLegend(legendOf(api), chart, { shape: 'box' });
      api.tools({ png: api.cid('c') });
    },
  }),
};

export default {
  id: 'portofolio', title: 'Portofolio', icon: 'layers',
  load: loadPf,
  prepare: preparePf,
  normalize(p, m) {
    return {
      bulan: m.index.months.includes(p.bulan) ? p.bulan : m.index.months.at(-1),
      ro: p.ro || '', kanca: p.kanca || '',
      ukuran: p.ukuran === 'deb' && m.index.kategori.deb ? 'deb' : 'os',
      node: NODE[p.node] ? p.node : 'all',
    };
  },
  context(m, sel) {
    const monthRows = m.monthData.get(sel.bulan) || [];
    const ros = uniq(monthRows.map((r) => r.ro)).filter(Boolean).sort(byText);
    if (sel.ro && !ros.includes(sel.ro)) sel.ro = '';
    const kancas = uniq(monthRows.filter((r) => !sel.ro || r.ro === sel.ro).map((r) => r.kanca)).filter(Boolean).sort(byText);
    if (sel.kanca && !kancas.includes(sel.kanca)) sel.kanca = '';
    return { ...pfContext(m, sel), ros, kancas, view: 'portofolio' };
  },
  subtitle(c) {
    return `${c.where}, posisi ${fmt.month(c.sel.bulan)}. Segmen terpilih: ${c.node.label}`;
  },
  filters(c) {
    const { model: m, sel } = c;
    const latest = sel.bulan === m.index.months.at(-1);
    const dirty = sel.ro || sel.kanca || !latest || sel.ukuran !== 'os' || sel.node !== 'all';
    const uk = [{ value: 'os', label: 'OS' }];
    if (m.index.kategori.deb) uk.push({ value: 'deb', label: 'Debitur' });
    return `${pick({ id: 'f-ro', label: 'Regional Office', value: sel.ro, on: !!sel.ro, options: [{ value: '', label: 'Nasional' }, ...c.ros.map((r) => ({ value: r, label: r }))] })}
      ${searchPick({ id: 'f-kanca', label: 'Kantor cabang', value: sel.kanca, allLabel: 'Semua' })}
      ${pick({ id: 'f-bulan', label: 'Bulan', value: sel.bulan, on: !latest, options: [...m.index.months].reverse().map((x) => ({ value: x, label: fmt.month(x) })) })}
      ${pick({ id: 'f-node', label: 'Segmen', value: sel.node, on: sel.node !== 'all', options: PORTFOLIO_NODES.map((n) => ({ value: n.id, label: n.label })) })}
      ${seg({ name: 'f-ukuran', label: 'Ukuran', value: sel.ukuran, options: uk, small: true })}
      ${dirty ? '<button class="reset" type="button" data-reset>Reset filter</button>' : ''}`;
  },
  bindFilters(root, c, set) {
    root.querySelector('#f-ro').addEventListener('change', (e) => set({ ro: e.target.value, kanca: '' }));
    root.querySelector('#f-bulan').addEventListener('change', (e) => set({ bulan: e.target.value }));
    root.querySelector('#f-node').addEventListener('change', (e) => set({ node: e.target.value === 'all' ? '' : e.target.value }));
    bindSearchPick({ id: 'f-kanca', options: c.kancas, value: c.sel.kanca, allLabel: 'Semua', onChange: (v) => set({ kanca: v }) });
    onSeg(root, 'f-ukuran', (v) => set({ ukuran: v === 'os' ? '' : v }));
    root.querySelector('[data-reset]')?.addEventListener('click', () => set({ ro: '', kanca: '', bulan: '', ukuran: '', node: '' }));
  },
  widgets: {
    seg: pfWidgets.seg(),
    tree: pfWidgets.tree(),
    quality: pfWidgets.quality(),
    ks: pfWidgets.split('ks'),
    tier: pfWidgets.split('tier'),
    trend: pfWidgets.trend(),
    qtrend: pfWidgets.qtrend(),
    matrix: pfWidgets.matrix(),
    ro: pfWidgets.ro(),
    'top-npl': pfWidgets.topNpl(),
    fi: pfWidgets.fi(),
    map: pfWidgets.map(),
    analysis: analysisWidget((c) => ({ data: { pf: c.model }, scope: { ro: c.sel.ro, kanca: c.sel.kanca, bulan: c.sel.bulan }, sources: ['portofolio'] })),
  },
  layout: [
    { id: 'seg', x: 0, y: 0, w: 12, h: 3 },
    { id: 'tree', x: 0, y: 3, w: 12, h: 11 },
    { id: 'trend', x: 0, y: 14, w: 6, h: 6 },
    { id: 'qtrend', x: 6, y: 14, w: 6, h: 6 },
    { id: 'map', x: 0, y: 20, w: 12, h: 9 },
    { id: 'ro', x: 0, y: 29, w: 6, h: 6 },
    { id: 'top-npl', x: 6, y: 29, w: 6, h: 6 },
    { id: 'analysis', x: 0, y: 35, w: 12, h: 8 },
  ],
};
