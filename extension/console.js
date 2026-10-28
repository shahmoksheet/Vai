// © 2026 Moksheet Shah. All rights reserved. Shared for viewing only — no copying, modification or redistribution without written permission. See LICENSE.
'use strict';
// console.js — Vasy Console: type (or speak) here, the ERP tab does the work.
//
// The console has no pipeline of its own. Commands go to the bubble running in
// the VasyERP tab (background relays them), so follow-ups, multi-step chains and
// "yes" confirmations behave exactly as if typed into the bubble. The bubble
// echoes every message it shows back here (runtime messages from a content
// script reach every extension page).

const $ = id => document.getElementById(id);
const log = $('log'), input = $('input'), sendBtn = $('btnSend');
let erp = null;                 // { tabId, url, title, module, busy }
let busy = false;
let history = [], hIdx = -1;
let speakOn = false, handsFree = false, lang = 'en-IN';
let listening = false, recog = null, localVoice = false;

// ── Safe rendering ─────────────────────────────────────────────────────────
// This page is privileged (extension origin) and the HTML comes from the ERP
// page's content script, which embeds ERP data such as product names. Keep
// formatting tags only; drop scripts, media, handlers and styles.
const KEEP = new Set(['B', 'STRONG', 'I', 'EM', 'SMALL', 'BR', 'CODE', 'SPAN', 'DIV', 'P', 'UL', 'OL', 'LI', 'A', 'SUP', 'SUB', 'U']);
const DROP = /^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|IMG|SVG|VIDEO|AUDIO|BUTTON|INPUT|FORM|TEXTAREA|SELECT|LINK|META)$/;
function sanitize(html) {
  const doc = new DOMParser().parseFromString('<div id="r">' + String(html || '') + '</div>', 'text/html');
  const root = doc.getElementById('r');
  for (const el of [...root.querySelectorAll('*')].reverse()) {
    if (DROP.test(el.tagName)) { el.remove(); continue; }
    if (!KEEP.has(el.tagName)) { el.replaceWith(...el.childNodes); continue; }
    for (const a of [...el.attributes]) {
      const keepHref = el.tagName === 'A' && a.name === 'href' && /^https?:\/\//i.test(a.value);
      const keepClass = a.name === 'class' && /^vm-src\b/.test(a.value);   // the "⚡ Local" / "🌐 हिन्दी" badge
      if (!keepHref && !keepClass) el.removeAttribute(a.name);
    }
    if (el.classList.length) el.className = 'src';
    if (el.tagName === 'A') { el.target = '_blank'; el.rel = 'noopener'; }
  }
  return root.innerHTML;
}
const plain = html => { const d = document.createElement('div'); d.innerHTML = sanitize(html); return (d.textContent || '').trim(); };

// ── Conversation ───────────────────────────────────────────────────────────
function scroll() { log.scrollTop = log.scrollHeight; }
function clearEmpty() { const e = log.querySelector('.empty'); if (e) e.remove(); }
function quickReplies(el, text) {
  // "(yes/cancel)" or "(Cash / UPI / Card)" at the end of a bot message
  const m = text.match(/\(([^()]{1,120}\/[^()]{1,120})\)\s*$/);
  if (!m) return;
  const opts = m[1].split('/').map(s => s.trim()).filter(s => s && s.length <= 40);
  if (opts.length < 2 || opts.length > 6) return;
  const box = document.createElement('div');
  box.className = 'quick';
  for (const o of opts) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = o;
    b.addEventListener('click', () => { box.remove(); send(o); });
    box.appendChild(b);
  }
  el.appendChild(box);
}
function addMsg(kind, html, cls = '', when = null) {
  clearEmpty();
  removeTyping();
  const d = document.createElement('div');
  if (kind === 'sys') { d.className = 'msg sys'; d.textContent = plain(html); }
  else {
    const isUser = /vm-user/.test(cls);
    d.className = 'msg ' + (isUser ? 'user' : 'bot') + (/vm-success/.test(cls) ? ' ok' : '') + (/vm-error/.test(cls) ? ' bad' : '');
    d.innerHTML = sanitize(html);
    if (!when) {   // live messages get a time; replayed history doesn't pretend to know one
      const t = document.createElement('span');
      t.className = 'meta';
      t.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      d.appendChild(t);
    }
    if (!isUser) {
      quickReplies(d, plain(html));
      if (speakOn && !when) speak(plain(html));
      if (handsFree && !when) setTimeout(() => { if (!busy && !listening) startListening(); }, speakOn ? 0 : 700);
    }
  }
  log.appendChild(d);
  scroll();
  return d;
}
function showTyping() {
  if (log.querySelector('.typing')) return;
  const t = document.createElement('div');
  t.className = 'typing'; t.innerHTML = '<i></i><i></i><i></i>';
  log.appendChild(t); scroll();
}
function removeTyping() { log.querySelectorAll('.typing').forEach(t => t.remove()); }
function setBusy(on) {
  busy = !!on;
  $('connDot').className = 'dot ' + (busy ? 'busy' : erp ? 'on' : 'off');
  if (busy) showTyping(); else removeTyping();
}

