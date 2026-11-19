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
      Logger.log('Opsional, boleh kosong: Script Property ' + SOURCE_KEYS[k] + '. Isi SLA_CONTOH = ya untuk memakai data contoh SLA sampai data asli ada.');
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
  var job = loadJob_(p);
  if (job) {
    if (Date.now() - (job.touched || job.started) > STALL_MS) {
      Logger.log('Pembangunan data sempat terhenti, dilanjutkan.');
      runBuild_(null);
    }
    return;
  }
  var stamps = sourceStamps_();
  var seen = JSON.parse(p.getProperty('SOURCE_STAMPS') || '{}');
  var changed = Object.keys(stamps).filter(function (id) { return stamps[id] !== seen[id]; });
  if (!changed.length) return;
  var newest = Math.max.apply(null, changed.map(function (id) { return stamps[id]; }));
  if (Date.now() - newest < SETTLE_MS) {
    Logger.log('Sumber baru saja berubah, menunggu pengeditan selesai.');
    return;
  }
  runBuild_(stamps);
}

var READ_CELLS = 300000;
var BUDGET_MS = 270000;
var HARD_MS = 320000;
var BLOCK_MS = 45000;
var PROBE_CELLS = 60000;
var STALL_MS = 10 * 60 * 1000;
var JOB_KEY = 'BUILD_JOB';
var JOB_TTL_MS = 3 * 3600 * 1000;
var CACHE_SHEET = 'cache_bangun';
var CACHE_ROWS = 40;
var JOB_VERSION = 2;
var DATE_MARK = '\u0001d';
var STATE_KEY = '#olah';
var PROC_RATE = 0.05;
var STATE_MS = 20000;
var FINISH_MS = 120000;
var HEAVY_CELLS = 1000000;

function wantedHeaders_() {
  var want = {};
  var add = function (h) { var k = sheetKey_(String(h).replace(/\.\d+$/, '')); if (k) want[k] = 1; };
  Object.keys(SOURCE_CFG).forEach(function (name) { Object.keys(KPR_CONFIG[SOURCE_CFG[name] + '_COLUMNS']).forEach(add); });
  Object.keys(KPR_CONFIG.SENSITIVE_SOURCE_COLUMNS).forEach(function (name) { KPR_CONFIG.SENSITIVE_SOURCE_COLUMNS[name].forEach(add); });
  add('Nama RM');
  return want;
}

function planColumns_(sh) {
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  var plan = { sheet: sh.getName(), lastRow: lastRow, total: lastCol, width: 0, runs: [], skipped: [] };
  if (!lastRow || !lastCol) return plan;
  var want = wantedHeaders_();
  var head = sh.getRange(1, 1, Math.min(15, lastRow), lastCol).getValues();
  var best = 0; var hits = -1;
  head.forEach(function (row, i) {
    var n = row.filter(function (v) { return want[sheetKey_(v)]; }).length;
    if (n > hits) { best = i; hits = n; }
  });
  var cols = [];
  head[best].forEach(function (v, c) {
    if (want[sheetKey_(v)]) cols.push(c);
    else if (sheetKey_(v)) plan.skipped.push(String(v).replace(/\s+/g, ' ').trim());
  });
  if (!cols.length) {
    plan.lastRow = head.length;
    plan.runs = [{ start: 0, width: lastCol }];
    plan.width = lastCol;
    plan.skipped = [];
    return plan;
  }
  cols.forEach(function (c) {
    var last = plan.runs[plan.runs.length - 1];
    if (last && last.start + last.width === c) last.width += 1; else plan.runs.push({ start: c, width: 1 });
  });
  plan.width = cols.length;
  return plan;
}

var JOB_PART = 6000;

function jobParts_(p) { return Number(p.getProperty(JOB_KEY) || 0); }

function dropJob_(p) {
  for (var i = 0, n = jobParts_(p); i < n; i += 1) p.deleteProperty(JOB_KEY + '_' + i);
  p.deleteProperty(JOB_KEY);
}

