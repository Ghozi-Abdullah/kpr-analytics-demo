import { ok, ratio } from '../core/values.js';
import { esc } from '../core/format.js';
import { weekday, shiftMonth } from '../core/dates.js';
import { SLA_STAGES, SLA_TARGET_HARI, SLA_FLOW_NEXT } from '../config.js';
import { tally, byStage, groupTally, activeRows, hasAge, isLate, stageById, ACTIVE_STAGES, shiftDay } from '../models/sla-model.js';
import { rp, pct, signedPct, num, listJoin, roName, monthName, monthYear, dateText, dateShort, sum } from '../analytics/wording.js';

const b = (t) => `<b>${t}</b>`;
const cap = (s) => String(s).replace(/^((?:<[^>]+>)*)(\p{Ll})/u, (m, tags, ch) => tags + ch.toUpperCase());
const LATE = `lebih dari ${SLA_TARGET_HARI} hari`;
const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const EVENT = { prakarsa: 'prakarsa baru', analisa: 'berkas masuk analisa', putusan: 'berkas diputus', cair: 'berkas cair' };
const STAGE_NOTE = { prakarsa: 'sedang diprakarsai', analisa: 'sedang dianalisa', putusan: 'sudah diputus, menunggu cair', cair: 'sudah cair' };
const label = (id) => stageById(id)?.label || id;
const lower = (id) => label(id).toLowerCase();

export function dur(v) {
  if (!ok(v)) return '–';
  const hours = Math.round(Math.max(0, v) * 24);
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  if (!d && !h) return 'kurang dari 1 jam';
  return [d ? `${d} hari` : '', h ? `${h} jam` : ''].filter(Boolean).join(' ');
}

const putusanValue = (S, id) => S.putusan.find((p) => (id === 'clf' ? /clf/i : /cabang/i).test(p)) || '';
const pendapatanValue = (S, fi) => S.pendapatan.find((p) => (fi === 'NFI') === /^non/i.test(p)) || '';
const putusanLabel = (v) => String(v || '').replace(/^Putusan\s+/i, 'putusan ');

function selOf(q, D, kit) {
  const S = D.sla;
  const ros = kit.rosOf(q, D).filter((r) => S.ros.includes(r));
  const fi = q.manyOf === 'fiList' ? null : q.entities.fi;
  const putusan = q.manyOf === 'putusan' || q.sla.putusan.length !== 1 ? '' : putusanValue(S, q.sla.putusan[0]);
  return { ros, kancas: q.entities.kanca.slice(), pendapatan: fi ? pendapatanValue(S, fi) : '', putusan, bulan: '', prov: q.entities.prov.slice() };
}

function scoped(S, sel, rows = S.rows) {
  return rows.filter((r) => (!sel.ros.length || sel.ros.includes(r.ro))
    && (!sel.kancas.length || sel.kancas.includes(r.kanca))
    && (!sel.pendapatan || r.pendapatan === sel.pendapatan)
    && (!sel.putusan || r.putusan === sel.putusan)
    && (!sel.bulan || r.bulan === sel.bulan));
}

function whereOf(sel, kit) {
  const parts = [];
  if (sel.kancas.length) parts.push(listJoin(sel.kancas.map(esc)));
  else if (sel.prov.length) parts.push(`${listJoin(sel.prov.map(kit.provinceLabel))}${sel.ros.length ? ` (RO ${listJoin(sel.ros.map(roName))})` : ''}`);
  else if (sel.ros.length) parts.push(listJoin(sel.ros.map(roName)));
  if (sel.pendapatan) parts.push(`debitur ${esc(sel.pendapatan)}`);
  if (sel.putusan) parts.push(esc(putusanLabel(sel.putusan)));
  return parts.join(', ') || 'Nasional';
}

const asOf = (S) => dateText(S.snapshot || S.dayMax);
const one = (list) => (list.length === 1 ? list[0] : '');
const linkSla = (sel, widget, extra = {}) => ({
  view: 'sla', params: { ro: one(sel.ros), kanca: one(sel.kancas), pendapatan: sel.pendapatan, putusan: sel.putusan, bulan: sel.bulan, ...extra }, widget, label: 'Buka di SLA',
});

function chaseList(rows, limit = 3) {
  const g = [...groupTally(rows.filter(isLate), 'kanca')].filter(([k]) => k).sort((a, c) => c[1].berkas - a[1].berkas || (c[1].umurMax ?? 0) - (a[1].umurMax ?? 0));
  return g.slice(0, limit).map(([k, t]) => `${esc(k)} (${num(t.berkas)})`);
}

function oldest(rows) {
  let best = null;
  for (const r of rows) if (hasAge(r) && (!best || r.umur > best.umur)) best = r;
  return best;
}

function verdict(onTime, where = '') {
  if (!ok(onTime)) return '';
  if (onTime >= 0.9) return `Proses berkas sehat: ${pct(onTime, 0)} berkas masih dalam batas ${SLA_TARGET_HARI} hari.`;
  if (onTime >= 0.75) return `Masih wajar, tetapi ada antrean yang mulai menua${where ? `, terutama di ${where}` : ''}. Kejar berkas yang paling lama lebih dulu.`;
  return `Banyak berkas tertahan${where ? ` di ${where}` : ''}: hanya ${pct(onTime, 0)} yang masih dalam SLA. Ini perlu ditindaklanjuti.`;
}

function dailyRows(S, sel, from, to) {
  return S.daily.filter((r) => r.tanggal >= from && r.tanggal <= to
    && (!sel.ros.length || sel.ros.includes(r.ro))
    && (!sel.kancas.length || sel.kancas.includes(r.kanca))
    && (!sel.pendapatan || r.pendapatan === sel.pendapatan)
    && (!sel.putusan || r.putusan === sel.putusan));
}

function eventTotals(rows) {
  const out = Object.fromEntries(SLA_STAGES.map((s) => [s.id, { berkas: 0, nominal: 0 }]));
  for (const r of rows) if (out[r.tahap]) { out[r.tahap].berkas += r.berkas || 0; out[r.tahap].nominal += r.nominal || 0; }
  return out;
}

function flowLine(S, sel, id) {
  const next = SLA_FLOW_NEXT[id];
  if (!next || !S.dayMax) return '';
  const from = shiftDay(S.dayMax, -6);
  const ev = eventTotals(dailyRows(S, sel, from, S.dayMax));
  const inn = ev[id].berkas;
  const out = ev[next].berkas;
  if (!inn && !out) return '';
  const trend = inn > out * 1.15 ? 'antrean cenderung bertambah' : out > inn * 1.15 ? 'antrean cenderung berkurang' : 'antrean relatif stabil';
  return `7 hari terakhir: ${num(inn)} berkas masuk tahap ${label(id)}, ${num(out)} lanjut ke tahap ${label(next)}; ${trend}.`;
}

function snapshotNote(q, S) {
  if (!q.time?.kind || ['latest', 'today'].includes(q.time.kind)) return '';
  return `Status SLA selalu posisi terakhir (${asOf(S)}), jadi periode "${esc(q.time.label || '')}" tidak dipakai. Untuk jumlah berkas masuk atau cair per periode, tanyakan misalnya "berapa berkas cair bulan ini".`;
}

function chips(list) { return list.filter((c) => c && c[1]).map(([k, v]) => ({ k, v })); }

