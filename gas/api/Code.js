var VIEWS = ['ringkasan', 'performance', 'portofolio', 'realisasi', 'sla'];
var ACTIONS = ['boot', 'bundle', 'saveLayout', 'version'];
var PATH_RE = /^(meta|perf_daily|perf_kuadran|portfolio_index|portfolio_trend|realisasi_daily|dim_kanca|sla|sla_daily)\.json$|^portfolio\/\d{4}-\d{2}\.json$/;
var LAYOUT_ID_RE = /^[a-z][a-z0-9-]{0,39}$/;
var GUARD = {
  bodyChars: 24000,
  tokenChars: 4096,
  layoutChars: 8000,
  layoutItems: 40,
  bundlePaths: 24,
  failWindowSec: 600,
  failMax: 50,
  rejectedTokenSec: 900,
  userWindowSec: 60,
  userMax: 90,
};
var REJECTED_TOKEN = '!';

function doGet() {
  return ContentService.createTextOutput('KPR API aktif. Alamat ini hanya melayani dashboard yang sudah login.');
}

function doPost(e) {
  var out;
  var email = null;
  try {
    var req = parseRequest_(e);
    email = authorize_(req.token);
    throttleUser_(email);
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

function parseRequest_(e) {
  var raw = e && e.postData && typeof e.postData.contents === 'string' ? e.postData.contents : '';
  if (!raw || raw.length > GUARD.bodyChars) throw AuthFail_('BAD');
  var req;
  try { req = JSON.parse(raw); } catch (err) { throw AuthFail_('BAD'); }
  if (!req || typeof req !== 'object' || Array.isArray(req) || ACTIONS.indexOf(req.action) < 0) throw AuthFail_('BAD');
  return req;
}

function tokenKey_(token) {
  return 'tok_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token, Utilities.Charset.UTF_8));
}

function windowKey_(prefix, seconds) {
  return prefix + Math.floor(Date.now() / 1000 / seconds);
}

function bump_(cache, key, ttl) {
  var n = Number(cache.get(key)) || 0;
  cache.put(key, String(n + 1), ttl);
  return n + 1;
}

function authorize_(token) {
  var p = props_();
  var clientId = p.getProperty('CLIENT_ID');
  if (!clientId) throw new Error('Script Property CLIENT_ID belum diisi.');
  if (typeof token !== 'string' || !token || token.length > GUARD.tokenChars) throw AuthFail_('AUTH');
  var cache = CacheService.getScriptCache();
  var key = tokenKey_(token);
  var email = cache.get(key);
  if (email === REJECTED_TOKEN) throw AuthFail_('AUTH');
  var fresh = !email;
  if (fresh) {
    var failKey = windowKey_('fail_', GUARD.failWindowSec);
    if ((Number(cache.get(failKey)) || 0) >= GUARD.failMax) {
      console.warn('Login baru ditahan sementara: terlalu banyak token gagal.');
      throw AuthFail_('BUSY');
    }
    var v;
    try {
      v = verifyIdToken_(token, clientId);
    } catch (err) {
      if (err && err.code === 'AUTH') {
        cache.put(key, REJECTED_TOKEN, GUARD.rejectedTokenSec);
        var fails = bump_(cache, failKey, GUARD.failWindowSec * 2);
        if (fails === 1 || fails % 10 === 0) console.warn('Token login ditolak (' + fails + ' kali dalam ' + GUARD.failWindowSec / 60 + ' menit).');
      }
      throw err;
    }
    email = v.email;
    var ttl = Math.min(3600, v.exp - Math.floor(Date.now() / 1000));
    if (ttl > 5) cache.put(key, email, ttl);
  }
  if (!isAllowed_(email, p.getProperty('ALLOWED_EMAILS') || '')) {
    console.warn('Akses ditolak: ' + email);
    throw AuthFail_('DENIED', email);
  }
  if (fresh) console.info('Login: ' + email);
  return email;
}

function throttleUser_(email) {
  var cache = CacheService.getScriptCache();
  var n = bump_(cache, windowKey_('rate_' + email + '_', GUARD.userWindowSec), GUARD.userWindowSec * 2);
  if (n > GUARD.userMax) {
    if (n === GUARD.userMax + 1) console.warn('Permintaan terlalu sering: ' + email);
    throw AuthFail_('BUSY');
  }
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
    if (!Array.isArray(paths) || !paths.length || paths.length > GUARD.bundlePaths) throw AuthFail_('BAD');
    paths.forEach(function (x) { if (typeof x !== 'string' || !PATH_RE.test(x)) throw AuthFail_('BAD'); });
    return readData_(paths);
  }
  if (req.action === 'saveLayout') return saveLayout_(email, req.view, req.text);
  return version_();
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
    if (Object.prototype.hasOwnProperty.call(want, r[0])) want[r[0]].push([Number(r[1]), String(r[2]), String(r[3])]);
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

function cleanLayout_(text) {
  var parsed;
  try { parsed = JSON.parse(text); } catch (err) { return null; }
  if (!parsed || typeof parsed.v !== 'number' || !Array.isArray(parsed.items) || parsed.items.length > GUARD.layoutItems) return null;
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

function saveLayout_(email, view, text) {
  if (VIEWS.indexOf(view) < 0) throw AuthFail_('BAD');
  if (typeof text !== 'string' || text.length > GUARD.layoutChars) throw AuthFail_('BAD');
  var p = props_();
  if (!text) { p.deleteProperty(layoutKey_(email, view)); return true; }
  var clean = cleanLayout_(text);
  if (!clean) throw AuthFail_('BAD');
  p.setProperty(layoutKey_(email, view), clean);
  return true;
}