function loadJob_(p) {
  var n = jobParts_(p);
  if (!n) return null;
  var raw = '';
  for (var i = 0; i < n; i += 1) raw += p.getProperty(JOB_KEY + '_' + i) || '';
  var job = null;
  try { job = JSON.parse(raw); } catch (e) { job = null; }
  if (!job || job.v !== JOB_VERSION || Date.now() - job.started > JOB_TTL_MS) {
    dropJob_(p);
    Logger.log('Proses bangun data sebelumnya tidak selesai, dimulai ulang dari awal.');
    return null;
  }
  return job;
}

function saveJob_(p, job) {
  job.touched = Date.now();
  var raw = JSON.stringify(job);
  var old = jobParts_(p);
  var parts = {}; var n = 0;
  for (var i = 0; i < raw.length; i += JOB_PART, n += 1) parts[JOB_KEY + '_' + n] = raw.slice(i, i + JOB_PART);
  for (var j = n; j < old; j += 1) p.deleteProperty(JOB_KEY + '_' + j);
  parts[JOB_KEY] = String(n);
  p.setProperties(parts);
}

function newJob_(p, stamps) {
  var steps = []; var map = {}; var seen = {};
  Object.keys(SOURCE_KEYS).forEach(function (k) {
    var id = sourceId_(p, k);
    if (!id) {
      if (OPTIONAL_SOURCES[k]) { map[k] = null; return; }
      throw new Error('Script Property ' + SOURCE_KEYS[k] + ' belum diisi.');
    }
    var key = id + '|' + sheetName_(p, k);
    map[k] = key;
    if (!seen[key]) { seen[key] = 1; steps.push({ key: key, name: k, id: id, sheet: sheetName_(p, k), plan: null, next: 0, part: 0, dates: {} }); }
  });
  return {
    v: JOB_VERSION, started: Date.now(), runs: 0, cur: 0, stage: 0, statePart: -1, procRate: 0, tries: {},
    steps: steps, map: map, stamps: stamps || sourceStamps_(),
  };
}

function cacheSheet_(ss) {
  var sh = ss.getSheetByName(CACHE_SHEET);
  if (sh) return sh;
  sh = ss.insertSheet(CACHE_SHEET);
  sh.hideSheet();
  return sh;
}

function ensureRows_(sh, upto) {
  var max = sh.getMaxRows();
  if (upto > max) sh.insertRowsAfter(max, upto - max);
}

function appendCache_(ss, key, part, run, data) {
  var b64 = Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(JSON.stringify(data), 'application/json')).getBytes());
  var out = [];
  for (var i = 0, seq = 0; i < b64.length; i += CHUNK, seq += 1) out.push([key, part, seq, run, 'b:' + b64.slice(i, i + CHUNK)]);
  var sh = cacheSheet_(ss);
  var at = sh.getLastRow() + 1;
  ensureRows_(sh, at + out.length - 1);
  sh.getRange(at, 1, out.length, 5).setNumberFormat('@').setValues(out);
}

function loadParts_(ss, key, onlyPart) {
  var sh = ss.getSheetByName(CACHE_SHEET);
  if (!sh || !sh.getLastRow()) return [];
  var index = sh.getRange(1, 1, sh.getLastRow(), 4).getValues();
  var parts = {};
  index.forEach(function (row, i) {
    if (String(row[0]) !== key) return;
    var part = Number(row[1]);
    if (onlyPart !== undefined && part !== onlyPart) return;
    var run = Number(row[3]);
    if (!parts[part] || run > parts[part].run) parts[part] = { part: part, run: run, rows: [] };
    if (run === parts[part].run) parts[part].rows.push({ seq: Number(row[2]), at: i + 1 });
  });
  var list = Object.keys(parts).map(function (k) { return parts[k]; }).sort(function (a, b) { return a.part - b.part; });
  var wanted = [];
  list.forEach(function (x) { x.rows.forEach(function (r) { wanted.push(r.at); }); });
  wanted.sort(function (a, b) { return a - b; });
  var text = {};
  for (var i = 0; i < wanted.length;) {
    var j = i;
    while (j + 1 < wanted.length && wanted[j + 1] === wanted[j] + 1 && j + 1 - i < CACHE_ROWS) j += 1;
    sh.getRange(wanted[i], 5, j - i + 1, 1).getValues().forEach(function (v, k) { text[wanted[i] + k] = String(v[0]).replace(/^b:/, ''); });
    i = j + 1;
  }
  return list.map(function (x) {
    x.rows.sort(function (a, b) { return a.seq - b.seq; });
    var bytes = Utilities.base64Decode(x.rows.map(function (r) { return text[r.at]; }).join(''));
    return JSON.parse(Utilities.ungzip(Utilities.newBlob(bytes, 'application/x-gzip')).getDataAsString());
  });
}