function overview(q, D, kit, sel) {
  const S = D.sla;
  const rows = scoped(S, sel);
  const st = byStage(rows);
  const act = activeRows(rows);
  const run = tally(act);
  const where = whereOf(sel, kit);
  const aged = run.ok + run.late;
  const m = q.sla.metric;
  let title;
  if (m === 'ontime' || m === 'sla') title = `Kepatuhan SLA ${where} ${b(pct(run.onTime, 1))}: ${num(run.ok)} dari ${num(aged)} berkas berjalan masih paling lama ${SLA_TARGET_HARI} hari di tahapnya.`;
  else if (m === 'late') title = run.late ? `${b(`${num(run.late)} berkas`)} ${where} lewat SLA (sudah ${LATE} di tahapnya), ${pct(ratio(run.late, aged), 1)} dari berkas berjalan.` : `Tidak ada berkas ${where} yang lewat SLA: semua ${num(aged)} berkas berjalan masih paling lama ${SLA_TARGET_HARI} hari di tahapnya.`;
  else if (m === 'umur') title = `Umur rata-rata berkas berjalan ${where} ${b(dur(run.umurAvg))}, terlama ${b(dur(run.umurMax))}.`;
  else if (m === 'nominal') title = `Nominal pengajuan berkas berjalan ${where} ${b(rp(run.nominal))} dari ${num(run.berkas)} berkas.`;
  else title = `${b(`${num(run.berkas)} berkas`)} ${where} masih berjalan, ${b(num(run.late))} di antaranya lewat SLA (${pct(ratio(run.late, aged), 1)}).`;
  const lines = [];
  const cair = st.get('cair');
  lines.push(`${ACTIVE_STAGES.map((s) => { const t = st.get(s.id); return `${s.label} ${num(t.berkas)}${t.late ? ` (${num(t.late)} lewat SLA)` : ''}`; }).join(', ')}; sudah cair ${num(cair.berkas)} berkas (${rp(cair.cair)}).`);
  const worst = ACTIVE_STAGES.map((s) => ({ s, t: st.get(s.id) })).filter((x) => x.t.late > 0).sort((a, c) => c.t.late - a.t.late)[0];
  if (worst) lines.push(`Paling banyak tertahan di tahap ${b(worst.s.label)}: ${num(worst.t.late)} berkas lewat SLA, umur rata-rata ${dur(worst.t.umurAvg)}.`);
  if (sel.kancas.length !== 1) {
    const chase = chaseList(act);
    if (chase.length) lines.push(`Paling perlu dikejar: ${listJoin(chase)}.`);
  }
  const old = oldest(act);
  if (old && old.umur > SLA_TARGET_HARI) lines.push(`Berkas paling lama: ${dur(old.umur)} di tahap ${lower(old.stage)}, ${esc(old.kanca)}.`);
  if (!sel.pendapatan && S.pendapatan.length > 1) {
    const g = [...groupTally(act, 'pendapatan')].filter(([k, t]) => k && ok(t.onTime));
    if (g.length > 1) lines.push(`Kepatuhan per jenis pendapatan: ${listJoin(g.map(([k, t]) => `${esc(k)} ${pct(t.onTime, 1)}`))}.`);
  }
  const note = snapshotNote(q, S);
  if (note) lines.push(note);
  return {
    ok: true, title: cap(title), lines,
    meaning: verdict(run.onTime, worst ? `tahap ${worst.s.label}` : ''),
    list: { items: ACTIVE_STAGES.map((s, i) => { const t = st.get(s.id); return { rank: i + 1, key: s.id, label: s.label, v: t.berkas, text: `${num(t.berkas)} berkas`, sub: `${num(t.late)} lewat SLA` }; }), dir: 'desc', abs: true },
    chips: chips([['Metrik', 'proses berkas (SLA)'], ['Wilayah', where], ['Posisi', asOf(S)], ['Batas', `${SLA_TARGET_HARI} hari per tahap`], ['Sumber', 'SLA'], ...kit.fixChips(q)]),
    link: linkSla(sel, 'flow'),
    followups: ['Kanca dengan berkas lewat SLA terbanyak', 'Tahap mana paling banyak tertahan?', 'Rata-rata lama prakarsa sampai cair', 'Berapa berkas cair bulan ini?'],
  };
}

function cairAnswer(q, D, kit, sel) {
  const S = D.sla;
  const P = q.time?.kind && !['latest', 'today'].includes(q.time.kind) ? kit.resolvePeriod(q.time, D, 'sla') : null;
  if (P && P.months.length === 1) sel.bulan = P.month;
  const rows = scoped(S, sel).filter((r) => r.stage === 'cair');
  const t = tally(rows);
  const where = whereOf(sel, kit);
  const scope = sel.bulan ? ` (berkas yang diprakarsai ${monthYear(sel.bulan)})` : '';
  if (!t.berkas) return { ok: false, title: `Belum ada berkas cair untuk ${where}${scope}.` };
  const lama = q.sla.metric === 'lama' || q.sla.metric === 'umur';
  const title = lama
    ? `Rata-rata prakarsa sampai cair ${where}${scope} ${b(dur(t.lamaAvg))}; tercepat ${dur(t.lamaMin)}, terlama ${dur(t.lamaMax)}.`
    : `${b(`${num(t.berkas)} berkas`)} ${where}${scope} sudah cair, nominal cair ${b(rp(t.cair))}.`;
  const lines = [];
  if (lama) lines.push(`Dihitung dari ${num(t.lamaN)} berkas yang sudah cair, nominal cair ${rp(t.cair)}.`);
  else lines.push(`Prakarsa sampai cair rata-rata ${b(dur(t.lamaAvg))}, tercepat ${dur(t.lamaMin)}, terlama ${dur(t.lamaMax)}.`);
  if (!sel.putusan && S.putusan.length > 1) {
    const g = [...groupTally(rows, 'putusan')].filter(([k, x]) => k && ok(x.lamaAvg));
    if (g.length > 1) lines.push(`Per jenis putusan: ${listJoin(g.map(([k, x]) => `${esc(putusanLabel(k))} ${dur(x.lamaAvg)}`))}.`);
  }
  if (!sel.pendapatan && S.pendapatan.length > 1) {
    const g = [...groupTally(rows, 'pendapatan')].filter(([k, x]) => k && ok(x.lamaAvg));
    if (g.length > 1) lines.push(`Per jenis pendapatan: ${listJoin(g.map(([k, x]) => `${esc(k)} ${dur(x.lamaAvg)}`))}.`);
  }
  const dim = sel.kancas.length ? null : sel.ros.length === 1 ? 'kanca' : 'ro';
  if (dim) {
    const g = [...groupTally(rows, dim)].filter(([k, x]) => k && x.lamaN >= 5 && ok(x.lamaAvg)).sort((a, c) => c[1].lamaAvg - a[1].lamaAvg);
    if (g.length > 2) {
      const name = (k) => (dim === 'ro' ? roName(k) : esc(k));
      lines.push(`Paling lama: ${name(g[0][0])} (${dur(g[0][1].lamaAvg)}); paling cepat: ${name(g.at(-1)[0])} (${dur(g.at(-1)[1].lamaAvg)}).`);
    }
  }
  const avgAll = tally(S.rows.filter((r) => r.stage === 'cair')).lamaAvg;
  const meaning = where !== 'Nasional' && ok(avgAll) && ok(t.lamaAvg)
    ? `${t.lamaAvg > avgAll * 1.1 ? 'Lebih lambat' : t.lamaAvg < avgAll * 0.9 ? 'Lebih cepat' : 'Setara'} dibanding rata-rata nasional ${dur(avgAll)}.`
    : '';
  return {
    ok: true, title: cap(title), lines, meaning,
    chips: chips([['Metrik', lama ? 'lama prakarsa sampai cair' : 'berkas cair'], ['Wilayah', where], ['Posisi', asOf(S)], ['Sumber', 'SLA'], ...kit.fixChips(q)]),
    link: linkSla(sel, 'flow', { tahap: 'cair' }),
    followups: ['Kanca mana paling lama prakarsa sampai cair?', 'Berapa berkas cair bulan ini?', 'Putusan CLF vs putusan cabang'],
  };
}

