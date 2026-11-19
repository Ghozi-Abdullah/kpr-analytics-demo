var VIEWS = ['ringkasan', 'performance', 'portofolio', 'realisasi', 'sla'];
var ACTIONS = ['boot', 'bundle', 'saveLayout', 'version', 'requestAccess', 'adminList', 'adminSave', 'adminRemove', 'adminDecide'];
var ADMIN_ACTIONS = ['adminList', 'adminSave', 'adminRemove', 'adminDecide'];
var ROLES = ['viewer', 'admin'];
var STATUSES = ['active', 'off'];
var EMAIL_RE = /^[a-z0-9._%+-]{1,64}@[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63}){1,4}$/;
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
  users: 200,
  requests: 30,
  logRows: 60,
  dataCacheSec: 21600,
};
var REJECTED_TOKEN = '!';

function doGet() {
  return ContentService.createTextOutput('KPR API aktif. Alamat ini hanya melayani dashboard yang sudah login.');
}

function doPost(e) {
  var out;
  var email = null;
  var trusted = false;
  try {
    var req = parseRequest_(e);
    var who = identify_(req.token);
    email = who.email;
    throttleUser_(email);
    if (req.action === 'requestAccess') {
      out = { ok: true, data: requestAccess_(email) };
    } else {
      var role = roleOf_(email);
      if (!role) {
        if (who.fresh) record_(email, 'ditolak');
        console.warn('Akses ditolak: ' + email);
        throw AuthFail_('DENIED', email);
      }
      trusted = true;
      if (who.fresh) { record_(email, 'masuk'); touch_(email); }
      if (ADMIN_ACTIONS.indexOf(req.action) >= 0 && role !== 'admin') throw AuthFail_('FORBIDDEN');
      out = { ok: true, data: handle_(req, email, role) };
    }
  } catch (err) {
    var code = err && err.code ? err.code : null;
    out = { ok: false, error: code || 'ERROR' };
    if (code === 'DENIED') { out.email = err.email; out.asked = !!props_().getProperty(askKey_(err.email)); }
    if (code === 'BAD' && trusted && err.note) out.message = err.note;
    if (!code && trusted) out.message = String(err && err.message ? err.message : err);
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

function identify_(token) {
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
  return { email: email, fresh: fresh };
}

function userKey_(email) { return 'user:' + email; }
function askKey_(email) { return 'ask:' + email; }

function listed_(name) {
  return (props_().getProperty(name) || '').split(/[\s,;]+/).map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);
}

function isRootAdmin_(email) { return listed_('ADMIN_EMAILS').indexOf(email) >= 0; }

function readJson_(key) {
  var raw = props_().getProperty(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (err) { return null; }
}

function roleOf_(email) {
  if (isRootAdmin_(email)) return 'admin';
  var u = readJson_(userKey_(email));
  if (u) return u.status === 'active' && ROLES.indexOf(u.role) >= 0 ? u.role : null;
  return isAllowed_(email, props_().getProperty('ALLOWED_EMAILS') || '') ? 'viewer' : null;
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  var held = lock.tryLock(3000);
  try { return fn(); } finally { if (held) lock.releaseLock(); }
}

function record_(email, event) {
  withLock_(function () {
    var rows = readJson_('log') || [];
    rows.unshift([new Date().toISOString(), email, event]);
    props_().setProperty('log', JSON.stringify(rows.slice(0, GUARD.logRows)));
  });
}

function touch_(email) {
  var u = readJson_(userKey_(email));
  if (!u) return;
  u.last = new Date().toISOString();
  props_().setProperty(userKey_(email), JSON.stringify(u));
}

function bad_(note) {
  var e = AuthFail_('BAD');
  e.note = note;
  return e;
}

function cleanEmail_(value) {
  var email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 120 || !EMAIL_RE.test(email)) throw bad_('Alamat email tidak valid.');
  return email;
}

function keysWith_(prefix) {
  return Object.keys(props_().getProperties()).filter(function (k) { return k.indexOf(prefix) === 0; });
}

function requestAccess_(email) {
  if (roleOf_(email)) return { status: 'allowed' };
  var u = readJson_(userKey_(email));
  if (u && u.status === 'off') return { status: 'off' };
  if (props_().getProperty(askKey_(email))) return { status: 'pending' };
  if (keysWith_('ask:').length >= GUARD.requests) throw AuthFail_('BUSY');
  props_().setProperty(askKey_(email), JSON.stringify({ at: new Date().toISOString() }));
  record_(email, 'minta akses');
  return { status: 'pending' };
}

function adminList_() {
  var all = props_().getProperties();
  var roots = listed_('ADMIN_EMAILS');
  var users = roots.map(function (email) { return { email: email, role: 'admin', status: 'active', fixed: true }; });
  var requests = [];
  Object.keys(all).forEach(function (k) {
    var v;
    try { v = JSON.parse(all[k]); } catch (err) { return; }
    if (k.indexOf('user:') === 0 && roots.indexOf(k.slice(5)) < 0) {
      users.push({ email: k.slice(5), role: v.role, status: v.status, added: v.added || '', by: v.by || '', last: v.last || '' });
    } else if (k.indexOf('ask:') === 0) {
      requests.push({ email: k.slice(4), at: v.at || '' });
    }
  });
  listed_('ALLOWED_EMAILS').forEach(function (x) {
    if (roots.indexOf(x) >= 0 || all[userKey_(x)]) return;
    users.push({ email: x, role: 'viewer', status: 'active', fixed: true });
  });
  requests.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
  return { users: users, requests: requests, log: readJson_('log') || [] };
}

function adminSave_(admin, req) {
  var email = cleanEmail_(req.email);
  if (ROLES.indexOf(req.role) < 0 || STATUSES.indexOf(req.status) < 0) throw bad_('Peran atau status tidak dikenal.');
  if (isRootAdmin_(email)) throw bad_('Admin utama diatur lewat Script Property ADMIN_EMAILS.');
  if (email === admin) throw bad_('Anda tidak bisa mengubah akses akun sendiri.');
  var p = props_();
  var old = readJson_(userKey_(email));
  if (!old && keysWith_('user:').length >= GUARD.users) throw bad_('Jumlah pengguna sudah mencapai batas.');
  var now = new Date().toISOString();
  p.setProperty(userKey_(email), JSON.stringify({ role: req.role, status: req.status, added: old ? old.added : now, by: old ? old.by : admin, last: old ? old.last || '' : '' }));
  p.deleteProperty(askKey_(email));
  record_(admin, (old ? 'ubah ' : 'tambah ') + email);
  return adminList_();
}

function adminRemove_(admin, req) {
  var email = cleanEmail_(req.email);
  if (isRootAdmin_(email)) throw bad_('Admin utama diatur lewat Script Property ADMIN_EMAILS.');
  if (email === admin) throw bad_('Anda tidak bisa menghapus akun sendiri.');
  var p = props_();
  p.deleteProperty(userKey_(email));
  VIEWS.forEach(function (v) { p.deleteProperty(layoutKey_(email, v)); });
  record_(admin, 'hapus ' + email);
  return adminList_();
}

function adminDecide_(admin, req) {
  var email = cleanEmail_(req.email);
  var p = props_();
  if (!p.getProperty(askKey_(email))) throw bad_('Permintaan akses sudah tidak ada.');
  if (req.approve === true) return adminSave_(admin, { email: email, role: 'viewer', status: 'active' });
  p.deleteProperty(askKey_(email));
  record_(admin, 'tolak ' + email);
  return adminList_();
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

function handle_(req, email, role) {
  if (req.action === 'boot') {
    var data = readData_(['meta.json']);
    if (!data['meta.json']) throw new Error('DATA_KOSONG');
    return { email: email, role: role, meta: data['meta.json'], layouts: layouts_(email) };
  }
  if (req.action === 'adminList') return adminList_();
  if (req.action === 'adminSave') return adminSave_(email, req);
  if (req.action === 'adminRemove') return adminRemove_(email, req);
  if (req.action === 'adminDecide') return adminDecide_(email, req);
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

var READ_ROWS = 40;

function readParts_(sh, paths) {
  var want = {};
  paths.forEach(function (x) { want[x] = []; });
  var last = sh.getLastRow();
  if (last < 2) return want;
  var rows = [];
  sh.getRange(2, 1, last - 1, 3).getValues().forEach(function (r, i) {
    if (Object.prototype.hasOwnProperty.call(want, r[0])) rows.push({ path: r[0], part: Number(r[1]), enc: String(r[2]), at: i + 2 });
  });
  var text = {};
  for (var i = 0; i < rows.length;) {
    var j = i;
    while (j + 1 < rows.length && rows[j + 1].at === rows[j].at + 1 && j + 1 - i < READ_ROWS) j += 1;
    var start = rows[i].at;
    sh.getRange(start, 4, j - i + 1, 1).getValues().forEach(function (v, k) { text[start + k] = String(v[0]); });
    i = j + 1;
  }
  rows.forEach(function (r) { want[r.path].push([r.part, r.enc, text[r.at]]); });
  return want;
}

function readSheet_(paths) {
  var sh = agg_().getSheetByName('data');
  if (!sh) throw new Error('DATA_KOSONG');
  var want = readParts_(sh, paths);
  var out = {};
  Object.keys(want).forEach(function (x) {
    var parts = want[x];
    if (!parts.length) return;
    parts.sort(function (a, b) { return a[0] - b[0]; });
    out[x] = { enc: parts[0][1], chunks: parts.map(function (y) { return y[2].replace(/^b:/, ''); }) };
  });
  return out;
}

function headKey_(ver, x) { return 'dh:' + ver + ':' + x; }
function chunkKey_(ver, x, i) { return 'dc:' + ver + ':' + x + ':' + i; }

function fromCache_(cache, ver, paths) {
  var heads = cache.getAll(paths.map(function (x) { return headKey_(ver, x); }));
  var plan = {};
  var keys = [];
  paths.forEach(function (x) {
    var h = heads[headKey_(ver, x)];
    if (!h) return;
    var head = JSON.parse(h);
    plan[x] = head;
    for (var i = 0; i < head.n; i += 1) keys.push(chunkKey_(ver, x, i));
  });
  var chunks = keys.length ? cache.getAll(keys) : {};
  var out = {};
  Object.keys(plan).forEach(function (x) {
    var parts = [];
    for (var i = 0; i < plan[x].n; i += 1) {
      var c = chunks[chunkKey_(ver, x, i)];
      if (typeof c !== 'string') return;
      parts.push(c);
    }
    out[x] = { enc: plan[x].enc, data: parts.join('') };
  });
  return out;
}

function toCache_(cache, ver, found) {
  var entries = {};
  Object.keys(found).forEach(function (x) {
    entries[headKey_(ver, x)] = JSON.stringify({ enc: found[x].enc, n: found[x].chunks.length });
    found[x].chunks.forEach(function (c, i) { entries[chunkKey_(ver, x, i)] = c; });
  });
  try { cache.putAll(entries, GUARD.dataCacheSec); } catch (err) { console.warn('Cache data penuh, dilewati: ' + err); }
}

function readData_(paths) {
  var ver = version_().version || '';
  var cache = CacheService.getScriptCache();
  var out = ver ? fromCache_(cache, ver, paths) : {};
  var missing = paths.filter(function (x) { return !out[x]; });
  if (!missing.length) return out;
  var found = readSheet_(missing);
  if (ver) toCache_(cache, ver, found);
  Object.keys(found).forEach(function (x) { out[x] = { enc: found[x].enc, data: found[x].chunks.join('') }; });
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
