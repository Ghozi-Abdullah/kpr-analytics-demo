var CHUNK = 45000;
var SOURCE_KEYS = { performance: 'SRC_PERFORMANCE', kuadran: 'SRC_KUADRAN', portfolio: 'SRC_PORTFOLIO', realisasi: 'SRC_REALISASI', sla: 'SRC_SLA' };
var SOURCE_SHEETS = { performance: '2026', kuadran: 'Kuadran RM', portfolio: 'Tabel', realisasi: 'All', sla: '' };
var OPTIONAL_SOURCES = { sla: true };
var SOURCE_CFG = { performance: 'PERFORMANCE', kuadran: 'KUADRAN', portfolio: 'PORTFOLIO', realisasi: 'REALISASI', sla: 'SLA' };

function props_() { return PropertiesService.getScriptProperties(); }

function sourceId_(p, name) {
  return p.getProperty(SOURCE_KEYS[name]) || (name === 'kuadran' ? p.getProperty(SOURCE_KEYS.performance) : null);
}

function sheetName_(p, name) {
  return p.getProperty(SOURCE_KEYS[name] + '_SHEET') || SOURCE_SHEETS[name];
}

function sheetKey_(value) { return String(value === null || value === undefined ? '' : value).replace(/\s+/g, ' ').trim().toLowerCase(); }

function headerFields_(row, lookup) {
  var seen = {}; var fields = {};
  row.forEach(function (v) {
    var h = sheetKey_(v);
    if (!h) return;
    seen[h] = (seen[h] || 0) + 1;
    var key = seen[h] > 1 ? h + '.' + (seen[h] - 1) : h;
    if (lookup[key]) fields[lookup[key]] = true;
  });
  return fields;
}

function findSheet_(ss, wanted, name) {
  var sheets = ss.getSheets();
  var exact = wanted ? sheets.filter(function (sh) { return sheetKey_(sh.getName()) === sheetKey_(wanted); })[0] : null;
  if (exact) return { sheet: exact, note: '' };
  var cols = KPR_CONFIG[SOURCE_CFG[name] + '_COLUMNS'];
  var required = KPR_CONFIG[SOURCE_CFG[name] + '_REQUIRED'];
  var lookup = {};
  Object.keys(cols).forEach(function (k) { lookup[k.toLowerCase()] = cols[k]; });
  var best = null; var bestHits = 0;
  sheets.forEach(function (sh) {
    var rows = Math.min(15, sh.getLastRow()); var width = sh.getLastColumn();
    if (!rows || !width) return;
    var top = {};
    sh.getRange(1, 1, rows, width).getValues().forEach(function (row) {
      var f = headerFields_(row, lookup);
      if (Object.keys(f).length > Object.keys(top).length) top = f;
    });
    var hits = Object.keys(top).length;
    if (required.every(function (r) { return top[r]; }) && hits > bestHits) { best = sh; bestHits = hits; }
  });
  if (best) {
    return { sheet: best, note: wanted ? 'Sheet "' + wanted + '" tidak ada di ' + ss.getName() + ', dipakai sheet "' + best.getName() + '" yang kolomnya cocok.' : '' };
  }
  if (!wanted) throw new Error('Tidak ada sheet di ' + ss.getName() + ' yang judul kolomnya cocok.');
  throw new Error('Sheet "' + wanted + '" tidak ada di ' + ss.getName() + '. Sheet yang ada: '
    + sheets.map(function (sh) { return sh.getName(); }).join(', ') + '.');
}

function setup() {
  var p = props_();
  var id = p.getProperty('AGG_ID');
  var ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create('KPR Analytics - data agregat');
    p.setProperty('AGG_ID', ss.getId());
  }
  if (!ss.getSheetByName('info')) {
    var info = ss.getSheets()[0];
    info.setName('info');
    info.getRange(1, 1, 1, 2).setValues([['kunci', 'nilai']]);
  }
  Logger.log('Spreadsheet agregat: ' + ss.getUrl());
  Logger.log('AGG_ID = ' + ss.getId() + '  <- salin ke Script Properties project dashboard');
  Logger.log('Mode GitHub Pages + KPR API: JANGAN bagikan spreadsheet ini; isi AGG_ID di project KPR API.');
  Logger.log('Mode Apps Script saja: bagikan ke email tim sebagai Viewer dan matikan download/print/copy untuk Viewer.');
  Object.keys(SOURCE_KEYS).forEach(function (k) {
    if (k === 'kuadran' && !p.getProperty(SOURCE_KEYS[k])) {
      Logger.log('SRC_KUADRAN kosong: Kuadran RM dibaca dari spreadsheet Performance, sheet "' + sheetName_(p, k) + '".');
    } else if (!p.getProperty(SOURCE_KEYS[k]) && OPTIONAL_SOURCES[k]) {
      Logger.log('Opsional, boleh kosong: Script Property ' + SOURCE_KEYS[k] + ' (halaman SLA kosong sampai diisi).');
    } else if (!p.getProperty(SOURCE_KEYS[k])) {
      Logger.log('BELUM DIISI: Script Property ' + SOURCE_KEYS[k]);
    }
  });
}