// Mirror of the bubble in the connected ERP tab
chrome.runtime.onMessage.addListener((m, sender) => {
  if (!m || m.action !== 'bubble_echo') return;
  if (erp && sender && sender.tab && sender.tab.id !== erp.tabId) return;
  if (m.module && erp) { erp.module = m.module; renderConn(); }
  if (m.kind === 'busy') { setBusy(m.busy); return; }
  if (m.kind === 'choices') {
    const last = [...log.querySelectorAll('.msg.bot')].pop();
    if (!last || !Array.isArray(m.choices)) return;
    last.querySelectorAll('.quick').forEach(q => q.remove());
    const box = document.createElement('div');
    box.className = 'quick';
    for (const c of m.choices) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.textContent = String(c.label || c.value).slice(0, 70); btn.title = String(c.value || '');
      btn.addEventListener('click', () => { box.remove(); send(String(c.value || '')); });
      box.appendChild(btn);
    }
    last.appendChild(box); scroll();
    return;
  }
  addMsg(m.kind === 'sys' ? 'sys' : 'msg', m.html, m.cls);
  if (typeof m.busy === 'boolean') setBusy(m.busy);
});

// ── Connection to the ERP tab ──────────────────────────────────────────────
function renderConn() {
  const t = $('connText');
  if (!erp) { t.textContent = 'No VasyERP tab connected'; $('connDot').className = 'dot off'; $('noErp').hidden = false; return; }
  $('noErp').hidden = true;
  let host = ''; try { host = new URL(erp.url).host; } catch (e) {}
  t.textContent = `Connected · ${erp.module || 'VasyERP'} · ${host}`;
  if (!busy) $('connDot').className = 'dot on';
  const back = erp.active === false || erp.minimized;
  $('bgWarn').hidden = !back;
  if (erp.loggedOut) t.textContent = `Signed out · ${host} — sign in on the ERP tab`;
}
async function refreshConn() {
  try {
    const r = await chrome.runtime.sendMessage({ action: 'console_status' });
    erp = r && r.ok ? r : null;
    if (erp && typeof r.busy === 'boolean' && r.busy !== busy) setBusy(r.busy);
  } catch (e) { erp = null; }
  renderConn();
}

// ── Sending ────────────────────────────────────────────────────────────────
async function send(text) {
  text = String(text || '').trim();
  if (!text) return;
  if (text !== history[history.length - 1]) { history.push(text); if (history.length > 50) history.shift(); }
  hIdx = -1;
  input.value = ''; autoGrow();
  if (!erp) await refreshConn();
  if (!erp) {
    addMsg('msg', text, 'vm-user');
    addMsg('msg', 'No VasyERP tab is open, so there is nothing to run this on yet. Open VasyERP, sign in, and send it again.', 'vm-bot vm-error');
    return;
  }
  showTyping();
  let r = null;
  try { r = await chrome.runtime.sendMessage({ action: 'console_command', text }); } catch (e) { r = { ok: false, error: e.message }; }
  if (!r || !r.ok) {
    removeTyping();
    if (r && r.busy) return;   // the bubble already explained it's busy
    addMsg('msg', text, 'vm-user');
    addMsg('msg', (r && r.error) || "I couldn't reach the VasyERP tab. If you just signed in, wait for the page to load and send it again.", 'vm-bot vm-error');
  }
}
function autoGrow() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; input.style.overflowY = input.scrollHeight > 140 ? 'auto' : 'hidden'; }

