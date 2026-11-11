var KPR_CHECKS = (function () {
  'use strict';

  var norm = function (v) { return String(v).replace(/\s+/g, ' ').trim().toUpperCase(); };

  function walk(node, path, onKey, onStr) {
    if (Array.isArray(node)) {
      node.forEach(function (v, i) { walk(v, path + '[' + i + ']', onKey, onStr); });
    } else if (node && typeof node === 'object') {
      Object.keys(node).forEach(function (k) { onKey(k); walk(node[k], path + '.' + k, onKey, onStr); });
    } else if (typeof node === 'string') {
      onStr(node, path);
    }
  }

  function checkFiles(files, sensitive, overlap, cfg) {
    var errors = []; var notes = [];
    var forbidden = cfg.FORBIDDEN_FIELD_PATTERNS.map(function (p) { return new RegExp(p, 'i'); });
    var longDigits = new RegExp(cfg.LONG_DIGIT_PATTERN);
    var paths = Object.keys(files).sort();
    if (!paths.length) return { errors: ['Tidak ada file hasil.'], notes: notes };
    paths.forEach(function (rel) {
      var fields = {}; var hitS = {}; var hitC = {}; var hitO = {}; var hitD = {};
      var category = {}; (cfg.CATEGORY_FIELDS || []).forEach(function (f) { category[f] = 1; });
      walk(files[rel], '$', function (k) { fields[k] = 1; }, function (text, path) {
        if (/\.fields\[\d+\]$/.test(path)) fields[text] = 1;
        if (/\.generated_at$/.test(path)) return;
        var key = norm(text);
        if (sensitive[key]) {
          var m = /\.dicts\.([A-Za-z0-9_]+)\[\d+\]$/.exec(path);
          var field = m ? m[1] : path;
          var bucket = overlap[key] ? hitO : category[field] ? hitC : hitS;
          if (bucket === hitO) hitO[text] = 1;
          else { bucket[field] = bucket[field] || {}; bucket[field][text] = 1; }
        }
        if (longDigits.test(text.replace(/[-.]/g, '')) && !/^\d{4}-\d{2}(-\d{2})?$/.test(text)) hitD[text] = 1;
      });
      Object.keys(fields).forEach(function (name) {
        forbidden.forEach(function (rx) {
          if (rx.test(name)) errors.push(rel + ': nama field terlarang \'' + name + '\' (pola ' + rx.source + ').');
        });
      });
      var count = function (b) { return Object.keys(b).reduce(function (t, f) { return t + Object.keys(b[f]).length; }, 0); };
      var nS = count(hitS); var nC = count(hitC); var nO = Object.keys(hitO).length; var nD = Object.keys(hitD).length;
      if (nS) errors.push(rel + ': ' + nS + ' nilai dari kolom data nasabah ikut terbawa ke output (di kolom ' + Object.keys(hitS).sort().join(', ') + ').');
      if (nC) notes.push(rel + ': ' + nC + ' isi kategori di kolom ' + Object.keys(hitC).sort().join(', ') + ' kebetulan sama dengan isi kolom Nama Debitur (dibiarkan, karena itu nama kategori, bukan nama orang).');
      if (nO) notes.push(rel + ': ' + nO + ' nama RM kebetulan sama dengan nama debitur (dibiarkan, karena memang nama RM).');
      if (nD) errors.push(rel + ': ' + nD + ' teks berisi angka panjang (>=10 digit), mirip nomor rekening/NIK.');
    });
    return { errors: errors, notes: notes };
  }

  function checkTotals(totals) {
    var errors = [];
    Object.keys(totals).forEach(function (ds) {
      Object.keys(totals[ds]).forEach(function (period) {
        var before = totals[ds][period][0]; var after = totals[ds][period][1];
        var tol = Math.max(1e-6, Math.abs(before) * 1e-9);
        if (Math.abs(before - after) > tol) errors.push(ds + ' ' + period + ': total berubah setelah agregasi (' + before + ' -> ' + after + ').');
      });
    });
    return errors;
  }

  function run(files, totals, sensitive, overlap, cfg) {
    var res = checkFiles(files, sensitive, overlap, cfg);
    return { errors: res.errors.concat(checkTotals(totals || {})), notes: res.notes };
  }

  return { run: run };
})();