var WATCH_STEPS = [1, 5, 10, 15, 30];
var SETTLE_MS = 90 * 1000;

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'buildAll' || t.getHandlerFunction() === 'watchSources') ScriptApp.deleteTrigger(t);
  });
  var wanted = Number(props_().getProperty('WATCH_MINUTES') || 5);
  var minutes = WATCH_STEPS.filter(function (m) { return m >= wanted; })[0] || 30;
  ScriptApp.newTrigger('watchSources').timeBased().everyMinutes(minutes).create();
  ScriptApp.newTrigger('buildAll').timeBased().everyDays(1).atHour(5).create();
  Logger.log('Pemicu terpasang: cek perubahan sumber tiap ' + minutes + ' menit, ditambah bangun ulang harian pukul 05.00.');
}

function sourceStamps_() {
  var p = props_();
  var stamps = {};
  Object.keys(SOURCE_KEYS).forEach(function (k) {
    var id = sourceId_(p, k);
    if (id && !stamps[id]) stamps[id] = DriveApp.getFileById(id).getLastUpdated().getTime();
  });
  return stamps;
}

function watchSources() {
  var p = props_();
  var stamps = sourceStamps_();
  var seen = JSON.parse(p.getProperty('SOURCE_STAMPS') || '{}');
  var changed = Object.keys(stamps).filter(function (id) { return stamps[id] !== seen[id]; });
  if (!changed.length) return;
  var newest = Math.max.apply(null, changed.map(function (id) { return stamps[id]; }));
  if (Date.now() - newest < SETTLE_MS) {
    Logger.log('Sumber baru saja berubah, menunggu pengeditan selesai.');
    return;
  }
  buildAll();
  p.setProperty('SOURCE_STAMPS', JSON.stringify(stamps));
}

function readSource_(name) {
  var p = props_();
  var id = sourceId_(p, name);
  if (!id) throw new Error('Script Property ' + SOURCE_KEYS[name] + ' belum diisi.');
  var ss = SpreadsheetApp.openById(id);
  var found = findSheet_(ss, sheetName_(p, name), name);
  if (found.note) Logger.log(found.note);
  var sh = found.sheet;
  var tz = ss.getSpreadsheetTimeZone();
  return {
    values: sh.getDataRange().getValues(),
    file: ss.getName(),
    sheet: sh.getName(),
    fmtDate: function (d) { return Utilities.formatDate(d, tz, 'yyyy-MM-dd'); },
  };
}

function buildAll() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('buildAll lain masih berjalan.');
  var started = Date.now();
  try {
    var p = props_();
    var aggId = p.getProperty('AGG_ID');
    if (!aggId) throw new Error('AGG_ID belum ada. Jalankan setup() dulu.');
    var cache = {};
    var sources = {};
    Object.keys(SOURCE_KEYS).forEach(function (k) {
      if (OPTIONAL_SOURCES[k] && !sourceId_(p, k)) { sources[k] = null; return; }
      var key = sourceId_(p, k) + '|' + sheetName_(p, k);
      sources[k] = cache[key] || (cache[key] = readSource_(k));
    });
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
    var res = KPR.buildAll(sources, { now: now, isDummy: p.getProperty('IS_DUMMY') === 'true' });
    res.log.forEach(function (l) { Logger.log(l); });
    res.notes.forEach(function (n) { Logger.log('info: ' + n); });
    var ss = SpreadsheetApp.openById(aggId);
    var lastVersion = readInfo_(ss).versi || '';
    if (res.errors.length) {
      writeInfo_(ss, [['status', 'GAGAL'], ['waktu', now], ['versi', lastVersion], ['alasan', res.errors.join('\n')]]);
      throw new Error('Pipeline GAGAL, data lama tidak diubah:\n' + res.errors.join('\n'));
    }
    writeData_(ss, res.files);
    writeInfo_(ss, [['status', 'OK'], ['waktu', now], ['versi', res.meta.generated_at || now], ['durasi_detik', Math.round((Date.now() - started) / 1000)],
      ['file', Object.keys(res.files).length], ['dummy', String(!!res.meta.is_dummy)]]);
    Logger.log('Selesai. ' + Object.keys(res.files).length + ' file ditulis ke spreadsheet agregat.');
  } finally {
    lock.releaseLock();
  }
}

function writeData_(ss, files) {
  var rows = [];
  Object.keys(files).sort().forEach(function (path) {
    var json = JSON.stringify(files[path]);
    var gz = Utilities.gzip(Utilities.newBlob(json, 'application/json', path));
    var b64 = Utilities.base64Encode(gz.getBytes());
    for (var i = 0, part = 0; i < b64.length; i += CHUNK, part += 1) {
      rows.push([path, part, 'gz64', 'b:' + b64.slice(i, i + CHUNK)]);
    }
  });
  var tmp = ss.getSheetByName('data_baru');
  if (tmp) ss.deleteSheet(tmp);
  tmp = ss.insertSheet('data_baru');
  tmp.getRange(1, 1, 1, 4).setValues([['path', 'part', 'enc', 'content']]);
  tmp.getRange(2, 1, rows.length, 4).setNumberFormat('@').setValues(rows);
  SpreadsheetApp.flush();
  var old = ss.getSheetByName('data');
  if (old) ss.deleteSheet(old);
  tmp.setName('data');
  tmp.hideSheet();
}

function readInfo_(ss) {
  var sh = ss.getSheetByName('info');
  var out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) { out[String(r[0])] = String(r[1]); });
  return out;
}

function writeInfo_(ss, pairs) {
  var sh = ss.getSheetByName('info') || ss.insertSheet('info');
  sh.clearContents();
  sh.getRange(1, 1, 1, 2).setValues([['kunci', 'nilai']]);
  sh.getRange(2, 1, pairs.length, 2).setValues(pairs.map(function (r) { return [r[0], String(r[1])]; }));
}
