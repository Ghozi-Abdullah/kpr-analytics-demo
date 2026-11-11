var KPR = (function () {
  'use strict';

  var MONTHS_ID = {
    jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, pebruari: 2, mar: 3, maret: 3, march: 3,
    apr: 4, april: 4, mei: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7,
    agu: 8, ags: 8, agt: 8, agustus: 8, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
    okt: 10, oct: 10, oktober: 10, october: 10, nov: 11, nop: 11, november: 11, nopember: 11,
    des: 12, dec: 12, desember: 12, december: 12,
  };
  var BAD_TEXT = { '-': 1, '#N/A': 1, '#DIV/0!': 1, '#VALUE!': 1, '#REF!': 1, 'null': 1, 'None': 1 };

  function PipelineError(message) { this.name = 'PipelineError'; this.message = message; }
  PipelineError.prototype = Object.create(Error.prototype);

  var isDate = function (v) { return Object.prototype.toString.call(v) === '[object Date]'; };
  var isBlank = function (v) {
    return v === null || v === undefined || (typeof v === 'number' && isNaN(v)) || (typeof v === 'string' && v.trim() === '');
  };
  var pad = function (n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; };
  var cmp = function (a, b) { return a < b ? -1 : a > b ? 1 : 0; };
  function cmpKeys(a, b) {
    for (var i = 0; i < a.length; i += 1) { var c = cmp(a[i], b[i]); if (c) return c; }
    return 0;
  }
  function utf8Len(s) {
    var n = 0;
    for (var i = 0; i < s.length; i += 1) {
      var c = s.charCodeAt(i);
      if (c < 0x80) n += 1;
      else if (c < 0x800) n += 2;
      else if (c >= 0xD800 && c <= 0xDBFF) { n += 4; i += 1; } else n += 3;
    }
    return n;
  }

  function normHeader(v) {
    if (v === null || v === undefined || (typeof v === 'number' && isNaN(v))) return '';
    return String(v).replace(/\s+/g, ' ').trim();
  }
  function dedupeHeaders(headers) {
    var seen = {};
    return headers.map(function (h) {
      var key = h.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(seen, key)) { seen[key] += 1; return h + '.' + seen[key]; }
      seen[key] = 0;
      return h;
    });
  }
  function cleanText(v) {
    if (v === null || v === undefined || (typeof v === 'number' && isNaN(v))) return null;
    var t = (isDate(v) ? v.toISOString() : String(v)).replace(/\s+/g, ' ').trim();
    return t || null;
  }
  var NAME_NOISE = /\b(kanwil|kantor wilayah|regional office|regional|region|ro|kcp|kc|kanca|kantor cabang|cabang|bri)\b/g;
  function nameKey(v) {
    var t = cleanText(v);
    if (!t) return '';
    t = t.toLowerCase()
      .replace(/^\s*(region|regional|ro)\s*\d+\s*\/\s*/, '')
      .replace(/\(konsolidasi[^)]*\)/g, ' ')
      .replace(/^\s*\d+\s*-+\s*/, '')
      .replace(NAME_NOISE, ' ');
    return t.replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function canonicalRo(v) {
    var t = cleanText(v);
    if (t === null) return null;
    return t.toUpperCase() === 'NASIONAL' ? 'Nasional' : t;
  }

  function parseNumber(v) {
    if (v === null || v === undefined || v === '') return NaN;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'number') return v;
    if (isDate(v)) return NaN;
    var text = String(v).trim();
    if (text === '' || BAD_TEXT[text]) return NaN;
    var pct = /%$/.test(text);
    text = text.replace(/rp|%|\s/gi, '');
    var negative = text.charAt(0) === '(' && text.charAt(text.length - 1) === ')';
    text = text.replace(/^[()]+|[()]+$/g, '');
    if (text.indexOf(',') >= 0 && text.indexOf('.') >= 0) {
      if (text.lastIndexOf(',') > text.lastIndexOf('.')) text = text.replace(/\./g, '').replace(/,/g, '.');
      else text = text.replace(/,/g, '');
    } else if (text.indexOf(',') >= 0) {
      text = (text.split(',').length - 1) === 1 ? text.replace(',', '.') : text.replace(/,/g, '');
    } else if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) {
      text = text.replace(/\./g, '');
    }
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(text)) return NaN;
    var n = parseFloat(text);
    if (negative) n = -n;
    return pct ? n / 100 : n;
  }

  function parseDays(v) {
    if (v === null || v === undefined || v === '' || typeof v === 'boolean' || isDate(v)) return NaN;
    if (typeof v === 'number') return v;
    var m = /-?\d+(?:[.,]\d+)?/.exec(String(v));
    return m ? parseFloat(m[0].replace(',', '.')) : NaN;
  }
  function daysBetween(start, end) {
    if (typeof start !== 'string' || typeof end !== 'string' || !start || !end) return NaN;
    var t = function (s) { return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)); };
    return Math.round((t(end) - t(start)) / 86400000);
  }

  function validYmd(y, m, d) {
    if (m < 1 || m > 12 || d < 1) return null;
    var dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (d > dim) return null;
    return pad(y, 4) + '-' + pad(m, 2) + '-' + pad(d, 2);
  }
  function parseDate(v, fmtDate) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number' && isNaN(v)) return null;
    if (isDate(v)) return isNaN(v.getTime()) ? null : fmtDate(v);
    if (typeof v === 'number') {
      if (v > 20000 && v < 80000) {
        var dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
        return dt.toISOString().slice(0, 10);
      }
      return null;
    }
    var text = String(v).trim();
    if (!text) return null;
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/.exec(text);
    if (m) return validYmd(+m[1], +m[2], +m[3]);
    m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(text);
    if (m) return validYmd(+m[3] + (m[3].length === 2 ? 2000 : 0), +m[2], +m[1]);
    m = /^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/.exec(text);
    if (m && MONTHS_ID[m[2].toLowerCase()]) return validYmd(+m[3], MONTHS_ID[m[2].toLowerCase()], +m[1]);
    return null;
  }
  function parseMonth(v, fmtDate) {
    var d = parseDate(v, fmtDate);
    if (d) return d.slice(0, 7);
    var text = cleanText(v);
    if (!text) return null;
    var m = /^(\d{4})[-/](\d{1,2})$/.exec(text);
    if (m) return pad(+m[1], 4) + '-' + pad(+m[2], 2);
    m = /^([A-Za-z]+)[\s\-']+(\d{2,4})$/.exec(text);
    if (m && MONTHS_ID[m[1].toLowerCase()]) return pad(+m[2] + (m[2].length === 2 ? 2000 : 0), 4) + '-' + pad(MONTHS_ID[m[1].toLowerCase()], 2);
    return null;
  }

  function cleanNumber(v, digits) {
    if (v === null || v === undefined) return null;
    if (typeof v !== 'number') return v;
    if (!isFinite(v)) return null;
    var r = Number(Math.round(Number(v + 'e' + digits)) + 'e-' + digits);
    if (!isFinite(r)) r = v;
    return r === 0 ? 0 : r;
  }

  function encodeTable(rows, fields, catCols, digits) {
    var d = digits === undefined ? 4 : digits;
    var dicts = {};
    var index = {};
    fields.forEach(function (f) {
      if (catCols.indexOf(f) < 0) return;
      var set = {};
      rows.forEach(function (r) { set[r[f] === null || r[f] === undefined ? '' : String(r[f])] = 1; });
      var uniq = Object.keys(set).sort(cmp);
      dicts[f] = uniq;
      index[f] = {};
      uniq.forEach(function (u, i) { index[f][u] = i; });
    });
    var out = rows.map(function (r) {
      return fields.map(function (f) {
        if (index[f]) return index[f][r[f] === null || r[f] === undefined ? '' : String(r[f])];
        return cleanNumber(r[f], d);
      });
    });
    return { fields: fields, dicts: dicts, rows: out };
  }

  function groupSum(rows, keys, valueCols) {
    var map = {};
    var order = [];
    rows.forEach(function (r) {
      var kv = keys.map(function (k) { return r[k]; });
      var id = JSON.stringify(kv);
      var g = map[id];
      if (!g) {
        g = { kv: kv, sums: valueCols.map(function () { return 0; }) };
        map[id] = g;
        order.push(g);
      }
      valueCols.forEach(function (c, i) { var v = r[c]; if (typeof v === 'number' && !isNaN(v)) g.sums[i] += v; });
    });
    order.sort(function (a, b) { return cmpKeys(a.kv, b.kv); });
    return order.map(function (g) {
      var o = {};
      keys.forEach(function (k, i) { o[k] = g.kv[i]; });
      valueCols.forEach(function (c, i) { o[c] = g.sums[i]; });
      return o;
    });
  }

  function detectHeaderRow(values, known) {
    var best = 0; var hits = -1;
    for (var i = 0; i < Math.min(15, values.length); i += 1) {
      var cells = {};
      values[i].forEach(function (v) { cells[normHeader(v).toLowerCase()] = 1; });
      var n = Object.keys(cells).filter(function (c) { return known[c]; }).length;
      if (n > hits) { best = i; hits = n; }
    }
    return best;
  }

  function readSource(src, allowlist) {
    var values = src.values || [];
    if (!values.length) throw new PipelineError('Sheet sumber ' + src.file + ' kosong.');
    var known = {};
    Object.keys(allowlist).forEach(function (k) { known[k.toLowerCase()] = 1; known[k.split('.')[0].toLowerCase()] = 1; });
    var hr = detectHeaderRow(values, known);
    var headers = dedupeHeaders(values[hr].map(normHeader));
    var lookup = {};
    Object.keys(allowlist).forEach(function (k) { lookup[k.toLowerCase()] = allowlist[k]; });
    var keep = []; var used = {}; var dropped = [];
    headers.forEach(function (h, i) {
      var std = lookup[h.toLowerCase()];
      if (std && !used[std]) { keep.push({ i: i, std: std }); used[std] = 1; } else if (h) dropped.push(h);
    });
    var rows = [];
    for (var r = hr + 1; r < values.length; r += 1) {
      var row = values[r];
      var o = {}; var blank = true;
      keep.forEach(function (k) {
        var v = row[k.i];
        if (v === undefined) v = null;
        if (v === '') v = null;
        o[k.std] = v;
        if (!isBlank(v)) blank = false;
      });
      if (!blank) rows.push(o);
    }
    return {
      rows: rows,
      columns: keep.map(function (k) { return k.std; }),
      info: { file: src.file, sheet: src.sheet || '(sheet pertama)', header_row: hr + 1, rows_in: rows.length,
        columns_kept: keep.map(function (k) { return k.std; }), columns_dropped: dropped },
    };
  }

  function sourceLabel(columns, std) {
    var header = Object.keys(columns).filter(function (k) { return columns[k] === std; })[0];
    if (!header) return std;
    return header.toLowerCase() === 'rp.1' ? 'Rp (kolom Rp yang kedua)' : header;
  }

  function requireCols(t, required, name, columns) {
    var missing = required.filter(function (c) { return t.columns.indexOf(c) < 0; });
    if (missing.length) {
      throw new PipelineError('Kolom wajib untuk \'' + name + '\' tidak ditemukan: '
        + missing.map(function (c) { return sourceLabel(columns || {}, c); }).join(', ')
        + '. Samakan judul kolom di spreadsheet sumber (huruf besar/kecil dan spasi tidak masalah) atau perbarui allowlist di Config.js.');
    }
  }

  function dropInvalid(rows, cols, name, log) {
    var out = rows.filter(function (r) { return cols.every(function (c) { return r[c] !== null && r[c] !== undefined; }); });
    var bad = rows.length - out.length;
    if (bad) log.push('  ! ' + name + ': ' + bad + ' baris dibuang karena ' + cols.join(', ') + ' kosong/tidak terbaca');
    return out;
  }

  var minMax = function (rows, key) {
    var lo = null; var hi = null;
    rows.forEach(function (r) { var v = r[key]; if (lo === null || v < lo) lo = v; if (hi === null || v > hi) hi = v; });
    return [lo, hi];
  };
  var uniqSorted = function (rows, key) {
    var s = {}; rows.forEach(function (r) { s[r[key]] = 1; }); return Object.keys(s).sort(cmp);
  };

  function buildPerformance(src, cfg, out, meta, log) {
    var t = readSource(src, cfg.PERFORMANCE_COLUMNS);
    requireCols(t, cfg.PERFORMANCE_REQUIRED, 'performance', cfg.PERFORMANCE_COLUMNS);
    t.rows.forEach(function (r) { r.tanggal = parseDate(r.tanggal, src.fmtDate); r.ro = canonicalRo(r.ro); });
    var rows = dropInvalid(t.rows, ['tanggal', 'ro'], 'performance', log);
    var num = t.columns.filter(function (c) { return c !== 'tanggal' && c !== 'ro'; });
    rows.forEach(function (r) { num.forEach(function (c) { r[c] = parseNumber(r[c]); }); });
    var rank = function (r) {
      var day = Number(String(r.tanggal).slice(8, 10));
      var noOs = r.os === null || r.os === undefined ? 1 : 0;
      var offDay = r.hari !== null && r.hari !== undefined && r.hari !== day ? 1 : 0;
      return noOs * 2 + offDay;
    };
    var best = {};
    rows.forEach(function (r, i) {
      var k = r.tanggal + '\u0001' + r.ro;
      if (best[k] === undefined || rank(r) < rank(rows[best[k]])) best[k] = i;
    });
    var dedup = rows.filter(function (r, i) { return best[r.tanggal + '\u0001' + r.ro] === i; });
    if (dedup.length !== rows.length) {
      log.push('  ! performance: ' + (rows.length - dedup.length) + ' baris tambahan dengan tanggal + RO sama diabaikan (dipakai baris yang berisi OS, mis. baris bantu tanggal 31)');
    }
    dedup.sort(function (a, b) { return cmp(a.tanggal, b.tanggal) || cmp(a.ro, b.ro); });
    var payload = encodeTable(dedup, t.columns, ['tanggal', 'ro'], 6);
    out['perf_daily.json'] = payload;
    var ros = uniqSorted(dedup, 'ro');
    var mm = minMax(dedup, 'tanggal');
    meta.datasets.performance = Object.assign({}, t.info, {
      rows_out: dedup.length, bytes: utf8Len(JSON.stringify(payload)), min_date: mm[0], max_date: mm[1], has_nasional: ros.indexOf('Nasional') >= 0,
    });
    meta.ro.performance = ros;
    log.push('  performance : ' + t.info.rows_in + ' baris -> ' + dedup.length + ' baris (' + mm[0] + ' s.d. ' + mm[1] + ', ' + ros.length + ' RO)');
  }

  function buildKuadran(src, cfg, out, meta, log) {
    var t = readSource(src, cfg.KUADRAN_COLUMNS);
    requireCols(t, cfg.KUADRAN_REQUIRED, 'kuadran', cfg.KUADRAN_COLUMNS);
    t.rows.forEach(function (r) { r.tanggal = parseDate(r.tanggal, src.fmtDate); r.ro = canonicalRo(r.ro); r.kuadran = cleanText(r.kuadran); });
    var rows = dropInvalid(t.rows, ['tanggal', 'ro', 'kuadran'], 'kuadran', log);
    var vals = ['jumlah_rm', 'jumlah_rm_lalu'].filter(function (c) { return t.columns.indexOf(c) >= 0; });
    rows.forEach(function (r) { vals.forEach(function (c) { r[c] = parseNumber(r[c]); }); });
    var agg = groupSum(rows, ['tanggal', 'ro', 'kuadran'], vals);
    var payload = encodeTable(agg, ['tanggal', 'ro', 'kuadran'].concat(vals), ['tanggal', 'ro', 'kuadran'], 4);
    out['perf_kuadran.json'] = payload;
    var mm = minMax(agg, 'tanggal');
    meta.datasets.kuadran = Object.assign({}, t.info, {
      rows_out: agg.length, bytes: utf8Len(JSON.stringify(payload)), min_date: mm[0], max_date: mm[1], kuadran: uniqSorted(agg, 'kuadran'),
    });
    log.push('  kuadran RM  : ' + t.info.rows_in + ' baris -> ' + agg.length + ' baris');
  }

  function buildPortfolio(src, cfg, out, meta, totals, log) {
    var t = readSource(src, cfg.PORTFOLIO_COLUMNS);
    requireCols(t, cfg.PORTFOLIO_REQUIRED, 'portfolio', cfg.PORTFOLIO_COLUMNS);
    var has = function (c) { return t.columns.indexOf(c) >= 0; };
    var textCols = ['kanca', 'kanca_fix', 'kode_kc', 'produk', 'tujuan', 'tier', 'jenis_pendapatan', 'kolek', 'kategori_os', 'kategori_deb'].filter(has);
    t.rows.forEach(function (r) {
      r.bulan = parseMonth(r.bulan, src.fmtDate);
      r.ro = canonicalRo(r.ro);
      textCols.forEach(function (c) { r[c] = cleanText(r[c]); });
      if (has('kanca_fix')) r.kanca = r.kanca_fix !== null ? r.kanca_fix : (has('kanca') ? r.kanca : null);
      ['os_rp', 'debitur', 'no'].filter(has).forEach(function (c) { r[c] = parseNumber(r[c]); });
    });
    var cols = t.columns.slice();
    if (has('kanca_fix') && !has('kanca')) cols.push('kanca');
    var rows = dropInvalid(t.rows, ['bulan', 'ro'], 'portfolio', log);
    var grain = cfg.PORTFOLIO_GRAIN.filter(function (c) { return cols.indexOf(c) >= 0; });
    rows.forEach(function (r) { grain.forEach(function (c) { if (r[c] === null || r[c] === undefined) r[c] = ''; }); });

    var parts = []; var kategori = {};
    [['os', 'kategori_os', 'os_rp'], ['deb', 'kategori_deb', 'debitur']].forEach(function (m) {
      var code = m[0]; var katCol = m[1]; var valCol = m[2];
      if (cols.indexOf(katCol) < 0 || cols.indexOf(valCol) < 0) return;
      var sub = rows.filter(function (r) { return r[katCol] !== null && typeof r[valCol] === 'number' && !isNaN(r[valCol]); });
      if (!sub.length) return;
      var order;
      if (cols.indexOf('no') >= 0) {
        var mins = {};
        sub.forEach(function (r) {
          var k = r[katCol];
          if (!(k in mins)) mins[k] = NaN;
          if (typeof r.no === 'number' && !isNaN(r.no) && (isNaN(mins[k]) || r.no < mins[k])) mins[k] = r.no;
        });
        order = Object.keys(mins).sort(cmp).map(function (k) { return [k, isNaN(mins[k]) ? 999 : mins[k]]; });
      } else {
        order = uniqSorted(sub, katCol).map(function (k, i) { return [k, i]; });
      }
      order = order.map(function (x, i) { return [x[0], x[1], i]; })
        .sort(function (a, b) { return a[1] - b[1] || a[2] - b[2]; }).map(function (x) { return [x[0], x[1]]; });
      kategori[code] = order;
      var g = groupSum(sub, grain.concat([katCol]), [valCol]).map(function (r) {
        var o = {};
        grain.forEach(function (c) { o[c] = r[c]; });
        o.kat = r[katCol]; o.v = r[valCol]; o.m = code;
        return o;
      });
      parts.push(g);
      var key = 'portfolio ' + code;
      totals[key] = totals[key] || {};
      var before = {}; var after = {};
      sub.forEach(function (r) { before[r.bulan] = (before[r.bulan] || 0) + r[valCol]; });
      g.forEach(function (r) { after[r.bulan] = (after[r.bulan] || 0) + r.v; });
      Object.keys(before).forEach(function (mo) { totals[key][mo] = [before[mo], after[mo] || 0]; });
    });
    if (!parts.length) throw new PipelineError('Portofolio: tidak ada baris dengan Kategori OS dan nilai Rp.');
    var agg = [].concat.apply([], parts);
    var months = uniqSorted(agg, 'bulan');
    var totalBytes = 0;
    var monthFields = grain.filter(function (c) { return c !== 'bulan'; }).concat(['kat', 'v', 'm']);
    months.forEach(function (mo) {
      var part = agg.filter(function (r) { return r.bulan === mo; });
      var payload = encodeTable(part, monthFields, monthFields.filter(function (c) { return c !== 'v'; }), 4);
      out['portfolio/' + mo + '.json'] = payload;
      totalBytes += utf8Len(JSON.stringify(payload));
    });
    out['portfolio_index.json'] = { months: months, kategori: kategori, grain: grain };
    var trendGrain = grain.filter(function (c) { return c !== 'kanca'; }).concat(['kat', 'm']);
    var trend = groupSum(agg, trendGrain, ['v']);
    out['portfolio_trend.json'] = encodeTable(trend, trendGrain.concat(['v']), trendGrain, 4);

    var dimCols = ['kode_kc', 'kanca', 'ro'].filter(function (c) { return cols.indexOf(c) >= 0; });
    var seen = {}; var dim = [];
    rows.forEach(function (r) {
      if (r.kanca === null || r.kanca === undefined) return;
      var kv = dimCols.map(function (c) { return r[c] === undefined ? null : r[c]; });
      var id = JSON.stringify(kv);
      if (seen[id]) return;
      seen[id] = 1;
      var o = {}; dimCols.forEach(function (c, i) { o[c] = kv[i]; });
      dim.push(o);
    });
    dim.sort(function (a, b) {
      for (var i = 0; i < dimCols.length; i += 1) {
        var x = a[dimCols[i]]; var y = b[dimCols[i]];
        if (x === y) continue;
        if (x === null) return 1;
        if (y === null) return -1;
        return cmp(x, y);
      }
      return 0;
    });
    out['dim_kanca.json'] = encodeTable(dim, dimCols, dimCols, 4);

    meta.datasets.portfolio = Object.assign({}, t.info, {
      rows_out: agg.length, bytes: totalBytes, min_month: months[0], max_month: months[months.length - 1], months: months.length,
    });
    meta.ro.portfolio = uniqSorted(agg, 'ro').filter(Boolean);
    log.push('  portofolio  : ' + t.info.rows_in + ' baris -> ' + agg.length + ' baris (' + months[0] + ' s.d. ' + months[months.length - 1] + ', ' + months.length + ' file bulanan)');
  }

  function buildRealisasi(src, cfg, out, meta, totals, log) {
    var t = readSource(src, cfg.REALISASI_COLUMNS);
    requireCols(t, cfg.REALISASI_REQUIRED, 'realisasi', cfg.REALISASI_COLUMNS);
    var has = function (c) { return t.columns.indexOf(c) >= 0; };
    var text = ['kanca', 'rm', 'tipe', 'sumber5', 'sumber6', 'tujuan', 'dev_local_champion'].filter(has);
    var blankDeb = 0;
    t.rows.forEach(function (r) {
      r.tanggal = parseDate(r.tanggal, src.fmtDate);
      r.ro = canonicalRo(r.ro);
      text.forEach(function (c) { r[c] = cleanText(r[c]); });
      r.plafond = parseNumber(r.plafond);
      if (has('debitur')) {
        r.debitur = parseNumber(r.debitur);
        if (isNaN(r.debitur)) { blankDeb += 1; r.debitur = 1; }
      } else r.debitur = 1;
    });
    if (blankDeb) log.push('  ! realisasi: ' + blankDeb + ' baris tanpa Debitur Count, dihitung 1 debitur per baris');
    var rows = dropInvalid(t.rows, ['tanggal', 'ro', 'tipe'], 'realisasi', log);
    var cols = t.columns.indexOf('debitur') >= 0 ? t.columns : t.columns.concat(['debitur']);
    var grain = cfg.REALISASI_GRAIN.filter(function (c) { return cols.indexOf(c) >= 0; });
    rows.forEach(function (r) {
      if (isNaN(r.plafond)) r.plafond = 0;
      grain.forEach(function (c) { if (r[c] === null || r[c] === undefined) r[c] = ''; });
    });
    var agg = groupSum(rows, grain, ['plafond', 'debitur']);
    var before = {}; var after = {};
    rows.forEach(function (r) { var mo = r.tanggal.slice(0, 7); before[mo] = (before[mo] || 0) + r.plafond; });
    agg.forEach(function (r) { var mo = r.tanggal.slice(0, 7); after[mo] = (after[mo] || 0) + r.plafond; });
    totals['realisasi plafond'] = {};
    Object.keys(before).forEach(function (mo) { totals['realisasi plafond'][mo] = [before[mo], after[mo] || 0]; });
    var payload = encodeTable(agg, grain.concat(['plafond', 'debitur']), grain, 2);
    out['realisasi_daily.json'] = payload;
    var mm = minMax(agg, 'tanggal');
    meta.datasets.realisasi = Object.assign({}, t.info, {
      rows_out: agg.length, bytes: utf8Len(JSON.stringify(payload)), min_date: mm[0], max_date: mm[1], tipe: uniqSorted(agg, 'tipe'),
    });
    meta.ro.realisasi = uniqSorted(agg, 'ro').filter(Boolean);
    log.push('  realisasi   : ' + t.info.rows_in + ' baris -> ' + agg.length + ' baris (' + mm[0] + ' s.d. ' + mm[1] + ')');
  }

  function decodeRows(t) {
    if (!t) return [];
    return t.rows.map(function (row) {
      var o = {};
      t.fields.forEach(function (f, i) { o[f] = t.dicts[f] ? t.dicts[f][row[i]] : row[i]; });
      return o;
    });
  }

  function collectRefs(out, meta) {
    var refs = { ro: [], kanca: [] };
    var text = function (v) { return typeof v === 'string' && v !== ''; };
    var seen = {};
    decodeRows(out['realisasi_daily.json']).forEach(function (r) {
      var id = JSON.stringify([r.kanca, r.ro]);
      if (seen[id]) return;
      seen[id] = 1;
      if (text(r.kanca) && text(r.ro)) refs.kanca.push([r.kanca, r.ro]);
    });
    decodeRows(out['dim_kanca.json']).forEach(function (r) { if (text(r.kanca) && text(r.ro)) refs.kanca.push([r.kanca, r.ro]); });
    (meta.ro.realisasi || []).concat((meta.ro.performance || []).filter(function (r) { return r !== 'Nasional'; }), meta.ro.portfolio || [])
      .forEach(function (r) { if (text(r)) refs.ro.push(r); });
    return refs;
  }

  function alignNames(rows, refs, log) {
    var roMap = {}; var kMap = {};
    refs.ro.forEach(function (r) { var k = nameKey(r); if (k && !Object.prototype.hasOwnProperty.call(roMap, k)) roMap[k] = r; });
    refs.kanca.forEach(function (p) { var k = nameKey(p[0]); if (k && !Object.prototype.hasOwnProperty.call(kMap, k)) kMap[k] = p; });
    var ros = {}; var kancas = {};
    rows.forEach(function (r) { if (r.ro !== null && r.ro !== undefined) ros[r.ro] = 1; if (r.kanca !== null && r.kanca !== undefined) kancas[r.kanca] = 1; });
    var roHit = 0; var kHit = 0;
    var roNew = {}; var kNew = {};
    Object.keys(ros).forEach(function (v) { var hit = roMap[nameKey(v)]; roNew[v] = hit || v; if (hit) roHit += 1; });
    Object.keys(kancas).forEach(function (v) { var hit = kMap[nameKey(v)]; kNew[v] = hit || null; if (hit) kHit += 1; });
    rows.forEach(function (r) {
      if (r.ro !== null && r.ro !== undefined) r.ro = roNew[r.ro];
      var m = r.kanca !== null && r.kanca !== undefined ? kNew[r.kanca] : null;
      if (m) { r.ro = m[1]; r.kanca = m[0]; }
    });
    log.push('  sla         : nama disamakan dengan dashboard lain: ' + roHit + ' dari ' + Object.keys(ros).length + ' RO, '
      + kHit + ' dari ' + Object.keys(kancas).length + ' kanca');
  }

  function buildSla(src, cfg, out, meta, totals, log) {
    if (!src) { log.push('  sla         : sumber SLA belum diisi, halaman SLA dilewati'); return; }
    var t = readSource(src, cfg.SLA_COLUMNS);
    requireCols(t, cfg.SLA_REQUIRED, 'sla', cfg.SLA_COLUMNS);
    var has = function (c) { return t.columns.indexOf(c) >= 0; };
    var text = ['kanca', 'proses', 'pendapatan', 'putusan', 'jenis_kpr', 'crs', 'pekerjaan', 'type'].filter(has);
    var dates = ['tgl_prakarsa', 'tgl_clf_awal', 'tgl_putusan', 'tgl_cair', 'today'].filter(has);
    var deltas = ['delta_prakarsa', 'delta_analisa', 'delta_putusan'].filter(has);
    t.rows.forEach(function (r) {
      r.ro = canonicalRo(r.ro);
      if (has('kanca')) r.kanca = cleanText(r.kanca);
    });
    alignNames(t.rows, collectRefs(out, meta), log);
    t.rows.forEach(function (r) {
      text.forEach(function (c) { r[c] = cleanText(r[c]); });
      dates.forEach(function (c) { r[c] = parseDate(r[c], src.fmtDate); });
      deltas.forEach(function (c) { r[c] = parseDays(r[c]); });
      ['nominal_pengajuan', 'nominal_cair'].forEach(function (c) {
        var v = has(c) ? parseNumber(r[c]) : 0;
        r[c] = isNaN(v) ? 0 : v;
      });
    });
    var rows = dropInvalid(t.rows, ['ro', 'proses'], 'sla', log);
    rows.forEach(function (r) {
      var key = String(r.proses).toLowerCase();
      var spec = cfg.SLA_STAGE_AGE[key];
      var umur = -1;
      if (spec) {
        var delta = r[spec[0]];
        if (typeof delta === 'number' && !isNaN(delta)) umur = delta;
        else {
          var span = daysBetween(r[spec[1]], r.today);
          umur = isNaN(span) ? -1 : span;
        }
      }
      r.umur = umur;
      var end = cfg.SLA_DONE_END[key];
      var lama = end ? daysBetween(r.tgl_prakarsa, r[end]) : NaN;
      r.lama_sum = isNaN(lama) ? 0 : lama;
      r.lama_n = isNaN(lama) ? 0 : 1;
      r.lama_val = isNaN(lama) ? null : lama;
      r.bulan = r.tgl_prakarsa ? r.tgl_prakarsa.slice(0, 7) : '';
      r.berkas = 1;
    });
    var cols = t.columns.concat(['bulan', 'umur']);
    var grain = cfg.SLA_GRAIN.filter(function (c) { return cols.indexOf(c) >= 0; });
    rows.forEach(function (r) { grain.forEach(function (c) { if (c !== 'umur' && (r[c] === null || r[c] === undefined)) r[c] = ''; }); });
    var values = ['berkas', 'nominal_pengajuan', 'nominal_cair', 'lama_sum', 'lama_n'];
    var agg = groupSum(rows, grain, values);
    var extent = {};
    rows.forEach(function (r) {
      if (r.lama_val === null) return;
      var id = JSON.stringify(grain.map(function (k) { return r[k]; }));
      var e = extent[id];
      if (!e) extent[id] = { min: r.lama_val, max: r.lama_val };
      else { if (r.lama_val < e.min) e.min = r.lama_val; if (r.lama_val > e.max) e.max = r.lama_val; }
    });
    agg.forEach(function (g) {
      var e = extent[JSON.stringify(grain.map(function (k) { return g[k]; }))];
      g.lama_min = e ? e.min : null;
      g.lama_max = e ? e.max : null;
    });
    var before = {}; var after = {};
    rows.forEach(function (r) { var k = r.proses || '-'; before[k] = (before[k] || 0) + r.nominal_pengajuan; });
    agg.forEach(function (r) { var k = r.proses || '-'; after[k] = (after[k] || 0) + r.nominal_pengajuan; });
    totals['sla nominal pengajuan'] = {};
    Object.keys(before).forEach(function (k) { totals['sla nominal pengajuan'][k] = [before[k], after[k] || 0]; });
    var snapshot = null;
    if (has('today')) rows.forEach(function (r) { if (r.today && (snapshot === null || r.today > snapshot)) snapshot = r.today; });
    if (snapshot === null) {
      ['today', 'tgl_cair', 'tgl_putusan', 'tgl_prakarsa'].filter(has).forEach(function (c) {
        rows.forEach(function (r) { if (r[c] && (snapshot === null || r[c] > snapshot)) snapshot = r[c]; });
      });
    }
    var payload = encodeTable(agg, grain.concat(values, ['lama_min', 'lama_max']), grain.filter(function (c) { return c !== 'umur'; }), 2);
    out['sla.json'] = payload;
    var dailyGrain = cfg.SLA_DAILY_GRAIN.filter(function (c) { return c === 'tanggal' || c === 'tahap' || cols.indexOf(c) >= 0; });
    var events = [];
    rows.forEach(function (r) {
      if (cfg.SLA_DAILY_SKIP.indexOf(String(r.proses).toLowerCase()) >= 0) return;
      Object.keys(cfg.SLA_DAILY_EVENTS).forEach(function (tahap) {
        var spec = cfg.SLA_DAILY_EVENTS[tahap];
        if (!has(spec[0]) || !r[spec[0]]) return;
        var e = { tanggal: r[spec[0]], tahap: tahap, berkas: 1, nominal: r[spec[1]] || 0 };
        dailyGrain.forEach(function (c) { if (!(c in e)) e[c] = r[c]; });
        events.push(e);
      });
    });
    var daily = groupSum(events, dailyGrain, ['berkas', 'nominal']);
    var dailyPayload = encodeTable(daily, dailyGrain.concat(['berkas', 'nominal']), dailyGrain, 2);
    out['sla_daily.json'] = dailyPayload;
    var days = uniqSorted(daily, 'tanggal');
    var months = uniqSorted(agg, 'bulan').filter(Boolean);
    meta.datasets.sla = Object.assign({}, t.info, {
      sample: false, rows_out: agg.length, bytes: utf8Len(JSON.stringify(payload)), snapshot: snapshot,
      min_month: months.length ? months[0] : null, max_month: months.length ? months[months.length - 1] : null,
      proses: uniqSorted(agg, 'proses'),
      daily_rows: daily.length, daily_bytes: utf8Len(JSON.stringify(dailyPayload)),
      daily_min: days.length ? days[0] : null, daily_max: days.length ? days[days.length - 1] : null,
    });
    log.push('  sla         : ' + t.info.rows_in + ' baris -> ' + agg.length + ' baris (posisi ' + (snapshot || '-') + ')');
  }

  function roReport(meta, log) {
    var perf = (meta.ro.performance || []).filter(function (r) { return r !== 'Nasional'; });
    ['portfolio', 'realisasi'].forEach(function (name) {
      var other = meta.ro[name] || [];
      if (!other.length || !perf.length) return;
      var onlyOther = other.filter(function (r) { return perf.indexOf(r) < 0; }).sort(cmp);
      var onlyPerf = perf.filter(function (r) { return other.indexOf(r) < 0; }).sort(cmp);
      var rep = { tidak_ada_di_performance: onlyOther };
      rep['tidak_ada_di_' + name] = onlyPerf;
      meta.ro_mismatch[name] = rep;
      if (onlyOther.length) log.push('  ! nama RO di ' + name + ' yang tidak ada di performance: ' + JSON.stringify(onlyOther));
    });
  }

  function rawColumn(src, column) {
    if (!src) return [];
    var allow = {}; allow[column] = '__sensitive__';
    var t;
    try { t = readSource(src, allow); } catch (e) { return []; }
    if (t.columns.indexOf('__sensitive__') < 0) return [];
    return t.rows.map(function (r) { return cleanText(r.__sensitive__); }).filter(Boolean);
  }

  function buildAll(sources, opts) {
    var cfg = KPR_CONFIG;
    var log = []; var out = {}; var totals = {};
    var meta = { generated_at: opts.now, is_dummy: !!opts.isDummy, datasets: {}, ro: {}, ro_mismatch: {} };
    try {
      buildPerformance(sources.performance, cfg, out, meta, log);
      buildKuadran(sources.kuadran, cfg, out, meta, log);
      buildPortfolio(sources.portfolio, cfg, out, meta, totals, log);
      buildRealisasi(sources.realisasi, cfg, out, meta, totals, log);
      buildSla(sources.sla, cfg, out, meta, totals, log);
    } catch (e) {
      if (e instanceof PipelineError) return { files: null, meta: meta, log: log, errors: [e.message], notes: [] };
      throw e;
    }
    roReport(meta, log);
    out['meta.json'] = meta;
    var norm = function (v) { return String(v).replace(/\s+/g, ' ').trim().toUpperCase(); };
    var sensitive = {};
    Object.keys(cfg.SENSITIVE_SOURCE_COLUMNS).forEach(function (name) {
      cfg.SENSITIVE_SOURCE_COLUMNS[name].forEach(function (col) {
        rawColumn(sources[name], col).forEach(function (v) { sensitive[norm(v)] = 1; });
      });
    });
    var overlap = {};
    rawColumn(sources.realisasi, 'Nama RM').forEach(function (v) { if (sensitive[norm(v)]) overlap[norm(v)] = 1; });
    var res = KPR_CHECKS.run(out, totals, sensitive, overlap, cfg);
    return { files: res.errors.length ? null : out, meta: meta, log: log, errors: res.errors, notes: res.notes };
  }

  return {
    buildAll: buildAll, readSource: readSource, parseNumber: parseNumber, parseDate: parseDate, parseMonth: parseMonth,
    encodeTable: encodeTable, utf8Len: utf8Len, PipelineError: PipelineError,
  };
})();