function stageAnswer(q, D, kit, sel, ids) {
  const S = D.sla;
  if (ids.length === 1 && ids[0] === 'cair') return cairAnswer(q, D, kit, sel);
  const all = scoped(S, sel);
  const rows = all.filter((r) => ids.includes(r.stage));
  const t = tally(rows);
  const where = whereOf(sel, kit);
  const name = ids.length === 1 ? `tahap ${label(ids[0])}` : `tahap ${listJoin(ids.map(label))}`;
  const m = q.sla.metric;
  const aged = t.ok + t.late;
  let title;
  if (ids.length > 1 && (m === 'berkas' || !m || m === 'stuck')) {
    const per = byStage(rows);
    title = `${b(`${num(t.berkas)} berkas`)} ${where} ${ids.join() === 'prakarsa,analisa' ? 'belum diputus' : 'belum cair'}: ${listJoin(ids.map((id) => `${lower(id)} ${num(per.get(id).berkas)}`))}.`;
  } else if (m === 'late') title = t.late ? `${b(`${num(t.late)} berkas`)} di ${name} ${where} lewat SLA, ${pct(ratio(t.late, aged), 1)} dari ${num(aged)} berkas.` : `Tidak ada berkas di ${name} ${where} yang lewat SLA (${num(aged)} berkas, semua masih paling lama ${SLA_TARGET_HARI} hari).`;
  else if (m === 'ontime' || m === 'sla') title = `Kepatuhan SLA ${name} ${where} ${b(pct(t.onTime, 1))}: ${num(t.ok)} tepat SLA, ${num(t.late)} lewat SLA.`;
  else if (m === 'umur') title = `Umur rata-rata berkas di ${name} ${where} ${b(dur(t.umurAvg))}; tercepat ${dur(t.umurMin)}, terlama ${b(dur(t.umurMax))}.`;
  else if (m === 'nominal') title = `Nominal pengajuan di ${name} ${where} ${b(rp(t.nominal))} dari ${num(t.berkas)} berkas.`;
  else title = `${cap(name)} ${where}: ${b(`${num(t.berkas)} berkas`)} ${ids.length === 1 ? STAGE_NOTE[ids[0]] : ''}, ${b(num(t.late))} lewat SLA.`;
  const lines = [];
  if (m !== 'late' && m !== 'ontime' && m !== 'sla') lines.push(`Tepat SLA ${num(t.ok)}, lewat SLA ${num(t.late)} (kepatuhan ${pct(t.onTime, 1)}).`);
  if (m !== 'umur') lines.push(`Umur rata-rata ${dur(t.umurAvg)}, terlama ${dur(t.umurMax)}.`);
  if (m !== 'nominal') lines.push(`Nominal pengajuan ${rp(t.nominal)}.`);
  if (sel.kancas.length !== 1) {
    const chase = chaseList(rows);
    if (chase.length) lines.push(`Kanca dengan berkas lewat SLA terbanyak di ${name}: ${listJoin(chase)}.`);
  }
  if (ids.length === 1) {
    const f = flowLine(S, sel, ids[0]);
    if (f) lines.push(f);
  }
  const note = snapshotNote(q, S);
  if (note) lines.push(note);
  const nat = tally(S.rows.filter((r) => ids.includes(r.stage)));
  const vs = where !== 'Nasional' && ok(nat.onTime) && ok(t.onTime) ? ` Nasional di ${name}: ${pct(nat.onTime, 1)}.` : '';
  return {
    ok: true, title: cap(title), lines, meaning: `${verdict(t.onTime, '')}${vs}`.trim(),
    chips: chips([['Tahap', listJoin(ids.map(label))], ['Wilayah', where], ['Posisi', asOf(S)], ['Batas', `${SLA_TARGET_HARI} hari`], ['Sumber', 'SLA'], ...kit.fixChips(q)]),
    link: linkSla(sel, 'flow', { tahap: ids.length === 1 ? ids[0] : '' }),
    followups: [`Kanca mana paling lambat di ${name}?`, `Berapa berkas di ${name} lebih dari ${SLA_TARGET_HARI} hari?`, 'Berapa berkas lewat SLA?'],
  };
}

const DIM_KEY = { ro: 'ro', kanca: 'kanca', fi: 'pendapatan', putusan: 'putusan' };
const DIM_WORD = { ro: 'RO', kanca: 'kanca', fi: 'jenis pendapatan', putusan: 'jenis putusan', tahap: 'tahap' };

function metricSpec(m, useMax) {
  switch (m) {
    case 'late': return { get: (t) => t.late, text: (t) => `${num(t.late)} berkas`, sub: (t) => `dari ${num(t.berkas)} berjalan`, better: 'down', additive: true, word: 'berkas lewat SLA', min: () => true };
    case 'ontime': case 'sla': return { get: (t) => t.onTime, text: (t) => pct(t.onTime, 1), sub: (t) => `${num(t.late)} lewat dari ${num(t.ok + t.late)}`, better: 'up', word: 'kepatuhan SLA', min: (t, dim) => t.ok + t.late >= (dim === 'kanca' ? 3 : 5) };
    case 'umur': return useMax
      ? { get: (t) => t.umurMax, text: (t) => dur(t.umurMax), sub: (t) => `${num(t.berkas)} berkas`, better: 'down', word: 'umur berkas terlama', min: (t) => t.umurN >= 1 }
      : { get: (t) => t.umurAvg, text: (t) => dur(t.umurAvg), sub: (t) => `${num(t.berkas)} berkas, terlama ${dur(t.umurMax)}`, better: 'down', word: 'umur rata-rata berkas', min: (t, dim) => t.umurN >= (dim === 'kanca' ? 2 : 3) };
    case 'lama': return { get: (t) => t.lamaAvg, text: (t) => dur(t.lamaAvg), sub: (t) => `${num(t.lamaN)} berkas cair`, better: 'down', word: 'lama prakarsa sampai cair', min: (t, dim) => t.lamaN >= (dim === 'kanca' ? 5 : 10) };
    case 'nominal': return { get: (t) => t.nominal, text: (t) => rp(t.nominal), sub: (t) => `${num(t.berkas)} berkas`, better: 'up', additive: true, word: 'nominal pengajuan', min: () => true };
    default: return { get: (t) => t.berkas, text: (t) => `${num(t.berkas)} berkas`, sub: (t) => (t.late ? `${num(t.late)} lewat SLA` : ''), better: 'up', additive: true, word: 'jumlah berkas', min: () => true };
  }
}

