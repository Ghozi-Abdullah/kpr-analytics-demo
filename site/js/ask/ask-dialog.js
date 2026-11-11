import { icon } from '../core/icons.js';
import { esc } from '../core/format.js';
import { ok } from '../core/values.js';
import { announce, toast } from '../core/ui.js';
import { TONES } from '../analytics/insights.js';
import { EXAMPLES } from './lexicon.js';

const plain = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

function barsHtml(list) {
  const items = list.items;
  const max = Math.max(...items.map((x) => Math.abs(x.v))) || 1;
  return `<ol class="ask-bars">${items.map((x, i) => `<li class="${x.v < 0 ? 'is-negative' : ''}${i === 0 ? ' is-lead' : ''}">
      <span class="ask-bar-rank">${x.rank}</span>
      <span class="ask-bar-label" title="${esc(plain(x.label))}">${x.label}${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</span>
      <span class="ask-bar-track" aria-hidden="true"><i style="width:${Math.max(2, (Math.abs(x.v) / max) * 100).toFixed(1)}%"></i></span>
      <span class="ask-bar-value">${esc(x.text)}</span></li>`).join('')}</ol>`;
}

function sparkHtml(spark) {
  const { labels, values, fmt: f } = spark;
  const W = 640;
  const H = 150;
  const padX = 34;
  const padTop = 26;
  const padBottom = 30;
  const pts = values.map((v, i) => ({ v, i })).filter((p) => ok(p.v));
  if (pts.length < 2) return '';
  const lo = Math.min(...pts.map((p) => p.v));
  const hi = Math.max(...pts.map((p) => p.v));
  const span = hi - lo || Math.abs(hi) || 1;
  const x = (i) => padX + (i * (W - padX * 2)) / Math.max(1, values.length - 1);
  const yBase = spark.bars ? Math.min(lo, 0) : lo - span * 0.15;
  const yTop = hi + span * 0.1;
  const y = (v) => padTop + (1 - (v - yBase) / (yTop - yBase || 1)) * (H - padTop - padBottom);
  const label = (p, anchor = 'middle') => `<text x="${x(p.i).toFixed(1)}" y="${(y(p.v) - 9).toFixed(1)}" text-anchor="${anchor}" class="ask-spark-value">${esc(f(p.v))}</text>`;
  const marks = new Set([pts[0].i, pts.at(-1).i, pts.reduce((m, p) => (p.v > m.v ? p : m)).i, pts.reduce((m, p) => (p.v < m.v ? p : m)).i]);
  const step = Math.ceil(labels.length / 12);
  const xl = labels.map((l, i) => (i % step === 0 || i === labels.length - 1 ? `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="ask-spark-axis">${esc(l)}</text>` : '')).join('');
  let body;
  if (spark.bars) {
    const bw = Math.max(4, ((W - padX * 2) / values.length) * 0.62);
    body = pts.map((p) => `<rect x="${(x(p.i) - bw / 2).toFixed(1)}" y="${y(p.v).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, y(yBase) - y(p.v)).toFixed(1)}" rx="3" class="ask-spark-bar${p.i === pts.at(-1).i ? ' is-last' : ''}"/>`).join('');
  } else {
    const d = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
    body = `<path d="${d}" class="ask-spark-line"/>${pts.map((p) => `<circle cx="${x(p.i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${p.i === pts.at(-1).i ? 4.5 : 3}" class="ask-spark-dot${p.i === pts.at(-1).i ? ' is-last' : ''}"/>`).join('')}`;
  }
  const valueLabels = pts.filter((p) => marks.has(p.i)).map((p) => label(p, p.i === pts[0].i ? 'start' : p.i === pts.at(-1).i ? 'end' : 'middle')).join('');
  return `<figure class="ask-spark"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(labels.map((l, i) => `${l}: ${ok(values[i]) ? f(values[i]) : 'tidak ada'}`).join(', '))}">${body}${valueLabels}${xl}</svg></figure>`;
}

function tableHtml(t) {
  return `<div class="ask-table"><table class="data-table"><thead><tr>${t.columns.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${t.rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${c}</th>` : `<td>${esc(c)}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function moreHtml(it) {
  return `<section class="ask-more tone-${it.tone}">
    <h4>${icon(it.icon, 14)}${esc(it.kindLabel)}<span>${esc(TONES[it.tone] || '')}</span></h4>
    <p>${it.headline}</p>
    ${it.evidence.length ? `<ul class="ask-lines">${it.evidence.map((e) => `<li>${e}</li>`).join('')}</ul>` : ''}
  </section>`;
}

function examplesHtml(groups) {
  return `<div class="ask-examples">${groups.map((g) => `<section><h3>${esc(g.group)}</h3>
    <div class="ask-chips">${g.items.map((q) => `<button type="button" class="ask-chip" data-ask="${esc(q)}">${esc(q)}</button>`).join('')}</div></section>`).join('')}</div>`;
}

function answerText(question, a) {
  const [lead, ...more] = a.insights || [];
  const lines = [plain(a.title), ...(a.lines || []).map(plain)];
  if (lead) {
    if (plain(lead.headline) !== plain(a.title)) lines.push(plain(lead.headline));
    lines.push(...lead.evidence.map((e) => `- ${plain(e)}`));
    if (lead.implication && plain(lead.implication) !== plain(a.title)) lines.push(`Artinya: ${plain(lead.implication)}`);
  }
  if (a.list) lines.push(...a.list.items.map((x) => `${x.rank}. ${plain(x.label)}: ${plain(x.text)}`));
  if (a.table) lines.push(...a.table.rows.map((r) => r.map(plain).join(' | ')));
  for (const it of more) lines.push(`${it.kindLabel}: ${plain(it.headline)}`);
  return `${question}\n${lines.join('\n')}`;
}

function answerHtml(a, id) {
  const visual = a.list ? barsHtml(a.list) : a.spark ? sparkHtml(a.spark) : a.table ? tableHtml(a.table) : '';
  const [lead, ...more] = a.insights || [];
  const leadHead = lead && plain(lead.headline) !== plain(a.title) ? `<p class="ask-lead">${lead.headline}</p>` : '';
  const leadLines = lead?.evidence?.length ? `<ul class="ask-lines">${lead.evidence.map((e) => `<li>${e}</li>`).join('')}</ul>` : '';
  const meaning = lead?.implication && plain(lead.implication) !== plain(a.title) ? `<p class="ask-meaning"><span>Artinya</span>${lead.implication}</p>` : '';
  const sure = lead ? `<p class="ask-sure">Keyakinan ${esc(lead.confidence)}${lead.confidenceNote ? `, ${esc(lead.confidenceNote)}` : ''}</p>` : '';
  const wide = visual || more.length || a.examples;
  return `<div class="ask-msg from-data${wide ? ' is-wide' : ''}${a.ok === false ? ' is-miss' : ''}">
    <h3 class="ask-title" id="${id}">${a.title}</h3>
    ${a.lines?.length ? `<ul class="ask-lines">${a.lines.map((l) => `<li>${l}</li>`).join('')}</ul>` : ''}
    ${leadHead}${leadLines}
    ${visual}
    ${meaning}
    ${more.map(moreHtml).join('')}
    ${a.examples ? examplesHtml(a.examples) : ''}
    ${sure}
    ${a.link || a.ok !== false ? `<div class="ask-actions">
      ${a.link ? `<button type="button" class="btn sm" data-go>${icon('open', 15)}${esc(a.link.label || 'Buka di dashboard')}</button>` : ''}
      ${a.ok !== false ? `<button type="button" class="btn ghost sm" data-copy>${icon('copy', 15)}Salin</button>` : ''}
    </div>` : ''}
  </div>`;
}

const replyHtml = (inner) => `<div class="ask-reply"><span class="ask-avatar" aria-hidden="true">${icon('ask', 16)}</span>${inner}</div>`;
const TYPING = '<div class="ask-msg from-data is-typing"><span class="ask-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="sr-only">Menyiapkan jawaban</span></div>';
const GREETING = `<div class="ask-msg from-data is-wide"><h3 class="ask-title">Tanyakan angka, peringkat, tren, perbandingan, atau penyebab perubahan KPR.</h3>
  <p class="ask-hint">Contoh pertanyaan yang bisa langsung dipilih:</p>${examplesHtml(EXAMPLES)}</div>`;

export function createAskDialog({ engine, context = () => ({}), onNavigate }) {
  let dlg = null;
  let turn = 0;
  let active = -1;
  let options = [];
  let busy = false;

  function build() {
    dlg = document.createElement('dialog');
    dlg.id = 'ask-dialog';
    dlg.className = 'ask-dialog';
    dlg.setAttribute('aria-labelledby', 'ask-heading');
    dlg.setAttribute('closedby', 'any');
    dlg.innerHTML = `
      <header class="ask-head">
        <span class="ask-head-icon" aria-hidden="true">${icon('ask', 20)}</span>
        <h2 id="ask-heading">Tanya data</h2>
        <button type="button" class="link" id="ask-reset" hidden>${icon('history', 14)}Mulai percakapan baru</button>
        <button type="button" class="icon-btn" data-close aria-label="Tutup">${icon('close', 18)}</button>
      </header>
      <div class="ask-body" id="ask-body">
        <div class="ask-start" id="ask-start">${replyHtml(GREETING)}</div>
        <div class="ask-thread" id="ask-thread"></div>
      </div>
      <form class="ask-bar" id="ask-form" role="search" aria-label="Tulis pertanyaan">
        <div class="ask-field">
          <input id="ask-input" type="text" role="combobox" aria-expanded="false" aria-controls="ask-options" aria-autocomplete="list" aria-label="Pertanyaan"
            autocomplete="off" spellcheck="false" enterkeyhint="send" placeholder="${matchMedia('(max-width: 640px)').matches ? 'Tulis pertanyaan' : 'Tulis pertanyaan, misal: RO mana NPL tertinggi?'}" autofocus>
          <button type="submit" class="ask-send" id="ask-submit" aria-label="Kirim pertanyaan" title="Kirim (Enter)">${icon('send', 18)}</button>
        </div>
        <ul id="ask-options" class="ask-options" role="listbox" aria-label="Saran" hidden></ul>
        <p class="ask-keys"><kbd>Enter</kbd> kirim, <kbd>/</kbd> atau <kbd>Ctrl</kbd> <kbd>K</kbd> membuka Tanya data dari halaman mana pun</p>
      </form>`;
    document.body.appendChild(dlg);
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    }
    const input = dlg.querySelector('#ask-input');
    dlg.querySelector('#ask-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (active >= 0 && options[active]) { choose(options[active]); return; }
      submit(input.value);
    });
    dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
    dlg.querySelector('#ask-reset').addEventListener('click', resetThread);
    input.addEventListener('input', () => renderOptions(input.value));
    input.addEventListener('keydown', onKey);
    input.addEventListener('blur', () => setTimeout(hideOptions, 120));
    dlg.querySelector('#ask-options').addEventListener('mousedown', (e) => {
      const li = e.target.closest('[role="option"]');
      if (!li) return;
      e.preventDefault();
      choose(options[Number(li.dataset.i)]);
    });
    dlg.addEventListener('click', onClick);
  }

  function onKey(e) {
    const list = dlg.querySelector('#ask-options');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (list.hidden || !options.length) return;
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      paintActive();
    } else if (e.key === 'Escape' && !list.hidden) {
      e.preventDefault();
      e.stopPropagation();
      hideOptions();
    } else if (e.key === 'Tab' && active >= 0 && options[active]?.kind === 'entity') {
      e.preventDefault();
      choose(options[active]);
    }
  }

  function paintActive() {
    const input = dlg.querySelector('#ask-input');
    dlg.querySelectorAll('#ask-options [role="option"]').forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
    if (active >= 0) input.setAttribute('aria-activedescendant', `ask-opt-${active}`);
    else input.removeAttribute('aria-activedescendant');
  }

  function hideOptions() {
    if (!dlg) return;
    const list = dlg.querySelector('#ask-options');
    list.hidden = true;
    dlg.querySelector('#ask-input').setAttribute('aria-expanded', 'false');
    dlg.querySelector('#ask-input').removeAttribute('aria-activedescendant');
    active = -1;
  }

  function renderOptions(text) {
    options = engine.suggest(text);
    const list = dlg.querySelector('#ask-options');
    if (!options.length || !text.trim()) { hideOptions(); return; }
    active = -1;
    list.innerHTML = options.map((o, i) => `<li role="option" id="ask-opt-${i}" data-i="${i}" aria-selected="false">
      ${icon(o.kind === 'entity' ? 'search' : 'ask', 15)}<span>${esc(o.text)}</span>${o.kind === 'entity' ? `<small>${esc({ ro: 'RO', kanca: 'kanca', metric: 'metrik', tipe: 'tipe' }[o.type] || '')}</small>` : ''}</li>`).join('');
    list.hidden = false;
    dlg.querySelector('#ask-input').setAttribute('aria-expanded', 'true');
  }

  function choose(o) {
    const input = dlg.querySelector('#ask-input');
    if (o.kind === 'question') { hideOptions(); submit(o.text); return; }
    const words = input.value.replace(/\s+$/, '').split(/\s+/);
    words[words.length - 1] = o.text;
    input.value = `${words.join(' ')} `;
    hideOptions();
    input.focus();
  }

  async function submit(text) {
    const q = String(text || '').trim();
    if (!q || busy) return;
    busy = true;
    hideOptions();
    const input = dlg.querySelector('#ask-input');
    input.value = '';
    dlg.querySelector('#ask-start').hidden = true;
    dlg.querySelector('#ask-reset').hidden = false;
    const id = `ask-turn-${++turn}`;
    const wrap = document.createElement('article');
    wrap.className = 'ask-turn';
    wrap.setAttribute('aria-labelledby', `${id}-a`);
    wrap.innerHTML = `<div class="ask-msg from-user"><p>${esc(q)}</p></div>${replyHtml(TYPING)}`;
    dlg.querySelector('#ask-thread').append(wrap);
    toEnd();
    const slot = () => wrap.querySelector('.ask-reply .ask-msg');
    try {
      const { a } = await engine.ask(q, { context: context() });
      slot().outerHTML = answerHtml(a, `${id}-a`);
      wrap._answer = a;
      wrap._question = q;
      announce(plain(a.title));
    } catch (err) {
      slot().outerHTML = answerHtml({ ok: false, title: 'Data belum bisa dimuat untuk menjawab.', lines: [esc(err?.message || '')] }, `${id}-a`);
    } finally {
      busy = false;
      reveal(wrap);
      input.focus({ preventScroll: true });
    }
  }

  const motion = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

  function toEnd() {
    const body = dlg.querySelector('#ask-body');
    body.scrollTo({ top: body.scrollHeight, behavior: motion() });
  }

  function reveal(wrap) {
    const body = dlg.querySelector('#ask-body');
    const fits = wrap.offsetHeight <= body.clientHeight - 32;
    body.scrollTo({ top: fits ? body.scrollHeight : Math.max(0, wrap.offsetTop - 16), behavior: motion() });
  }

  function onClick(e) {
    const chip = e.target.closest('[data-ask]');
    if (chip) { submit(chip.dataset.ask); return; }
    const t = e.target.closest('.ask-turn');
    if (!t?._answer) return;
    if (e.target.closest('[data-go]')) {
      const l = t._answer.link;
      dlg.close();
      onNavigate?.(l.view, Object.fromEntries(Object.entries(l.params || {}).filter(([, v]) => v)), l.widget);
    } else if (e.target.closest('[data-copy]')) {
      navigator.clipboard?.writeText(answerText(t._question, t._answer)).then(() => toast('Jawaban disalin'), () => toast('Tidak bisa menyalin di browser ini'));
    }
  }

  function resetThread() {
    engine.reset();
    dlg.querySelector('#ask-thread').innerHTML = '';
    dlg.querySelector('#ask-start').hidden = false;
    dlg.querySelector('#ask-reset').hidden = true;
    dlg.querySelector('#ask-input').focus();
  }

  return {
    open(initial = '') {
      if (!dlg) build();
      if (!dlg.open) dlg.showModal();
      const input = dlg.querySelector('#ask-input');
      input.focus();
      const body = dlg.querySelector('#ask-body');
      body.scrollTop = dlg.querySelector('#ask-thread').children.length ? body.scrollHeight : 0;
      engine.ensure().catch(() => {});
      if (initial) submit(initial);
    },
    notifyData(text) {
      if (!dlg) return;
      const thread = dlg.querySelector('#ask-thread');
      if (!thread.children.length) return;
      const p = document.createElement('p');
      p.className = 'ask-notice';
      p.innerHTML = `${icon('signal', 14)}${esc(text)}`;
      thread.append(p);
    },
    get isOpen() { return !!dlg?.open; },
  };
}
