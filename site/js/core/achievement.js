import { ACH_THRESHOLDS } from '../config.js';
import { ok } from './values.js';
import { fmt, esc } from './format.js';

export function achLevel(r) {
  if (!ok(r)) return 'none';
  if (r >= ACH_THRESHOLDS.good) return 'good';
  if (r >= ACH_THRESHOLDS.warn) return 'warn';
  return 'bad';
}
export const LEVEL_WORD = { good: 'tercapai', warn: 'mendekati target', bad: 'di bawah target', none: 'tidak ada data' };
export const achPill = (r, title = '') => `<span class="pill ${achLevel(r)}" title="${esc(title || LEVEL_WORD[achLevel(r)])}">${fmt.pct(r, 1)}</span>`;

export function tbar(r, { label = 'Capaian', small = false } = {}) {
  const max = Math.max(1.2, Math.min(2, (ok(r) ? r : 0) * 1.08));
  const fill = ok(r) ? Math.max(0, Math.min(r, max)) / max : 0;
  return `<div class="target-bar ${achLevel(r)}${small ? ' sm' : ''}" role="img" aria-label="${esc(label)} ${fmt.pct(r, 1)} dari target">
    <span class="target-bar-fill" style="--w:${(fill * 100).toFixed(1)}%"></span><span class="target-bar-tick" style="--x:${(100 / max).toFixed(1)}%"></span></div>`;
}
export function ring(r, { size = 48, stroke = 5, label = 'Capaian', tone = null } = {}) {
  const rad = (size - stroke) / 2;
  const len = 2 * Math.PI * rad;
  const p = ok(r) ? Math.max(0, Math.min(r, 1)) : 0;
  const txt = ok(r) ? `${Math.round(r * 100)}%` : '–';
  return `<span class="ring ${tone || achLevel(r)}" role="img" aria-label="${esc(label)} ${fmt.pct(r, 1)}" title="${esc(label)} ${fmt.pct(r, 1)}">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${rad}" fill="none" stroke-width="${stroke}"/>
      <circle class="ring-value" cx="${size / 2}" cy="${size / 2}" r="${rad}" fill="none" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${len.toFixed(2)}" stroke-dashoffset="${(len * (1 - p)).toFixed(2)}" style="--len:${len.toFixed(2)}"/>
    </svg><b>${txt}</b></span>`;
}

let gaugeSeq = 0;
export function gauge(r, { label = 'Capaian', caption = 'dari RKA' } = {}) {
  const max = 1.2;
  const p = ok(r) ? Math.max(0, Math.min(r, max)) / max : 0;
  const R = 80; const cx = 100; const cy = 100;
  const len = Math.PI * R;
  const ang = Math.PI - Math.PI / max;
  const x1 = cx + Math.cos(ang) * (R - 13); const y1 = cy - Math.sin(ang) * (R - 13);
  const x2 = cx + Math.cos(ang) * (R + 13); const y2 = cy - Math.sin(ang) * (R + 13);
  const lx = cx + Math.cos(ang) * (R + 24); const ly = cy - Math.sin(ang) * (R + 24);
  const arc = `M${cx - R} ${cy} A${R} ${R} 0 0 1 ${cx + R} ${cy}`;
  const gid = `gauge-g${gaugeSeq += 1}`;
  return `<div class="gauge" role="img" aria-label="${esc(label)} ${fmt.pct(r, 1)} ${esc(caption)}">
    <svg viewBox="0 0 200 112" aria-hidden="true">
      <defs><linearGradient id="${gid}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#307FE2"/><stop offset="1" stop-color="#0857C3"/></linearGradient></defs>
      <path class="gauge-track" d="${arc}" fill="none" stroke-width="18" stroke-linecap="round"/>
      <path class="gauge-value" d="${arc}" fill="none" stroke="url(#${gid})" stroke-width="18" stroke-linecap="round"
        stroke-dasharray="${len.toFixed(2)}" stroke-dashoffset="${(len * (1 - p)).toFixed(2)}" style="--len:${len.toFixed(2)}"/>
      <line class="gauge-tick" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>
      <text class="gauge-tick-label" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle">RKA</text>
    </svg>
    <div class="gauge-center"><b>${fmt.pct(r, 1)}</b><span>${esc(caption)}</span></div></div>`;
}