function rankAnswer(q, D, kit, sel) {
  const S = D.sla;
  let m = q.sla.metric === 'stuck' ? 'berkas' : q.sla.metric;
  if (!m) m = q.speed ? 'umur' : q.order === 'worst' || q.order === 'best' ? 'ontime' : 'berkas';
  if (m === 'sla') m = 'ontime';
  const dim = q.groupBy === 'tahap' || DIM_KEY[q.groupBy] ? q.groupBy : 'kanca';
  const useMax = m === 'umur' && /\b(terlama|paling lama)\b/.test(q.norm) && !/\brata\b/.test(q.norm);
  const M = metricSpec(m, useMax);
  const ids = q.sla.stages;
  const all = scoped(S, sel);
  let base;
  if (m === 'lama') base = all.filter((r) => r.stage === 'cair');
  else if (ids.length) base = all.filter((r) => ids.includes(r.stage));
  else if (dim === 'tahap' && m === 'berkas' && !q.sla.stuck && !q.sla.status) base = all;
  else base = activeRows(all);
  let groups;
  if (dim === 'tahap') {
    const st = byStage(base);
    groups = SLA_STAGES.filter((s) => base.some((r) => r.stage === s.id)).map((s) => [s.id, st.get(s.id)]);
  } else groups = [...groupTally(base, DIM_KEY[dim])].filter(([k]) => k);
  const nameOf = (k) => (dim === 'tahap' ? label(k) : dim === 'ro' ? roName(k) : esc(dim === 'putusan' ? putusanLabel(k) : k));
  const items = groups.filter(([, t]) => M.min(t, dim) && ok(M.get(t))).map(([k, t]) => ({ key: k, label: nameOf(k), v: M.get(t), text: M.text(t), sub: M.sub(t), t }));
  if (!items.length) return { ok: false, title: `Belum ada data ${M.word} yang cukup untuk diurutkan per ${DIM_WORD[dim]}.` };
  let dir = 'desc';
  if (q.speed) dir = q.speed === 'slow' ? 'desc' : 'asc';
  else if (q.order === 'best') dir = M.better === 'down' ? 'asc' : 'desc';
  else if (q.order === 'worst') dir = M.better === 'down' ? 'desc' : 'asc';
  else if (q.order === 'asc') dir = 'asc';
  const sorted = items.sort((a, c) => (dir === 'asc' ? a.v - c.v : c.v - a.v) || c.t.berkas - a.t.berkas);
  const n = Math.min(q.topN || (dim === 'tahap' || dim === 'fi' || dim === 'putusan' ? sorted.length : 5), sorted.length, 25);
  const top = sorted.slice(0, n);
  const lead = top[0];
  const where = whereOf(sel, kit);
  const stageText = ids.length ? ` di tahap ${listJoin(ids.map(label))}` : '';
  const total = M.additive ? sum(items.map((x) => x.v)) : null;
  const pipeline = dim === 'tahap' && m === 'berkas' && !q.sla.stuck && base.some((r) => r.stage === 'cair');
  const share = q.intent === 'share' && total && !pipeline;
  let title;
  if (m === 'late' && lead.v === 0) {
    const busiest = [...items].sort((a, c) => c.t.berkas - a.t.berkas)[0];
    title = `Tidak ada ${DIM_WORD[dim]}${where !== 'Nasional' ? ` di ${where}` : ''} dengan berkas lewat SLA${stageText}. Berkas berjalan terbanyak di ${b(busiest.label)} (${num(busiest.t.berkas)} berkas).`;
  } else if (pipeline) {
    const st = byStage(base);
    const run = tally(activeRows(base));
    title = `${b(`${num(run.berkas)} berkas`)} ${where} masih berjalan: ${listJoin(ACTIVE_STAGES.map((s) => `${s.label} ${b(num(st.get(s.id).berkas))}`))}. Yang sudah cair ${num(st.get('cair').berkas)} berkas.`;
  } else if (share) title = `Porsi ${M.word}${stageText} ${where} per ${DIM_WORD[dim]}: terbesar ${b(lead.label)} ${b(pct(ratio(lead.v, total), 1))} (${lead.text}) dari total ${M.text({ ...lead.t, berkas: total, late: total, nominal: total })}.`;
  else if (dim === 'tahap' && m === 'berkas') title = `Tahap ${b(lead.label)} ${dir === 'desc' ? 'paling banyak' : 'paling sedikit'} ${q.sla.stuck ? 'menahan berkas' : 'berisi berkas'}: ${b(lead.text)}${lead.t.late ? `, ${num(lead.t.late)} di antaranya lewat SLA` : ''}.`;
  else if (useMax) title = `Berkas paling lama ada di ${b(lead.label)}: ${b(lead.text)}${(() => { const o = oldest(base.filter((r) => (dim === 'tahap' ? r.stage === lead.key : r[DIM_KEY[dim]] === lead.key))); return o ? ` di tahap ${lower(o.stage)}` : ''; })()}.`;
  else if (m === 'late') title = `${b(lead.label)} ${dir === 'desc' ? 'paling banyak' : 'paling sedikit'} berkas lewat SLA${stageText}: ${b(lead.text)} ${lead.sub}.`;
  else if (m === 'ontime') title = `${b(lead.label)} kepatuhan SLA${stageText} ${dir === 'asc' ? 'terendah' : 'tertinggi'}: ${b(lead.text)} (${lead.sub}).`;
  else if (m === 'umur') title = `${b(lead.label)} ${dir === 'desc' ? 'paling lambat' : 'paling cepat'}${stageText}: umur rata-rata ${b(lead.text)} (${lead.sub}).`;
  else if (m === 'lama') title = `${b(lead.label)} ${dir === 'desc' ? 'paling lama' : 'paling cepat'} prakarsa sampai cair: rata-rata ${b(lead.text)} (${lead.sub}).`;
  else title = `${b(lead.label)} mencatat ${M.word}${stageText} ${dir === 'desc' ? 'terbesar' : 'terkecil'}: ${b(lead.text)}.`;
  const lines = [];
  const allT = tally(base);
  if (!share) {
    if (m === 'late') lines.push(`Total ${num(allT.late)} berkas lewat SLA${stageText} ${where}; ${num(items.filter((x) => x.v > 0).length)} dari ${num(groups.length)} ${DIM_WORD[dim]} punya berkas lewat SLA.`);
    else if (m === 'ontime') lines.push(`Kepatuhan ${where}${stageText} ${pct(allT.onTime, 1)}.`);
    else if (m === 'umur' && useMax) {
      const over7 = sum(base.filter((r) => hasAge(r) && r.umur > 7).map((r) => r.berkas || 0));
      lines.push(`Batas SLA ${SLA_TARGET_HARI} hari; ${num(allT.late)} berkas sudah lewat SLA${over7 ? `, ${num(over7)} di antaranya lebih dari 7 hari` : ''}.`);
    } else if (m === 'umur') lines.push(`Rata-rata ${where}${stageText} ${dur(allT.umurAvg)}; batas SLA ${SLA_TARGET_HARI} hari.`);
    else if (m === 'lama') lines.push(`Rata-rata ${where} ${dur(allT.lamaAvg)}.`);
    else if (total) lines.push(`Total ${M.text({ ...allT })} ${where}${stageText}.`);
  }
  if (!M.additive && items.length < groups.length) lines.push(`Hanya ${DIM_WORD[dim]} dengan jumlah berkas cukup yang diurutkan, supaya rata-rata tidak menyesatkan.`);
  const note = m !== 'lama' ? snapshotNote(q, S) : '';
  if (note) lines.push(note);
  const widget = dim === 'tahap' ? 'flow' : dim === 'fi' ? 'income' : dim === 'putusan' ? 'putusan' : 'kanca';
  return {
    ok: true, title: cap(title), lines,
    list: { items: top.map((x, i) => ({ ...x, rank: i + 1, text: share ? `${pct(ratio(x.v, total), 1)} (${x.text})` : x.text })), dir, abs: true },
    chips: chips([['Metrik', M.word], ['Per', DIM_WORD[dim]], ['Wilayah', where], ['Posisi', asOf(S)], ['Sumber', 'SLA'], ...kit.fixChips(q)]),
    link: linkSla(sel, widget, { kanca: dim === 'kanca' && top.length ? '' : one(sel.kancas), tahap: ids.length === 1 ? ids[0] : '' }),
    followups: dim === 'kanca'
      ? [`SLA ${lead.label.replace(/<[^>]+>/g, '')}`, 'Tahap mana paling banyak tertahan?', 'RO mana kepatuhan SLA terendah?']
      : ['Kanca dengan berkas lewat SLA terbanyak', 'Berapa berkas lewat SLA?', 'Rata-rata lama prakarsa sampai cair'],
  };
}