// ── Tab completion — same sources as the bubble: what you've run before (here and
// in the bubble), then the command templates, then names/codes you've typed.
const TEMPLATES = ['create customer ', 'create supplier ', 'create purchase order for ', 'receive goods from ', 'create supplier bill for ',
  'create sales invoice for ', 'create sales order for ', 'create estimate for ', 'create delivery challan for ', 'create credit note for ',
  'create debit note for ', 'sell ', 'pay ', 'collect ', 'add expense ', 'stock of ', 'how much does ', 'open invoice ', 'print ',
  'find customer ', 'search product ', 'increase stock of ', 'decrease stock of ', 'produce 1 batch of ', 'create recipe ',
  'total sales today', 'total sales this month', 'who owes me money', 'what is my business health score', 'trial balance', 'open debit notes'];
let bubbleHistory = [];
chrome.storage.local.get(['cmdHistory'], r => { bubbleHistory = Array.isArray(r.cmdHistory) ? r.cmdHistory : []; });
function completionFor(text) {
  if (!text || text.trim().length < 2 || /\n/.test(text)) return '';
  const low = text.toLowerCase();
  const past = [...history, ...bubbleHistory].reverse();
  for (const c of past) { const s = String(c || ''); if (s.length > text.length && s.toLowerCase().startsWith(low) && !/^(yes|no|cancel|ok)\b/i.test(s)) return s.slice(text.length); }
  const t = TEMPLATES.find(s => s.length > text.length && s.toLowerCase().startsWith(low));
  if (t) return t.slice(text.length);
  const m = text.match(/(\S{2,})$/);
  if (m) {
    const w = m[1].toLowerCase();
    for (const c of past) for (const n of String(c || '').match(/\b[A-Z][\w&.'\-]*(?:\s+[A-Z][\w&.'\-]*){0,3}\b|\b[A-Za-z]*\d[\w\/\-]*\b/g) || [])
      if (n.toLowerCase().startsWith(w) && n.length > w.length) return n.slice(w.length);
  }
  return '';
}
let completion = '';
function renderComplete() {
  completion = input.selectionStart === input.value.length ? completionFor(input.value) : '';
  const box = $('complete');
  if (!completion) { box.hidden = true; return; }
  $('completeText').textContent = '';
  const typed = document.createElement('span'); typed.textContent = input.value;
  const rest = document.createElement('b'); rest.textContent = completion;
  $('completeText').append(typed, rest);
  box.hidden = false;
}
input.addEventListener('input', () => { autoGrow(); renderComplete(); });
input.addEventListener('blur', () => { $('complete').hidden = true; });
input.addEventListener('focus', renderComplete);
input.addEventListener('keydown', e => {
  if (e.key === 'Tab' && !e.shiftKey && completion) {
    e.preventDefault();
    input.value += completion; completion = '';
    input.setSelectionRange(input.value.length, input.value.length);
    autoGrow(); renderComplete();
    return;
  }
  if (e.key === 'Escape' && completion) { completion = ''; $('complete').hidden = true; return; }
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('complete').hidden = true; send(input.value); return; }
  if (e.key === 'ArrowUp' && (!input.value || input.selectionStart === 0) && history.length) {
    e.preventDefault(); hIdx = hIdx < 0 ? history.length - 1 : Math.max(0, hIdx - 1); input.value = history[hIdx]; autoGrow();
  } else if (e.key === 'ArrowDown' && hIdx >= 0) {
    e.preventDefault(); hIdx = hIdx + 1; if (hIdx >= history.length) { hIdx = -1; input.value = ''; } else input.value = history[hIdx]; autoGrow();
  }
});
sendBtn.addEventListener('click', () => send(input.value));