function loadRaw_(ss, st) {
  var values = [];
  var cols = Object.keys(st.dates || {}).map(Number);
  loadParts_(ss, st.key).forEach(function (rows) {
    for (var r = 0; r < rows.length; r += 1) {
      var row = rows[r];
      for (var c = 0; c < cols.length; c += 1) {
        var v = row[cols[c]];
        if (typeof v === 'string' && v.charCodeAt(0) === 1) row[cols[c]] = new Date(Number(v.slice(DATE_MARK.length)));
      }
      values.push(row);
    }
  });
  return values;
}

function dateFormatter_(tz) {
  var memo = {};
  return function (d) {
    var k = d.getTime();
    var v = memo[k];
    if (v === undefined) { v = Utilities.formatDate(d, tz, 'yyyy-MM-dd'); memo[k] = v; }
    return v;
  };
}

function dropContinue_() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'continueBuild') ScriptApp.deleteTrigger(t); });
}

function clearJob_(p, ss) {
  dropJob_(p);
  var sh = ss && ss.getSheetByName(CACHE_SHEET);
  if (sh) ss.deleteSheet(sh);
  dropContinue_();
}

function blockRows_(st, left) {
  var width = Math.max(1, st.plan.width);
  var cells = st.rate ? Math.min(READ_CELLS, BLOCK_MS / st.rate) : PROBE_CELLS;
  cells /= Math.pow(4, st.slow || 0);
  return Math.max(1, Math.min(left, Math.floor(cells / width)));
}

function readStep_(job, ss, time) {
  var st = job.steps[job.cur];
  var file = SpreadsheetApp.openById(st.id);
  var sh;
  if (!st.plan) {
    var found = findSheet_(file, st.sheet, st.name);
    if (found.note) Logger.log(found.note);
    sh = found.sheet;
    st.plan = planColumns_(sh);
    st.plan.file = file.getName();
    st.plan.tz = file.getSpreadsheetTimeZone();
    Logger.log('Membaca ' + st.name + ': ' + st.plan.lastRow + ' baris, ' + st.plan.width + ' dari ' + st.plan.total + ' kolom dipakai.');
  } else {
    sh = file.getSheetByName(st.plan.sheet);
    if (!sh) throw new Error('Sheet "' + st.plan.sheet + '" di ' + st.plan.file + ' hilang saat proses berjalan.');
  }
  while (st.next < st.plan.lastRow) {
    var n = blockRows_(st, st.plan.lastRow - st.next);
    var now = Date.now();
    if (now > time.soft) return false;
    if (st.rate && now + st.rate * n * st.plan.width * 1.5 > time.hard) return false;
    var rows = [];
    for (var i = 0; i < n; i += 1) rows.push([]);
    var offset = 0;
    st.plan.runs.forEach(function (run) {
      var block = sh.getRange(st.next + 1, run.start + 1, n, run.width).getValues();
      for (var r = 0; r < n; r += 1) {
        var target = rows[r]; var src = block[r];
        for (var c = 0; c < run.width; c += 1) {
          var v = src[c];
          if (typeof v === 'object' && v !== null && v instanceof Date) { v = DATE_MARK + v.getTime(); st.dates[offset + c] = 1; }
          target.push(v);
        }
      }
      offset += run.width;
    });
    appendCache_(ss, st.key, st.part, job.runs, rows);
    var rate = (Date.now() - now) / Math.max(1, n * st.plan.width);
    st.rate = st.rate ? Math.max(rate, (st.rate + rate) / 2) : rate;
    st.part += 1;
    st.next += n;
    saveJob_(props_(), job);
  }
  Logger.log('  ' + st.name + ' selesai dibaca.');
  return true;
}