function filterAnswer(q, D, kit, sel) {
  const S = D.sla;
  const th = q.threshold;
  const where = whereOf(sel, kit);
  const ids = q.sla.stages;
  const all = scoped(S, sel);
  const daysMode = th.unit === 'hari' || (!q.groupBy && th.unit !== '%' && th.unit !== 'berkas');
  if (daysMode) {
    const rows = (ids.length ? all.filter((r) => ids.includes(r.stage)) : activeRows(all)).filter(hasAge);
    const hit = rows.filter((r) => (th.op === '>' ? r.umur > th.value : r.umur < th.value));
    const n = sum(hit.map((r) => r.berkas || 0));
    const total = sum(rows.map((r) => r.berkas || 0));
    const stageText = ids.length ? ` di tahap ${listJoin(ids.map(label))}` : '';
    const lines = [];
    if (!ids.length) {
      const per = byStage(hit);
      lines.push(`Per tahap: ${ACTIVE_STAGES.map((s) => `${s.label} ${num(per.get(s.id).berkas)}`).join(', ')}.`);
    }
    const g = [...groupTally(hit, 'kanca')].filter(([k]) => k).sort((a, c) => c[1].berkas - a[1].berkas);
    if (th.op === '>' && th.value >= SLA_TARGET_HARI) lines.push(th.value === SLA_TARGET_HARI ? `Ini sama dengan berkas lewat SLA (batas ${SLA_TARGET_HARI} hari).` : `Semua berkas ini sudah lewat SLA ${SLA_TARGET_HARI} hari.`);
    return {
      ok: true,
      title: `${b(`${num(n)} berkas`)}${stageText} ${where} sudah ${th.op === '>' ? 'lebih dari' : 'kurang dari'} ${num(th.value)} hari di tahapnya, dari ${num(total)} berkas berjalan.`,
      lines,
      list: g.length ? { items: g.slice(0, 10).map(([k, t], i) => ({ rank: i + 1, key: k, label: esc(k), v: t.berkas, text: `${num(t.berkas)} berkas`, sub: `terlama ${dur(t.umurMax)}` })), dir: 'desc', abs: true } : null,
      chips: chips([['Syarat', `umur ${th.op} ${th.value} hari`], ['Wilayah', where], ['Posisi', asOf(S)], ['Sumber', 'SLA'], ...kit.fixChips(q)]),
      link: linkSla(sel, 'kanca', { tahap: ids.length === 1 ? ids[0] : '' }),
      followups: ['Kanca dengan berkas lewat SLA terbanyak', 'Umur berkas terlama'],
    };
  }
  const R = rankAnswer({ ...q, intent: 'rank', topN: 25, order: th.op === '>' ? 'desc' : 'asc', speed: null }, D, kit, sel);
  if (!R.ok) return R;
  const items = R.list.items.filter((x) => {
    const v = th.unit === '%' ? x.v : x.v;
    return th.op === '>' ? v > th.value : v < th.value;
  });
  const thText = th.unit === '%' ? pct(th.value, 0) : num(th.value);
  const word = R.chips.find((c) => c.k === 'Metrik')?.v || 'nilai';
  return {
    ...R,
    title: items.length ? `${b(`${num(items.length)} ${DIM_WORD[q.groupBy] || 'kanca'}`)} ${where !== 'Nasional' ? `di ${where} ` : ''}punya ${word} ${th.op === '>' ? 'di atas' : 'di bawah'} ${thText}.` : `Tidak ada ${DIM_WORD[q.groupBy] || 'kanca'} dengan ${word} ${th.op === '>' ? 'di atas' : 'di bawah'} ${thText}.`,
    list: items.length ? { ...R.list, items: items.map((x, i) => ({ ...x, rank: i + 1 })) } : null,
  };
}

function periodOf(q, D, kit) {
  const t = q.time?.kind ? q.time : { kind: 'today', label: 'hari ini' };
  return kit.resolvePeriod(t, D, 'sla');
}

function workAvg(S, sel, end, id, days = 28) {
  const from = shiftDay(end, -days);
  const to = shiftDay(end, -1);
  const rows = dailyRows(S, sel, from, to).filter((r) => r.tahap === id);
  const by = new Map();
  for (const r of rows) by.set(r.tanggal, (by.get(r.tanggal) || 0) + (r.berkas || 0));
  let n = 0;
  for (let d = from; d <= to; d = shiftDay(d, 1)) if (weekday(d) < 5) n += 1;
  return n ? sum([...by.entries()].filter(([d]) => weekday(d) < 5).map(([, v]) => v)) / n : null;
}

function eventsAnswer(q, D, kit, sel) {
  const S = D.sla;
  const P = periodOf(q, D, kit);
  if (!P) return { ok: false, title: 'Data harian SLA belum tersedia.' };
  if (P.from > S.dayMax || P.to < S.dayMin) return { ok: false, title: `Data harian SLA hanya tersedia dari ${dateText(S.dayMin)} sampai ${dateText(S.dayMax)}. Periode "${esc(P.label)}" di luar rentang itu.` };
  const where = whereOf(sel, kit);
  let ids = q.sla.stages.slice();
  if (!ids.length && /\bmasuk\b/.test(q.norm) && !/masuk analisa/.test(q.norm)) ids = ['prakarsa'];
  const rows = dailyRows(S, sel, P.from, P.to);
  const ev = eventTotals(rows);
  const single = P.from === P.to;
  const lines = [];
  const byDay = new Map();
  for (const r of rows) {
    if (ids.length && !ids.includes(r.tahap)) continue;
    byDay.set(r.tanggal, (byDay.get(r.tanggal) || 0) + (r.berkas || 0));
  }
  const days = [];
  for (let d = P.from; d <= P.to && days.length < 400; d = shiftDay(d, 1)) days.push(d);
  let title;
  if (ids.length === 1) {
    const id = ids[0];
    const e = ev[id];
    title = `${cap(EVENT[id])} ${where} ${P.label}: ${b(`${num(e.berkas)} berkas`)}${e.nominal ? ` (${rp(e.nominal)})` : ''}.`;
    if (single) {
      const wd = weekday(P.from);
      if (!e.berkas) {
        let back = shiftDay(P.from, -1);
        let k = 0;
        while (k < 10 && !dailyRows(S, sel, back, back).some((r) => r.tahap === id && r.berkas > 0)) { back = shiftDay(back, -1); k += 1; }
        if (k < 10) {
          const last = eventTotals(dailyRows(S, sel, back, back))[id];
          lines.push(`${wd >= 5 ? `Tanggal itu hari ${DAY_NAMES[wd]}. ` : ''}Terakhir ada ${EVENT[id]} pada ${DAY_NAMES[weekday(back)]}, ${dateText(back)}: ${num(last.berkas)} berkas.`);
        }
      }
      const avg = workAvg(S, sel, P.from, id);
      if (ok(avg)) lines.push(`Rata-rata per hari kerja 4 minggu sebelumnya: ${num(avg, 1)} berkas.`);
    } else {
      const PR = kit.prevRange(P);
      const prev = eventTotals(dailyRows(S, sel, PR.from, PR.to))[id];
      if (prev.berkas) lines.push(`Dibanding ${PR.label}: ${num(prev.berkas)} berkas (${signedPct(e.berkas / prev.berkas - 1)}).`);
      const work = days.filter((d) => weekday(d) < 5).length;
      if (work) lines.push(`Rata-rata ${num(e.berkas / work, 1)} berkas per hari kerja.`);
      const peak = [...byDay.entries()].sort((a, c) => c[1] - a[1])[0];
      if (peak && days.length > 2) lines.push(`Terbanyak ${DAY_NAMES[weekday(peak[0])]}, ${dateShort(peak[0])} (${num(peak[1])} berkas).`);
    }
    const others = SLA_STAGES.filter((s) => s.id !== id).map((s) => `${EVENT[s.id]} ${num(ev[s.id].berkas)}`);
    lines.push(`Pada periode yang sama: ${listJoin(others)}.`);
  } else {
    title = `Progres berkas ${where} ${P.label}: ${b(num(ev.prakarsa.berkas))} prakarsa baru, ${b(num(ev.analisa.berkas))} masuk analisa, ${b(num(ev.putusan.berkas))} diputus, ${b(num(ev.cair.berkas))} cair.`;
    if (ev.cair.nominal) lines.push(`Nominal cair ${rp(ev.cair.nominal)}${ev.prakarsa.nominal ? `; nominal prakarsa baru ${rp(ev.prakarsa.nominal)}` : ''}.`);
    const gap = ev.prakarsa.berkas - ev.cair.berkas;
    if (ev.prakarsa.berkas || ev.cair.berkas) lines.push(gap > 0 ? `Berkas baru lebih banyak ${num(gap)} dari yang cair, jadi antrean cenderung bertambah.` : gap < 0 ? `Yang cair lebih banyak ${num(-gap)} dari berkas baru, jadi antrean cenderung berkurang.` : 'Berkas baru dan yang cair seimbang.');
    if (single && !rows.length) lines.push(`Tidak ada pergerakan berkas pada ${DAY_NAMES[weekday(P.from)]}, ${dateText(P.from)}.`);
  }
  let spark = null;
  if (!single && days.length <= 62) spark = { labels: days.map((d) => String(Number(d.slice(8, 10)))), values: days.map((d) => byDay.get(d) || 0), fmt: (v) => num(v), bars: true };
  else if (!single) {
    const by = new Map();
    for (const [d, v] of byDay) by.set(d.slice(0, 7), (by.get(d.slice(0, 7)) || 0) + v);
    const ms = [...by.keys()].sort();
    spark = { labels: ms.map((m) => monthName(m).slice(0, 3)), values: ms.map((m) => by.get(m)), fmt: (v) => num(v), bars: true };
  }
  const list = ids.length === 1 ? null : { items: SLA_STAGES.map((s, i) => ({ rank: i + 1, key: s.id, label: cap(EVENT[s.id]), v: ev[s.id].berkas, text: `${num(ev[s.id].berkas)} berkas` })), dir: 'desc', abs: true };
  return {
    ok: true, title, lines,
    ...(list && single ? { list } : spark ? { spark } : list ? { list } : {}),
    chips: chips([['Data', 'pergerakan berkas harian'], ['Wilayah', where], ['Periode', P.label], ['Sumber', 'SLA'], ...kit.fixChips(q)]),
    link: linkSla(sel, 'daily'),
    followups: ['Progres berkas minggu ini', 'Tren berkas cair 6 bulan terakhir', 'Berapa berkas lewat SLA?'],
  };
}

