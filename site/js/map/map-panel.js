import { fmt, esc } from '../core/format.js';
import { seg, onSeg } from '../core/controls.js';
import { mapSvg, bindMap, mapClasses, MAP_RAMP, provinceName } from './indonesia-map.js';
import { kancaProvince, kancaLabel } from './branch-locations.js';
import { METRO_NAME, metroArea, metroAreaOf } from './metro-areas.js';
import { metroGrid, bindMetro } from './metro-map.js';
import { openMapPopout } from './map-popout.js';

export function renderMapPanel(api, spec) {
  if (!spec.state.view) spec.state.view = 'nasional';
  const isMetro = () => !!spec.metro && spec.state.view === 'metro';
  const draw = () => {
    const metroView = isMetro();
    const d = metroView ? spec.metro(spec.state.metric) : spec.build(spec.state.metric);
    const vals = metroView
      ? [...d.tiles.values()].flatMap((t) => [t.value, t.split?.value])
      : [...d.provinces.values()].map((x) => x.value);
    const classes = mapClasses(vals);
    const views = spec.metro
      ? seg({ name: api.cid('view'), label: 'Cakupan peta', small: true, value: spec.state.view,
        options: [{ value: 'nasional', label: 'Indonesia' }, { value: 'metro', label: METRO_NAME }] })
      : '';
    const metrics = spec.metrics.length > 1
      ? seg({ name: api.cid('metric'), label: 'Ukuran peta', small: true, options: spec.metrics.map((m) => ({ value: m.id, label: m.label })), value: spec.state.metric })
      : '';
    const key = classes ? MAP_RAMP.map((c, i) => `<span><i style="background:${c}"></i>${esc(d.format(classes.bounds[i][0]))}${i === MAP_RAMP.length - 1 ? `–${esc(d.format(classes.hi))}` : ''}</span>`).join('') : '';
    const canvas = metroView
      ? metroGrid({ tiles: d.tiles, classes, selected: d.selected, aria: d.aria })
      : mapSvg({ provinces: d.provinces, classes, labels: d.labels.map((l) => ({ ...l, text: d.format(l.value), cls: classes ? classes.classOf(l.value) : 0, swatch: l.own === false && classes && Number.isFinite(l.value) ? MAP_RAMP[classes.classOf(l.value)] : '' })), selected: d.selected, aria: d.aria });
    const items = d.list.items;
    api.body.innerHTML = `<div class="map-top">${views}${metrics}${d.note ? `<span class="map-note">${esc(d.note)}</span>` : ''}</div>
      <div class="map-wrap">
        <div class="map-main">
          <div class="map-canvas${metroView ? ' is-metro' : ''}">${canvas}<div class="map-tip" role="status" hidden></div></div>
          <div class="map-key" aria-label="Legenda warna">${key}<span class="no-data"><i></i>${metroView ? 'Tanpa kanca' : 'Tanpa data'}</span>${d.split ? '<span class="split-key"><i></i>Dua warna: dilayani lebih dari satu RO</span>' : ''}<span class="map-hint">Makin gelap makin tinggi</span></div>
        </div>
        <aside class="map-side">
          <div class="map-side-h">${d.list.back ? `<button type="button" class="link" data-map-back>${esc(d.list.back)}</button>` : ''}<h3>${esc(d.list.title)}</h3></div>
          <ol class="map-list">${items.length ? items.map((x, i) => `<li><button type="button" data-map-item="${esc(x.key)}"${x.active ? ' aria-pressed="true"' : ''}>
            <span class="map-item-rank">${i + 1}</span><span class="map-item-text"><span>${esc(x.label)}</span>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</span>
            <b>${esc(d.format(x.value))}</b></button></li>`).join('') : '<li class="map-empty">Belum ada data</li>'}</ol>
        </aside>
      </div>`;
    if (views) onSeg(api.body, api.cid('view'), (v) => { spec.state.view = v; draw(); });
    if (metrics) onSeg(api.body, api.cid('metric'), (v) => { spec.state.metric = v; draw(); });
    const canvasEl = api.body.querySelector('.map-canvas');
    if (metroView) {
      bindMetro(canvasEl, { tipOf: (id) => d.tiles.get(id)?.tip || '', onPick: (id) => spec.onArea(id, draw) });
    } else {
      bindMap(canvasEl, {
        tipOf: (id, name) => d.provinces.get(id)?.tip || `<b>${esc(name)}</b><span>${esc(d.emptyTip || 'Belum ada data untuk provinsi ini')}</span>`,
        onPick: (id) => spec.onProv(id, draw),
      });
    }
    api.body.querySelectorAll('[data-map-item]').forEach((b) => b.addEventListener('click', () => spec.onItem(b.dataset.mapItem, draw, metroView)));
    api.body.querySelector('[data-map-back]')?.addEventListener('click', () => spec.onBack?.(draw, metroView));
    return d;
  };
  const d = draw();
  api.tools({
    table: () => {
      const label = spec.metrics.find((m) => m.id === spec.state.metric)?.label || '';
      if (isMetro()) {
        const cur = spec.metro(spec.state.metric);
        return {
          title: `Peta ${METRO_NAME}`, subtitle: label, columns: ['Wilayah', 'Regional Office', label],
          rows: [...cur.tiles.entries()].sort((a, b) => (b[1].value ?? -Infinity) - (a[1].value ?? -Infinity))
            .map(([id, t]) => [metroArea(id)?.name || id, t.roText || '', cur.format(t.value)]),
        };
      }
      const cur = spec.build(spec.state.metric);
      return {
        title: 'Peta Indonesia', subtitle: label, columns: ['Provinsi', label],
        rows: [...cur.provinces.entries()].sort((a, b) => (b[1].value ?? -Infinity) - (a[1].value ?? -Infinity))
          .map(([id, x]) => [provinceName(id), cur.format(x.value)]),
      };
    },
  });
  return d;
}