function progress_(job) {
  var left = job.steps.slice(job.cur).map(function (s) { return s.name; });
  if (left.length) return 'Masih dibaca: ' + left.join(', ') + '. ';
  var todo = KPR.STEPS.slice(job.stage);
  return todo.length ? 'Semua sumber sudah dibaca. Berikutnya diolah: ' + todo.join(', ') + '. ' : 'Semua sudah diolah, tinggal disimpan. ';
}

function pause_(p, job, started) {
  job.active = false;
  saveJob_(p, job);
  dropContinue_();
  ScriptApp.newTrigger('continueBuild').timeBased().after(60 * 1000).create();
  Logger.log('Bagian ' + job.runs + ' selesai dalam ' + Math.round((Date.now() - started) / 1000) + ' detik. ' + progress_(job)
    + 'Lanjut otomatis sekitar 1 menit lagi, tidak perlu menjalankan apa pun.');
  return false;
}

function buildOpts_(p) {
  return {
    now: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss"),
    isDummy: p.getProperty('IS_DUMMY') === 'true',
    slaSample: /^(ya|true|1)$/i.test(String(p.getProperty('SLA_CONTOH') || '').trim()),
  };
}

function loadState_(ss, job, p) {
  if (job.statePart < 0) return KPR.begin(buildOpts_(p));
  var found = loadParts_(ss, STATE_KEY, job.statePart);
  if (!found.length) throw new Error('Hasil olahan sementara hilang dari sheet ' + CACHE_SHEET + '. Jalankan buildAll lagi.');
  return found[0];
}

function stepOf_(job, name) {
  var key = job.map[name];
  if (!key) return null;
  return job.steps.filter(function (st) { return st.key === key; })[0];
}

function stageCells_(job, name) {
  var st = stepOf_(job, name);
  return st && st.plan ? st.plan.lastRow * Math.max(1, st.plan.width) : 0;
}

function processStage_(p, ss, job, name) {
  var t0 = Date.now();
  var state = loadState_(ss, job, p);
  var st = stepOf_(job, name);
  var src = null;
  var t1 = Date.now();
  if (st) {
    var plan = st.plan;
    src = { values: loadRaw_(ss, st), skipped: plan.skipped, file: plan.file, sheet: plan.sheet, fmtDate: dateFormatter_(plan.tz) };
  }
  var t2 = Date.now();
  var before = state.log.length;
  KPR.step(state, name, src);
  src = null;
  var t3 = Date.now();
  state.log.slice(before).forEach(function (l) { Logger.log(l); });
  appendCache_(ss, STATE_KEY, job.stage, job.runs, state);
  job.statePart = job.stage;
  job.stage += 1;
  var cells = stageCells_(job, name);
  if (cells > 100000) {
    var rate = (Date.now() - t0) / cells;
    job.procRate = job.procRate ? Math.max(rate, (job.procRate + rate) / 2) : rate;
  }
  saveJob_(p, job);
  Logger.log('  ' + name + ' selesai diolah dalam ' + Math.round((Date.now() - t0) / 1000) + ' detik (memuat '
    + Math.round((t2 - t1) / 1000) + ', mengolah ' + Math.round((t3 - t2) / 1000) + ', menyimpan ' + Math.round((Date.now() - t3) / 1000) + ').');
  return state;
}