function trendAnswer(q, D, kit, sel) {
  const S = D.sla;
  const where = whereOf(sel, kit);
  const lines = [];
  if (['late', 'ontime', 'umur', 'sla'].includes(q.sla.metric)) lines.push(`Data SLA hanya menyimpan status posisi terakhir (${asOf(S)}), jadi tren ${q.sla.metric === 'umur' ? 'umur berkas' : 'lewat SLA'} per bulan belum bisa dihitung. Di bawah ini tren pergerakan berkas sebagai gambaran beban kerja.`);
  if (q.sla.metric === 'lama') {
    const rows = scoped(S, sel).filter((r) => r.stage === 'cair');
    const g = [...groupTally(rows, 'bulan')].filter(([k, t]) => k && ok(t.lamaAvg)).sort((a, c) => a[0].localeCompare(c[0])).slice(-6);
    if (g.length < 2) return { ok: false, title: 'Data belum cukup untuk melihat tren lama prakarsa sampai cair.' };
    const first = g[0];
    const last = g.at(-1);
    return {
      ok: true,
      title: `Lama prakarsa sampai cair ${where} ${last[1].lamaAvg < first[1].lamaAvg ? 'makin cepat' : last[1].lamaAvg > first[1].lamaAvg ? 'makin lama' : 'stabil'}: dari ${dur(first[1].lamaAvg)} (${monthName(first[0])}) ke ${b(dur(last[1].lamaAvg))} (${monthName(last[0])}).`,
      lines: ['Dikelompokkan menurut bulan prakarsa. Bulan terakhir bisa berubah karena masih ada berkas yang belum cair.'],
      spark: { labels: g.map(([k]) => monthName(k).slice(0, 3)), values: g.map(([, t]) => t.lamaAvg), fmt: (v) => dur(v) },
      chips: chips([['Metrik', 'lama prakarsa sampai cair'], ['Wilayah', where], ['Sumber', 'SLA']]),
      link: linkSla(sel, 'flow', { tahap: 'cair' }),
      followups: ['Kanca mana paling lama prakarsa sampai cair?', 'Putusan CLF vs putusan cabang'],
    };
  }
  const id = q.sla.stages[0] || (/\bcair\b/.test(q.norm) ? 'cair' : 'prakarsa');
  const anchorMonth = S.dayMax.slice(0, 7);
  const t = q.time?.kind ? q.time : { kind: 'lastN', n: 6, unit: 'month' };
  const P = kit.resolvePeriod(t, D, 'sla');
  if (q.grain === 'day' || q.grain === 'week' || (P.months.length === 1 && q.time?.kind)) return eventsAnswer({ ...q, sla: { ...q.sla, stages: [id] } }, D, kit, sel);
  const months = P.months.length > 1 ? P.months : Array.from({ length: 6 }, (_, i) => shiftMonth(P.month, i - 5));
  const rows = dailyRows(S, sel, `${months[0]}-01`, S.dayMax).filter((r) => r.tahap === id);
  const by = new Map();
  for (const r of rows) by.set(r.tanggal.slice(0, 7), (by.get(r.tanggal.slice(0, 7)) || 0) + (r.berkas || 0));
  const pts = months.filter((m) => m <= anchorMonth).map((m) => ({ m, v: by.get(m) || 0 }));
  if (pts.length < 2) return { ok: false, title: 'Data belum cukup untuk melihat tren.' };
  const partial = S.dayMax < `${anchorMonth}-28` && pts.at(-1).m === anchorMonth;
  const full = partial ? pts.slice(0, -1) : pts;
  const first = full[0];
  const last = full.at(-1);
  const hi = full.reduce((a, x) => (x.v > a.v ? x : a));
  const lo = full.reduce((a, x) => (x.v < a.v ? x : a));
  lines.push(`Tertinggi ${monthName(hi.m)} (${num(hi.v)}), terendah ${monthName(lo.m)} (${num(lo.v)}); rata-rata ${num(sum(full.map((x) => x.v)) / full.length, 0)} berkas per bulan.`);
  if (partial) lines.push(`${monthName(anchorMonth)} baru sampai ${dateShort(S.dayMax)} (${num(pts.at(-1).v)} berkas), tidak dipakai dalam perbandingan.`);
  return {
    ok: true,
    title: `${cap(EVENT[id])} ${where} ${last.v > first.v ? 'naik' : last.v < first.v ? 'turun' : 'stabil'} dari ${num(first.v)} (${monthName(first.m)}) ke ${b(num(last.v))} berkas (${monthName(last.m)}), ${b(signedPct(ratio(last.v, first.v) - 1))}.`,
    lines,
    spark: { labels: pts.map((x) => `${monthName(x.m).slice(0, 3)}${partial && x.m === anchorMonth ? '*' : ''}`), values: pts.map((x) => x.v), fmt: (v) => num(v), bars: true },
    chips: chips([['Data', EVENT[id]], ['Wilayah', where], ['Periode', `${pts.length} bulan`], ['Sumber', 'SLA'], ...kit.fixChips(q)]),
    link: linkSla(sel, 'daily'),
    followups: [id === 'cair' ? 'Tren prakarsa baru 6 bulan terakhir' : 'Tren berkas cair 6 bulan terakhir', 'Berapa berkas lewat SLA?'],
  };
}