// ── Quick commands ─────────────────────────────────────────────────────────
const CHIPS = [
  ['Sales today', 'total sales today'], ['Payment modes', 'how did customers pay this month'], ['Who owes me', 'who owes me money'],
  ['Best sellers', 'best selling products this month'], ['Top expenses', 'top expenses this month'],
  ['New PO', 'create purchase order for '], ['Receive goods', 'receive goods against PO '],
  ['New invoice', 'create sales invoice for '], ['Collect payment', 'collect '], ['New customer', 'create customer '],
  ['Balance of…', 'how much does '], ['Stock of…', 'stock of '], ['Trial balance', 'trial balance'],
  ['Business health', 'what is my business health score'], ['Produce…', 'produce 1 batch of '], ['Help', 'help'],
];
$('chips').innerHTML = '';
for (const [label, cmd] of CHIPS) {
  const b = document.createElement('button');
  b.className = 'chip'; b.type = 'button'; b.textContent = label;
  b.addEventListener('click', () => { if (/\s$/.test(cmd)) { input.value = cmd; input.focus(); autoGrow(); } else send(cmd); });
  $('chips').appendChild(b);
}

// ── Window controls ────────────────────────────────────────────────────────
$('btnShowErp').addEventListener('click', () => chrome.runtime.sendMessage({ action: 'console_focus_erp' }).catch(() => {}));
$('btnBringFront').addEventListener('click', async () => { await chrome.runtime.sendMessage({ action: 'console_focus_erp' }).catch(() => {}); setTimeout(refreshConn, 600); });
$('btnTile').addEventListener('click', () => chrome.runtime.sendMessage({ action: 'console_tile',
  screen: { w: screen.availWidth, h: screen.availHeight, left: screen.availLeft || 0, top: screen.availTop || 0 } }).catch(() => {}));
$('btnOpenErp').addEventListener('click', async () => {
  const r = await chrome.runtime.sendMessage({ action: 'console_open_erp' }).catch(() => null);
  if (!r || !r.ok) addMsg('msg', "I don't know your VasyERP address yet. Open your VasyERP site once in this browser and the console will find it.", 'vm-bot vm-error');
  setTimeout(refreshConn, 2500);
});