function finishBuild_(p, ss, job) {
  var t0 = Date.now();
  var state = loadState_(ss, job, p);
  var before = state.log.length;
  var res = KPR.finish(state);
  res.log.slice(before).forEach(function (l) { Logger.log(l); });
  res.notes.forEach(function (n) { Logger.log('info: ' + n); });
  var now = state.opts.now;
  var lastVersion = readInfo_(ss).versi || '';
  if (res.errors.length) {
    writeInfo_(ss, [['status', 'GAGAL'], ['waktu', now], ['versi', lastVersion], ['alasan', res.errors.join('\n')]]);
    throw new Error('Pipeline GAGAL, data lama tidak diubah:\n' + res.errors.join('\n'));
  }
  writeData_(ss, res.files);
  writeInfo_(ss, [['status', 'OK'], ['waktu', now], ['versi', res.meta.generated_at || now], ['durasi_detik', Math.round((Date.now() - job.started) / 1000)],
    ['bagian', job.runs], ['file', Object.keys(res.files).length], ['dummy', String(!!res.meta.is_dummy)],
    ['sla_contoh', String(!!(res.meta.datasets.sla && res.meta.datasets.sla.sample))]]);
  if (job.stamps) p.setProperty('SOURCE_STAMPS', JSON.stringify(job.stamps));
  clearJob_(p, ss);
  Logger.log('  pemeriksaan dan penulisan ' + Math.round((Date.now() - t0) / 1000) + ' detik.');
  Logger.log('Selesai. ' + Object.keys(res.files).length + ' file ditulis ke spreadsheet agregat dalam ' + job.runs + ' bagian.');
}

function runBuild_(stamps) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { Logger.log('Pembangunan data lain masih berjalan, coba lagi beberapa menit lagi.'); return false; }
  var started = Date.now();
  var time = { soft: started + BUDGET_MS, hard: started + HARD_MS };
  var p = props_();
  var ss = null;
  var job = null;
  try {
    var aggId = p.getProperty('AGG_ID');
    if (!aggId) throw new Error('AGG_ID belum ada. Jalankan setup() dulu.');
    ss = SpreadsheetApp.openById(aggId);
    job = loadJob_(p);
    if (!job) {
      job = newJob_(p, stamps);
      var old = ss.getSheetByName(CACHE_SHEET);
      if (old) ss.deleteSheet(old);
      Logger.log('Mulai membangun data dari ' + job.steps.length + ' sumber. Data dibaca lalu diolah bertahap, beberapa menit per bagian.');
    } else {
      Logger.log('Melanjutkan pembangunan data, bagian ' + (job.runs + 1) + '.');
      if (job.active && job.steps[job.cur]) {
        job.steps[job.cur].slow = (job.steps[job.cur].slow || 0) + 1;
        Logger.log('Bagian sebelumnya terhenti paksa, ukuran blok baca ' + job.steps[job.cur].name + ' diperkecil.');
      } else if (job.active) {
        var at = KPR.STEPS[job.stage] || 'penyimpanan akhir';
        job.tries[at] = (job.tries[at] || 0) + 1;
        Logger.log('Bagian sebelumnya terhenti paksa saat mengolah ' + at + '.');
        if (job.tries[at] >= 2) throw new Error('Pengolahan ' + at + ' melebihi batas 6 menit Apps Script dua kali. Kirim log ini ke pengelola dashboard.');
      }
    }
    job.runs += 1;
    job.active = true;
    saveJob_(p, job);
    var worked = false;
    while (job.cur < job.steps.length) {
      worked = true;
      if (!readStep_(job, ss, time)) return pause_(p, job, started);
      job.cur += 1;
      saveJob_(p, job);
    }
    while (job.stage < KPR.STEPS.length) {
      var name = KPR.STEPS[job.stage];
      var cells = stageCells_(job, name);
      var est = cells * (job.procRate || PROC_RATE) * 1.5 + STATE_MS;
      if (worked && (cells > HEAVY_CELLS || Date.now() - started + est > BUDGET_MS)) return pause_(p, job, started);
      processStage_(p, ss, job, name);
      worked = true;
    }
    if (worked && Date.now() - started > FINISH_MS) return pause_(p, job, started);
    finishBuild_(p, ss, job);
    return true;
  } catch (e) {
    if (job && job.stamps) p.setProperty('SOURCE_STAMPS', JSON.stringify(job.stamps));
    clearJob_(p, ss);
    throw e;
  } finally {
    lock.releaseLock();
  }
}

function buildAll() { return runBuild_(null); }

function continueBuild() { return runBuild_(null); }

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