function compareAnswer(q, D, kit, sel) {
  const S = D.sla;
  let items = [];
  if (q.manyOf === 'fiList') items = q.entities.fiList.map((fi) => ({ label: pendapatanValue(S, fi) || fi, sel: { ...sel, pendapatan: pendapatanValue(S, fi) } }));
  else if (q.manyOf === 'putusan') items = q.sla.putusan.map((p) => ({ label: putusanLabel(putusanValue(S, p)), sel: { ...sel, putusan: putusanValue(S, p) } }));
  else if (q.manyOf === 'kanca') items = q.entities.kanca.map((k) => ({ label: k, sel: { ...sel, kancas: [k] } }));
  else if (q.manyOf === 'ro' || q.entities.ro.length > 1) items = q.entities.ro.filter((r) => S.ros.includes(r)).map((r) => ({ label: roName(r), sel: { ...sel, ros: [r], prov: [] } }));
  else if (q.manyOf === 'prov') items = q.entities.prov.map((p) => ({ label: kit.provinceLabel(p), sel: { ...sel, ros: kit.rosOf({ ...q, entities: { ...q.entities, ro: [], prov: [p] } }, D), prov: [p] } }));
  if (items.length < 2) return null;
  if (q.sla.events) {
    const P = periodOf(q, D, kit);
    const id = q.sla.stages[0] || 'cair';
    const vals = items.map((x) => ({ ...x, v: eventTotals(dailyRows(S, x.sel, P.from, P.to))[id].berkas }));
    const s = [...vals].sort((a, c) => c.v - a.v);
    return {
      ok: true,
      title: `${cap(EVENT[id])} ${P.label}: ${listJoin(s.map((x) => `${b(esc(x.label))} ${num(x.v)}`))} berkas.`,
      lines: [],
      list: { items: s.map((x, i) => ({ rank: i + 1, key: x.label, label: esc(x.label), v: x.v, text: `${num(x.v)} berkas` })), dir: 'desc', abs: true },
      chips: chips([['Data', EVENT[id]], ['Periode', P.label], ['Sumber', 'SLA']]),
      link: linkSla(sel, 'daily'),
    };
  }
  const res = items.map((x) => {
    const all = scoped(S, x.sel);
    return { ...x, run: tally(activeRows(all)), cair: tally(all.filter((r) => r.stage === 'cair')) };
  });
  const m = q.sla.metric;
  let title;
  if (m === 'lama') {
    const s = res.filter((x) => ok(x.cair.lamaAvg)).sort((a, c) => a.cair.lamaAvg - c.cair.lamaAvg);
    title = s.length >= 2 ? `${b(esc(s[0].label))} lebih cepat cair: rata-rata ${b(dur(s[0].cair.lamaAvg))} dari prakarsa, dibanding ${esc(s.at(-1).label)} ${dur(s.at(-1).cair.lamaAvg)}.` : 'Data lama cair belum cukup untuk dibandingkan.';
  } else if (m === 'berkas' || m === 'stuck' || m === 'nominal') {
    const s = [...res].sort((a, c) => c.run.berkas - a.run.berkas);
    title = `${b(esc(s[0].label))} punya lebih banyak berkas berjalan: ${b(num(s[0].run.berkas))} dibanding ${esc(s.at(-1).label)} ${num(s.at(-1).run.berkas)}.`;
  } else if (m === 'late') {
    const s = [...res].sort((a, c) => c.run.late - a.run.late);
    title = `${b(esc(s[0].label))} lebih banyak berkas lewat SLA: ${b(num(s[0].run.late))} dibanding ${esc(s.at(-1).label)} ${num(s.at(-1).run.late)}.`;
  } else {
    const s = res.filter((x) => ok(x.run.onTime)).sort((a, c) => c.run.onTime - a.run.onTime);
    title = s.length >= 2 ? `${b(esc(s[0].label))} lebih patuh SLA: ${b(pct(s[0].run.onTime, 1))} dibanding ${esc(s.at(-1).label)} ${pct(s.at(-1).run.onTime, 1)}.` : 'Data belum cukup untuk dibandingkan.';
  }
  return {
    ok: true, title, lines: [`Posisi ${asOf(S)}. Kepatuhan dan lewat SLA dihitung dari berkas yang masih berjalan; lama cair dari berkas yang sudah cair.`],
    table: {
      columns: ['', 'Berjalan', 'Lewat SLA', 'Kepatuhan', 'Umur rata-rata', 'Sudah cair', 'Prakarsa sampai cair'],
      rows: res.map((x) => [esc(x.label), num(x.run.berkas), num(x.run.late), pct(x.run.onTime, 1), dur(x.run.umurAvg), num(x.cair.berkas), dur(x.cair.lamaAvg)]),
    },
    chips: chips([['Dibandingkan', listJoin(res.map((x) => esc(x.label)))], ['Posisi', asOf(S)], ['Sumber', 'SLA'], ...kit.fixChips(q)]),
    link: linkSla(sel, q.manyOf === 'fiList' ? 'income' : q.manyOf === 'putusan' ? 'putusan' : 'kanca'),
    followups: ['Kanca dengan berkas lewat SLA terbanyak', 'Rata-rata lama prakarsa sampai cair'],
  };
}

function whyAnswer(q, D, kit, sel) {
  const S = D.sla;
  const where = whereOf(sel, kit);
  const all = scoped(S, sel);
  const ids = q.sla.stages.filter((id) => id !== 'cair');
  const act = ids.length ? all.filter((r) => ids.includes(r.stage)) : activeRows(all);
  const late = act.filter(isLate);
  const run = tally(act);
  if (q.sla.metric === 'lama' || (q.sla.stages.length === 1 && q.sla.stages[0] === 'cair')) {
    const cair = all.filter((r) => r.stage === 'cair');
    const t = tally(cair);
    const g = [...groupTally(cair, 'putusan')].filter(([k, x]) => k && ok(x.lamaAvg)).sort((a, c) => c[1].lamaAvg - a[1].lamaAvg);
    const p = [...groupTally(cair, 'pendapatan')].filter(([k, x]) => k && ok(x.lamaAvg)).sort((a, c) => c[1].lamaAvg - a[1].lamaAvg);
    const k = [...groupTally(cair, sel.ros.length === 1 ? 'kanca' : 'ro')].filter(([x, v]) => x && v.lamaN >= 5).sort((a, c) => c[1].lamaAvg - a[1].lamaAvg).slice(0, 3);
    return {
      ok: true,
      title: `Rata-rata prakarsa sampai cair ${where} ${b(dur(t.lamaAvg))}. Yang paling memperlama: ${g.length ? `${esc(putusanLabel(g[0][0]))} (${dur(g[0][1].lamaAvg)})` : 'jenis putusan'}${k.length ? ` dan ${sel.ros.length === 1 ? 'kanca' : 'RO'} ${listJoin(k.map(([x, v]) => `${sel.ros.length === 1 ? esc(x) : roName(x)} (${dur(v.lamaAvg)})`))}` : ''}.`,
      lines: [
        g.length > 1 ? `Per jenis putusan: ${listJoin(g.map(([x, v]) => `${esc(putusanLabel(x))} ${dur(v.lamaAvg)}`))}. Putusan yang naik ke CLF wajar lebih lama karena melewati pemutus di atas cabang.` : '',
        p.length > 1 ? `Per jenis pendapatan: ${listJoin(p.map(([x, v]) => `${esc(x)} ${dur(v.lamaAvg)}`))}.` : '',
      ].filter(Boolean),
      chips: chips([['Penjelasan', 'jenis putusan, pendapatan, wilayah'], ['Sumber', 'SLA']]),
      link: linkSla(sel, 'putusan'),
      followups: ['Putusan CLF vs putusan cabang', 'Kanca mana paling lama prakarsa sampai cair?'],
    };
  }
  if (!late.length) {
    return {
      ok: true, title: `Tidak ada berkas lewat SLA ${where} saat ini (posisi ${asOf(S)}).`,
      lines: [`${num(run.berkas)} berkas berjalan, umur rata-rata ${dur(run.umurAvg)}, terlama ${dur(run.umurMax)}.`],
      link: linkSla(sel, 'flow'),
    };
  }
  const nLate = sum(late.map((r) => r.berkas || 0));
  const st = byStage(late);
  const worst = ACTIVE_STAGES.map((s) => ({ s, n: st.get(s.id).berkas })).sort((a, c) => c.n - a.n)[0];
  const kg = [...groupTally(late, 'kanca')].filter(([k]) => k).sort((a, c) => c[1].berkas - a[1].berkas);
  const top = kg.slice(0, 3);
  const topShare = ratio(sum(top.map(([, t]) => t.berkas)), nLate);
  const lines = [];
  lines.push(`Per tahap: ${ACTIVE_STAGES.map((s) => `${s.label} ${num(st.get(s.id).berkas)}`).join(', ')} berkas lewat SLA.`);
  for (const [key, word] of [['putusan', 'jenis putusan'], ['pendapatan', 'jenis pendapatan']]) {
    const g = [...groupTally(act, key)].filter(([k, t]) => k && ok(t.onTime)).sort((a, c) => a[1].onTime - c[1].onTime);
    if (g.length > 1) lines.push(`Per ${word}: ${listJoin(g.map(([k, t]) => `${esc(key === 'putusan' ? putusanLabel(k) : k)} ${pct(1 - t.onTime, 1)} lewat SLA`))}.`);
  }
  for (const s of ACTIVE_STAGES) {
    if (ids.length && !ids.includes(s.id)) continue;
    const f = flowLine(S, sel, s.id);
    if (f && /bertambah/.test(f)) lines.push(f);
  }
  const veryOld = sum(late.filter((r) => r.umur > 7).map((r) => r.berkas || 0));
  if (veryOld) lines.push(`${num(veryOld)} berkas bahkan sudah lebih dari 7 hari.`);
  return {
    ok: true,
    title: `Keterlambatan ${where} terpusat di tahap ${b(worst.s.label)} (${num(worst.n)} dari ${num(nLate)} berkas lewat SLA)${top.length > 1 ? ` dan di ${top.length} kanca: ${listJoin(top.map(([k, t]) => `${esc(k)} (${num(t.berkas)})`))}, ${pct(topShare, 0)} dari total` : ''}.`,
    lines,
    meaning: top.length ? `Mulai dari ${esc(top[0][0])} di tahap ${lower(worst.s.id)}: dampaknya paling besar terhadap kepatuhan SLA.` : '',
    chips: chips([['Penjelasan', 'tahap, kanca, jenis putusan, pendapatan, arus 7 hari'], ['Posisi', asOf(S)], ['Sumber', 'SLA']]),
    link: linkSla(sel, 'kanca'),
    followups: ['Kanca dengan berkas lewat SLA terbanyak', `Kanca mana paling lambat di tahap ${worst.s.label}?`],
  };
}