// ── Voice ──────────────────────────────────────────────────────────────────
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
async function prepareVoice(gesture) {
  localVoice = false;
  const eng = $('engine');
  if (!SR) { eng.textContent = 'Voice input needs Chrome'; return; }
  if (typeof SR.available !== 'function') return;
  const opts = { langs: [lang], processLocally: true };
  try {
    const a = await SR.available(opts);
    if (a === 'available') localVoice = true;
    else if ((a === 'downloadable' || a === 'downloading') && gesture) {
      eng.textContent = 'Downloading on-device speech for this language (once)…';
      SR.install(opts).then(ok => { if (ok) { localVoice = true; eng.textContent = 'Voice: on your device ✓'; } }).catch(() => {});
      return;
    }
    eng.textContent = localVoice ? 'Voice: on your device ✓ · Enter to send' : 'Voice: Chrome speech service · Enter to send';
  } catch (e) {}
}
function startListening() {
  if (!SR) { addMsg('msg', 'Voice input needs Chrome.', 'vm-bot vm-error'); return; }
  if (listening) { try { recog.stop(); } catch (e) {} return; }
  recog = new SR();
  recog.lang = lang; recog.interimResults = true; recog.continuous = false;
  try { recog.processLocally = localVoice; } catch (e) {}
  listening = true;
  $('btnMic').classList.add('live'); $('voiceLine').hidden = false;
  $('voiceText').textContent = (localVoice ? 'Listening on your device…' : 'Listening…') + (handsFree ? ' say "stop listening" to end' : '');
  recog.onresult = e => {
    let fin = '', mid = '';
    for (const r of e.results) (r.isFinal ? (fin += r[0].transcript) : (mid += r[0].transcript));
    input.value = fin || mid; autoGrow();
    $('voiceText').textContent = fin ? `“${fin}”` : `Hearing: “${mid}”`;
  };
  const done = () => {
    listening = false; $('btnMic').classList.remove('live'); $('voiceLine').hidden = true;
    const t = input.value.trim();
    if (/^(stop listening|stop|band karo|बंद करो|bas)$/i.test(t)) { input.value = ''; handsFree = false; $('handsFree').checked = false; save(); return; }
    if (t) send(t);
  };
  recog.onend = done;
  recog.onerror = e => { if (e.error !== 'no-speech' && e.error !== 'aborted') addMsg('sys', `Voice error: ${e.error}`); };
  try { recog.start(); } catch (e) { listening = false; }
  if (!localVoice) prepareVoice(true);
}
$('btnMic').addEventListener('click', startListening);
$('lang').addEventListener('change', () => { lang = $('lang').value; save(); prepareVoice(true); });
$('handsFree').addEventListener('change', () => { handsFree = $('handsFree').checked; save(); });
function speak(text) {
  if (!window.speechSynthesis || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[✅❌ℹ️⚠️🎉🚀✨👌🙈😅😕⏳⚡🧠📚🌐]/g, '').slice(0, 300));
  u.lang = lang;
  const v = (speechSynthesis.getVoices() || []).find(x => x.lang === lang) || (speechSynthesis.getVoices() || []).find(x => x.lang.startsWith(lang.split('-')[0]));
  if (v) u.voice = v;
  if (handsFree) u.onend = () => setTimeout(() => { if (!busy && !listening) startListening(); }, 300);
  speechSynthesis.speak(u);
}
$('btnSpeak').addEventListener('click', () => { speakOn = !speakOn; $('btnSpeak').setAttribute('aria-pressed', String(speakOn)); save(); });

// ── Theme + persistence ────────────────────────────────────────────────────
$('btnTheme').addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = cur === 'dark' ? 'light' : 'dark';
  save();
});
function save() {
  chrome.storage.local.set({ vasyConsole: { speakOn, handsFree, lang, theme: document.documentElement.dataset.theme || '', history } });
}
document.addEventListener('keydown', e => { if (e.altKey && (e.key === 'm' || e.key === 'M')) { e.preventDefault(); startListening(); } });

// Keep Chrome's on-device model warm while the console is open and visible — people who
// type here often have the bubble closed, and a cold session costs seconds per new wording.
const aiWarm = () => { if (!document.hidden) chrome.runtime.sendMessage({ action: 'ai_warm' }).catch(() => {}); };
aiWarm(); setInterval(aiWarm, 25000);
document.addEventListener('visibilitychange', aiWarm);

chrome.storage.local.get(['vasyConsole', 'chatLog', 'vasyLang'], r => {
  const c = r.vasyConsole || {};
  speakOn = !!c.speakOn; handsFree = !!c.handsFree; history = c.history || [];
  lang = c.lang || (r.vasyLang && r.vasyLang !== 'auto' ? r.vasyLang : 'en-IN');
  $('lang').value = lang; $('handsFree').checked = handsFree; $('btnSpeak').setAttribute('aria-pressed', String(speakOn));
  if (c.theme) document.documentElement.dataset.theme = c.theme;
  const past = (r.chatLog || []).slice(-20);
  if (past.length) {
    addMsg('sys', 'Earlier in this conversation');
    for (const m of past) addMsg(/vm-sys/.test(m.cls) ? 'sys' : 'msg', m.html, m.cls, '·');
  } else {
    log.innerHTML = '<div class="empty"><b>Type a command and watch VasyERP do it.</b>The ERP tab next to this window does the clicking — follow-ups, multi-step chains and “yes” confirmations all work here too.</div>';
  }
  prepareVoice(false);
});
refreshConn();
setInterval(refreshConn, 5000);
input.focus();
