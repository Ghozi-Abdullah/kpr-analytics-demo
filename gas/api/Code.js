var VIEWS = ['ringkasan', 'performance', 'portofolio', 'realisasi'];
var PATH_RE = /^(meta|perf_daily|perf_kuadran|portfolio_index|portfolio_trend|realisasi_daily|dim_kanca|sla|sla_daily)\.json$|^portfolio\/\d{4}-\d{2}\.json$/;

function doGet() {
  return ContentService.createTextOutput('KPR API aktif. Alamat ini hanya melayani dashboard yang sudah login.');
}

function doPost(e) {
  var out;
  var email = null;
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    email = authorize_(req.token);
    out = { ok: true, data: handle_(req, email) };
  } catch (err) {
    var code = err && err.code ? err.code : null;
    out = { ok: false, error: code || 'ERROR' };
    if (code === 'DENIED') out.email = err.email;
    if (!code && email) out.message = String(err && err.message ? err.message : err);
    if (!code) console.error(err);
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function props_() { return PropertiesService.getScriptProperties(); }

function authorize_(token) {
  var p = props_();
  var clientId = p.getProperty('CLIENT_ID');
  if (!clientId) throw new Error('Script Property CLIENT_ID belum diisi.');
  if (typeof token !== 'string' || !token) throw AuthFail_('AUTH');
  var cache = CacheService.getScriptCache();
  var key = 'tok_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token, Utilities.Charset.UTF_8));
  var email = cache.get(key);
  if (!email) {
    var v = verifyIdToken_(token, clientId);
    email = v.email;
    var ttl = Math.min(3600, v.exp - Math.floor(Date.now() / 1000));
    if (ttl > 5) cache.put(key, email, ttl);
  }
  if (!isAllowed_(email, p.getProperty('ALLOWED_EMAILS') || '')) throw AuthFail_('DENIED', email);
  return email;
}

function isAllowed_(email, list) {
  var e = String(email).toLowerCase();
  return list.split(/[\s,;]+/).map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean).some(function (x) {
    return x.charAt(0) === '@' ? e.slice(-x.length) === x : e === x;
  });
}

function handle_(req, email) {
  if (req.action === 'boot') {
    var data = readData_(['meta.json']);
    if (!data['meta.json']) throw new Error('DATA_KOSONG');
    return { email: email, meta: data['meta.json'], layouts: layouts_(email) };
  }
  if (req.action === 'bundle') {
    var paths = req.paths;
    if (!Array.isArray(paths) || !paths.length || paths.length > 24) throw new Error('Permintaan data tidak valid.');
    paths.forEach(function (x) { if (typeof x !== 'string' || !PATH_RE.test(x)) throw new Error('Nama data tidak dikenal.'); });
    return readData_(paths);
  }
  if (req.action === 'saveLayout') return saveLayout_(email, req.view, req.text);
  if (req.action === 'version') return version_();
  throw new Error('Aksi tidak dikenal.');
}

function agg_() {
  var id = props_().getProperty('AGG_ID');
  if (!id) throw new Error('BELUM_DISETEL');
  return SpreadsheetApp.openById(id);
}

function readData_(paths) {
  var sh = agg_().getSheetByName('data');
  if (!sh) throw new Error('DATA_KOSONG');
  var values = sh.getDataRange().getValues();
  var want = {};
  paths.forEach(function (x) { want[x] = []; });
  for (var i = 1; i < values.length; i += 1) {
    var r = values[i];
    if (want[r[0]]) want[r[0]].push([Number(r[1]), String(r[2]), String(r[3])]);
  }
  var out = {};
  Object.keys(want).forEach(function (x) {
    var parts = want[x];
    if (!parts.length) return;
    parts.sort(function (a, b) { return a[0] - b[0]; });
    out[x] = { enc: parts[0][1], data: parts.map(function (y) { return y[2].replace(/^b:/, ''); }).join('') };
  });
  return out;
}

function version_() {
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

function layoutKey_(email, view) { return 'layout:' + email + ':' + view; }

function layouts_(email) {
  var all = props_().getProperties();
  var out = {};
  VIEWS.forEach(function (v) { if (all[layoutKey_(email, v)]) out[v] = all[layoutKey_(email, v)]; });
  return out;
}

function saveLayout_(email, view, text) {
  if (VIEWS.indexOf(view) < 0) throw new Error('Halaman tidak dikenal.');
  if (typeof text !== 'string' || text.length > 8000) throw new Error('Tata letak terlalu besar.');
  var p = props_();
  if (!text) { p.deleteProperty(layoutKey_(email, view)); return true; }
  var parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.items) || parsed.items.length > 40) throw new Error('Format tata letak tidak valid.');
  p.setProperty(layoutKey_(email, view), text);
  return true;
}