function rejectedAnswer(q, D, kit, sel) {
  const S = D.sla;
  const where = whereOf(sel, kit);
  const P = q.time?.kind && !['latest', 'today'].includes(q.time.kind) ? kit.resolvePeriod(q.time, D, 'sla') : null;
  const months = P ? new Set(P.months) : null;
  const pick = (rows) => scoped(S, sel, rows).filter((r) => !months || months.has(r.bulan));
  const rej = pick(S.rejected || []);
  const n = sum(rej.map((r) => r.berkas || 0));
  const nominal = sum(rej.map((r) => r.nominal_pengajuan || 0));
  const decided = sum(pick(S.rows).filter((r) => r.stage === 'putusan' || r.stage === 'cair').map((r) => r.berkas || 0));
  const scope = P ? ` (berkas yang diprakarsai ${P.label})` : '';
  const lines = [];
  if (n + decided) lines.push(`Rasio tolak ${b(pct(ratio(n, n + decided), 1))} dari berkas yang sudah diputus (ditolak ${num(n)}, disetujui ${num(decided)}).`);
  const dim = sel.kancas.length ? null : sel.ros.length === 1 ? 'kanca' : 'ro';
  if (dim && n) {
    const g = [...groupTally(rej, dim)].filter(([k]) => k).sort((a, c) => c[1].berkas - a[1].berkas).slice(0, 3);
    if (g.length) lines.push(`Terbanyak di ${listJoin(g.map(([k, t]) => `${dim === 'ro' ? roName(k) : esc(k)} (${num(t.berkas)})`))}.`);
  }
  if (!sel.pendapatan && n) {
    const g = [...groupTally(rej, 'pendapatan')].filter(([k]) => k);
    if (g.length > 1) lines.push(`Per jenis pendapatan: ${listJoin(g.map(([k, t]) => `${esc(k)} ${num(t.berkas)}`))}.`);
  }
  lines.push('Halaman SLA tidak menampilkan berkas ditolak karena sudah keluar dari alur proses; angka ini diambil dari data SLA yang sama.');
  return {
    ok: true,
    title: `${b(`${num(n)} berkas`)} ${where}${scope} ditolak, nominal pengajuan ${b(rp(nominal))}.`,
    lines,
    chips: chips([['Metrik', 'berkas ditolak'], ['Wilayah', where], ['Sumber', 'SLA'], ...kit.fixChips(q)]),
    followups: ['Berapa berkas lewat SLA?', 'Rata-rata lama prakarsa sampai cair'],
  };
}

export function slaAnswer(q, D, kit) {
  const S = D.sla;
  if (!S || !S.rows?.length) {
    return { ok: false, title: 'Data SLA belum tersedia, jadi pertanyaan soal berkas belum bisa dijawab.', lines: ['Data SLA dibaca dari sla.xlsx (atau sheet SLA di versi online). Setelah data diisi dan dashboard diperbarui, pertanyaan ini bisa dijawab.'] };
  }
  const sel = selOf(q, D, kit);
  if (q.sla.metric === 'ditolak') return rejectedAnswer(q, D, kit, sel);
  if (q.intent === 'why') return whyAnswer(q, D, kit, sel);
  if (q.intent === 'compare') {
    const c = compareAnswer(q, D, kit, sel);
    if (c) return c;
  }
  if (q.sla.events) {
    const multi = ['lastN', 'months', 'ytd', 'quarter', 'semester', 'monthRange', 'year', 'yearRel'].includes(q.time?.kind) && !(q.time.kind === 'lastN' && q.time.unit === 'day');
    const named = /\b(tren|trend|grafik|perkembangan|riwayat|historis)\b/.test(q.norm);
    if (q.intent === 'trend' && (multi || (!q.time?.kind && named))) return trendAnswer(q, D, kit, sel);
    return eventsAnswer(q, D, kit, sel);
  }
  if (q.intent === 'trend') return trendAnswer(q, D, kit, sel);
  if (q.intent === 'filter' && q.threshold) return filterAnswer(q, D, kit, sel);
  if (q.intent === 'rank' || q.intent === 'share' || q.groupBy) return rankAnswer(q, D, kit, sel);
  const ids = q.sla.stages;
  if (ids.length) return stageAnswer(q, D, kit, sel, ids);
  if (q.sla.metric === 'lama') return cairAnswer(q, D, kit, sel);
  return overview(q, D, kit, sel);
}

export function slaBrief(S, ro = '') {
  if (!S?.rows?.length) return null;
  const rows = ro ? S.rows.filter((r) => r.ro === ro) : S.rows;
  const run = tally(activeRows(rows));
  return { run, line: `${num(run.berkas)} berkas KPR masih berjalan, ${num(run.late)} lewat SLA (kepatuhan ${pct(run.onTime, 1)}), posisi ${asOf(S)}.` };
}

export function slaByRo(S) {
  if (!S?.rows?.length) return new Map();
  return groupTally(activeRows(S.rows), 'ro');
}

export function slaLateKanca(S, ro, limit = 3) {
  if (!S?.rows?.length) return [];
  return [...groupTally(activeRows(S.rows.filter((r) => r.ro === ro)).filter(isLate), 'kanca')].filter(([k]) => k).sort((a, c) => c[1].berkas - a[1].berkas).slice(0, limit);
}