export function nameList(names, max = 2) {
  const m = names.map((n) => /^(.*\S)\s+(\d+)$/.exec(n));
  if (names.length > 1 && m.every((x) => x && x[1] === m[0][1])) return `${m[0][1]} ${m.map((x) => x[2]).join(', ')}`;
  return names.length <= max ? names.join(', ') : `${names.slice(0, max).join(', ')}, +${names.length - max}`;
}

export const pctFmt = (d = 1) => (v) => fmt.pct(v, d);

const shortRoName = (ro) => String(ro || '').replace(/^.*\/\s*/, '').replace(/^RO\s+/i, '').trim();

export function renderBranchMap(api, opts) {
  const byKanca = opts.collect();
  const provOf = new Map([...byKanca.keys()].map((k) => [k, kancaProvince(k)]));
  const areaOf = new Map([...byKanca.keys()].map((k) => [k, provOf.get(k) ? metroAreaOf(k, provOf.get(k)) : '']));
  const add = (a, b) => { for (const [k, v] of Object.entries(b)) a[k] = (a[k] || 0) + (Number.isFinite(v) ? v : 0); return a; };
  const byProv = new Map();
  const byArea = new Map();
  for (const [k, x] of byKanca) {
    const p = provOf.get(k);
    if (!p) continue;
    const o = byProv.get(p) || { sums: {}, kanca: [] };
    add(o.sums, x.sums);
    o.kanca.push(k);
    byProv.set(p, o);
    const a = areaOf.get(k);
    if (!a) continue;
    const t = byArea.get(a) || { sums: {}, kanca: [], ros: new Map() };
    add(t.sums, x.sums);
    t.kanca.push(k);
    if (x.ro) t.ros.set(x.ro, (t.ros.get(x.ro) || 0) + 1);
    byArea.set(a, t);
  }
  if (opts.state.prov && !byProv.has(opts.state.prov)) opts.state.prov = '';
  if (opts.state.area && !byArea.has(opts.state.area)) opts.state.area = '';
  if (!byArea.size) opts.state.view = 'nasional';
  const selProv = opts.selKanca ? provOf.get(opts.selKanca) : '';
  const selArea = opts.selKanca ? areaOf.get(opts.selKanca) : '';
  const kancaItems = (list, m) => list.map((k) => ({ key: k, label: kancaLabel(k), value: m.calc(byKanca.get(k).sums), sub: shortRoName(byKanca.get(k).ro), active: opts.selKanca === k }))
    .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
  const metricOf = (mid) => opts.metrics.find((x) => x.id === mid) || opts.metrics[0];
  const popout = ({ prov, ro = '' }) => openMapPopout({
    kancas: [...byKanca.entries()].filter(([k]) => provOf.get(k)).map(([k, x]) => ({ key: k, label: kancaLabel(k), ro: x.ro, prov: provOf.get(k), sums: x.sums })),
    metrics: opts.metrics, metric: opts.state.metric, mode: 'region', prov, ro, note: opts.scope ? `Data ${opts.scope}.` : '',
    onKanca: (k) => opts.onKanca(k), kancaHint: 'Klik nama kantor cabang untuk memfilter dashboard.',
  });
  return renderMapPanel(api, {
    state: opts.state,
    metrics: opts.metrics,
    build: (mid) => {
      const m = metricOf(mid);
      const provinces = new Map();
      for (const [p, o] of byProv) {
        const v = m.calc(o.sums);
        provinces.set(p, { value: v, tip: `<b>${esc(provinceName(p))}</b><span>${o.kanca.length} kantor cabang</span><em>${esc(m.label)} ${esc(m.format(v))}</em>` });
      }
      const ranked = [...provinces.entries()].filter(([, x]) => Number.isFinite(x.value)).sort((a, b) => b[1].value - a[1].value);
      const show = new Set(ranked.slice(0, 7).map(([p]) => p));
      if (opts.state.prov) show.add(opts.state.prov);
      const labels = [...show].map((p) => ({ prov: [p], name: provinceName(p), value: provinces.get(p).value }));
      const p = opts.state.prov;
      const list = p
        ? { title: `Kantor cabang di ${provinceName(p)}`, back: '← Semua provinsi', items: kancaItems(byProv.get(p).kanca, m) }
        : { title: `Peringkat provinsi, ${m.label}`,
          items: ranked.map(([id, x]) => ({ key: id, label: provinceName(id), value: x.value, sub: `${byProv.get(id).kanca.length} kantor cabang`, active: id === selProv })) };
      return {
        provinces, labels, format: m.format, note: m.note, list,
        selected: new Set([p || selProv].filter(Boolean)),
        aria: `Peta Indonesia, ${m.label} per provinsi ${opts.scope || ''}. Peringkat lengkap ada di daftar di samping peta.`,
      };
    },
    metro: byArea.size ? (mid) => {
      const m = metricOf(mid);
      const tiles = new Map();
      for (const [id, o] of byArea) {
        const v = m.calc(o.sums);
        const ros = [...o.ros.entries()].sort((a, b) => b[1] - a[1]);
        const roText = ros.map(([ro, n]) => `${shortRoName(ro)} (${n})`).join(', ');
        const name = metroArea(id).name;
        tiles.set(id, {
          value: v, owner: ros[0]?.[0] || '', sub: m.format(v), roText,
          tip: `<b>${esc(name)}</b><span>${o.kanca.length} kantor cabang: ${esc(roText)}</span><em>${esc(m.label)} ${esc(m.format(v))}</em>`,
          aria: `${name}, ${m.label} ${m.format(v)}, ${o.kanca.length} kantor cabang, ${roText}`,
        });
      }
      const a = opts.state.area;
      const list = a
        ? { title: `Kantor cabang di ${metroArea(a).name}`, back: `← Semua wilayah ${METRO_NAME}`, items: kancaItems(byArea.get(a).kanca, m) }
        : { title: `Peringkat wilayah, ${m.label}`,
          items: [...tiles.entries()].map(([id, t]) => ({ key: id, label: metroArea(id).name, value: t.value, sub: `${byArea.get(id).kanca.length} kanca, ${t.roText}`, active: id === selArea }))
            .sort((x, y) => (y.value ?? -Infinity) - (x.value ?? -Infinity)) };
      return {
        tiles, list, format: m.format, note: 'Wilayah RO mengikuti kantor cabangnya',
        selected: new Set([a || selArea].filter(Boolean)),
        aria: `Peta ${METRO_NAME}, ${m.label} per wilayah kota ${opts.scope || ''}. Garis tebal memisahkan wilayah Regional Office.`,
      };
    } : null,
    onProv: (id) => { if (byProv.has(id)) popout({ prov: id }); },
    onArea: (id) => {
      const t = byArea.get(id);
      if (!t) return;
      const ro = [...t.ros.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      popout({ prov: metroArea(id).prov, ro });
    },
    onItem: (key, redraw, metroView) => {
      const level = metroView ? 'area' : 'prov';
      if (opts.state[level]) { opts.onKanca(key); return; }
      opts.state[level] = key;
      redraw();
    },
    onBack: (redraw, metroView) => { opts.state[metroView ? 'area' : 'prov'] = ''; redraw(); },
  });
}
