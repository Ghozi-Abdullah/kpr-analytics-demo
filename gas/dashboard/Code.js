var VIEWS = ['ringkasan', 'performance', 'portofolio', 'realisasi', 'sla'];
var PATH_RE = /^(meta|perf_daily|perf_kuadran|portfolio_index|portfolio_trend|realisasi_daily|dim_kanca|sla|sla_daily)\.json$|^portfolio\/\d{4}-\d{2}\.json$/;
var LAYOUT_ID_RE = /^[a-z][a-z0-9-]{0,39}$/;

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('KPR Analytics')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

function agg_() {
  var id = PropertiesService.getScriptProperties().getProperty('AGG_ID');
  if (!id) throw new Error('BELUM_DISETEL');
  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    throw new Error('AKSES_DITOLAK');
  }
}

function readData_(paths) {
  var sh = agg_().getSheetByName('data');
  if (!sh) throw new Error('DATA_KOSONG');
  var values = sh.getDataRange().getValues();
  var want = {};
  paths.forEach(function (p) { want[p] = []; });
  for (var i = 1; i < values.length; i += 1) {
    var r = values[i];
    if (Object.prototype.hasOwnProperty.call(want, r[0])) want[r[0]].push([Number(r[1]), String(r[2]), String(r[3])]);
  }
  var out = {};
  Object.keys(want).forEach(function (p) {
    var parts = want[p];
    if (!parts.length) return;
    parts.sort(function (a, b) { return a[0] - b[0]; });
    out[p] = { enc: parts[0][1], data: parts.map(function (x) { return x[2].replace(/^b:/, ''); }).join('') };
  });
  return out;
}

function layouts_() {
  var all = PropertiesService.getUserProperties().getProperties();
  var out = {};
  VIEWS.forEach(function (v) { if (all['layout.' + v]) out[v] = all['layout.' + v]; });
  return out;
}

function getBoot() {
  var data = readData_(['meta.json']);
  if (!data['meta.json']) throw new Error('DATA_KOSONG');
  return { email: Session.getActiveUser().getEmail(), meta: data['meta.json'], layouts: layouts_() };
}

function getBundle(paths) {
  if (!Array.isArray(paths) || !paths.length || paths.length > 24) throw new Error('Permintaan data tidak valid.');
  paths.forEach(function (p) { if (typeof p !== 'string' || !PATH_RE.test(p)) throw new Error('Nama data tidak dikenal.'); });
  return readData_(paths);
}

function saveLayout(view, text) {
  if (VIEWS.indexOf(view) < 0) throw new Error('Halaman tidak dikenal.');
  if (typeof text !== 'string' || text.length > 8000) throw new Error('Tata letak terlalu besar.');
  agg_();
  var props = PropertiesService.getUserProperties();
  if (!text) { props.deleteProperty('layout.' + view); return true; }
  var clean = cleanLayout_(text);
  if (!clean) throw new Error('Format tata letak tidak valid.');
  props.setProperty('layout.' + view, clean);
  return true;
}

function cleanLayout_(text) {
  var parsed;
  try { parsed = JSON.parse(text); } catch (err) { return null; }
  if (!parsed || typeof parsed.v !== 'number' || !Array.isArray(parsed.items) || parsed.items.length > 40) return null;
  var items = [];
  for (var i = 0; i < parsed.items.length; i += 1) {
    var it = parsed.items[i];
    if (!it || typeof it.id !== 'string' || !LAYOUT_ID_RE.test(it.id)) return null;
    var cell = { id: it.id };
    var keys = ['x', 'y', 'w', 'h'];
    for (var k = 0; k < keys.length; k += 1) {
      var n = it[keys[k]];
      if (typeof n !== 'number' || n % 1 !== 0 || n < 0 || n > 400) return null;
      cell[keys[k]] = n;
    }
    items.push(cell);
  }
  return JSON.stringify({ v: parsed.v, items: items });
}

function getVersion() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('agg_version');
  if (hit) return JSON.parse(hit);
  var sh = agg_().getSheetByName('info');
  var info = {};
  if (sh && sh.getLastRow() >= 2) sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) { info[String(r[0])] = String(r[1]); });
  var out = { version: info.versi || '', status: info.status || '' };
  cache.put('agg_version', JSON.stringify(out), 30);
  return out;
}
