// © 2026 Moksheet Shah. All rights reserved. Shared for viewing only — no copying, modification or redistribution without written permission. See LICENSE.
'use strict';
// content_agent.js v17.3 — Vasy Universal Agent
if (window.__vasyAgentDefined) {
    // Already loaded on this page — skip redefinition.
    // The message listener registered on first load is still active.
} else {
window.__vasyAgentDefined = true;
// FIXED: POS batch modal stuck, Employee creation not stopping
// DEEP UPGRADE: CRM, Credit/Debit Note, Reports, Payments, Bank Reconciliation, all modules

// ── Core state & messaging ────────────────────────────────────────────────────
window.__vasyWatcher = window.__vasyWatcher || null;
function killWatcher() { if (window.__vasyWatcher) { window.__vasyWatcher.kill(); window.__vasyWatcher = null; } }
// Step trace — what the handler was doing and when, on <html data-vasy-trace>.
// Read it when something is slow or stuck; costs nothing otherwise.
let __vasyT0 = Date.now();
function vtrace(step) {
    try {
        const ds = document.documentElement.dataset;
        const list = (ds.vasyTrace ? ds.vasyTrace.split(' › ') : []).slice(-11);
        list.push(`${step}@${((Date.now() - __vasyT0) / 1000).toFixed(1)}s`);
        ds.vasyTrace = list.join(' › ');
    } catch (e) {}
}
// Did the current command end in something the user can see? safeRun's guard reads these.
let __vasyReplied = false, __vasyRunId = 0;
function reply(status, title, message, extra) {
    killWatcher();
    __vasyReplied = true;
    try { document.documentElement.dataset.vasyAgentReply = status + '@' + Date.now(); } catch (e) {}   // diagnosis breadcrumb
    vtrace('reply:' + status);
    chrome.runtime.sendMessage({ action: 'agent_result', status, title, message, ...(extra || {}) });
}
// A question with tappable answers. `term` is the value that turned out to be
// ambiguous; the bubble clears the field holding it, so the tapped answer fills
// exactly that field and the task continues with everything else remembered.
function askChoice(title, html, term, choices, field) {
    const list = (choices || []).filter(c => c && c.value).slice(0, 6)
        .map(c => ({ label: String(c.label || c.value).slice(0, 70), value: String(c.value).slice(0, 120) }));
    reply('info', title, html, { choices: list, choiceTerm: term == null ? '' : String(term), choiceField: field || '' });
}
const docRefFromTitle = t => {
    const head = String(t || '').split('|')[0].trim();
    return /^[A-Z][A-Z0-9\/\-]*\d[A-Z0-9\/\-]*$/i.test(head) && head.length <= 24 ? head : null;
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Adaptive waiting ─────────────────────────────────────────────────────────
// Every `await sleep(N)` after a click was a guess sized for the SLOWEST page, so
// a fast page paid the slow page's price at every step — 151 s of hard-coded
// waiting across this file. settle() keeps the same ceiling but returns the
// moment the page is genuinely finished, which takes two independent signals:
//
//   1. NETWORK IDLE — the MAIN-world helper counts in-flight fetch/XHR onto the
//      <html> dataset (the two worlds share the DOM but not JS globals), so we
//      never return while a save or a lookup is still on the wire.
//   2. DOM QUIET — a MutationObserver tracks the last mutation. React renders in
//      bursts, so "nothing changed for `quiet` ms" means the burst has ended.
//
// A short floor runs first, because the XHR a click triggers is not yet
// registered on the very next tick. If either signal never clears we wait the
// full maxMs — the worst case is exactly today's behaviour, never worse.
function _inflight() {
    const v = Number(document.documentElement.dataset.vasyInflight || 0);
    return Number.isFinite(v) ? v : 0;
}

// The chat bubble is mounted in the page's own DOM. Everything that reads the
// PAGE — error and toast scans, text matching, Save/Submit lookups, textareas —
// must look past it: an old "…failed" line in the chat log was being read back
// as VasyERP's verdict on a brand-new sale.
function _vasyRoot() { return document.getElementById('vasy-root'); }
function isOurs(n) { const r = _vasyRoot(); return !!(r && n && (n === r || r.contains(n))); }
function pageQSA(sel) {
    const all = document.querySelectorAll(sel), r = _vasyRoot();
    return r ? [...all].filter(e => !r.contains(e)) : [...all];
}
function pageQS(sel) {
    const r = _vasyRoot();
    if (!r) return document.querySelector(sel);
    for (const e of document.querySelectorAll(sel)) if (!r.contains(e)) return e;
    return null;
}
function pageText() {
    const r = _vasyRoot();
    if (!r || !document.body) return (document.body && document.body.innerText) || '';
    return [...document.body.children].filter(c => c !== r && c.getClientRects().length)
        .map(c => c.innerText || '').join('\n');
}
async function settle(maxMs = 1500, opts = {}) {
    const floor = opts.floor != null ? opts.floor : Math.min(350, Math.max(140, maxMs * 0.22));
    const quiet = opts.quiet != null ? opts.quiet : 300;
    const t0 = Date.now();
    await sleep(floor);
    let lastMut = Date.now(), mo = null;
    try {
        const root = _vasyRoot();
        mo = new MutationObserver(muts => {
            for (const m of muts) {
                if (root && root.contains(m.target)) continue;
                if (m.type === 'attributes' && /^data-vasy/i.test(m.attributeName || '')) continue;
                lastMut = Date.now(); return;
            }
        });
        mo.observe(document.documentElement,
                   { childList: true, subtree: true, attributes: true, characterData: true });
    } catch (e) {}
    try {
        while (Date.now() - t0 < maxMs) {
            if (_inflight() === 0 && Date.now() - lastMut >= quiet) break;
            await sleep(60);
        }
    } finally { if (mo) { try { mo.disconnect(); } catch (e) {} } }
    return Date.now() - t0;
}


// ── Fuzzy matching helpers (shared) ──────────────────────────────────────────
// Space/case/punctuation-insensitive similarity 0..1 — tolerant of joined/split
// words ("mousepad" ≈ "mouse pad") and small typos (bigram dice coefficient).
function vasyNorm(x) { return String(x == null ? '' : x).toLowerCase().replace(/[^a-z0-9]/g, ''); }
function vasyFuzzy(query, candidate) {
    const nq = vasyNorm(query), nc = vasyNorm(candidate);
    if (!nq || !nc) return 0;
    if (nq === nc) return 1;
    if (nc.startsWith(nq) || nq.startsWith(nc)) return 0.93;
    if (nc.includes(nq) || nq.includes(nc)) return 0.85;
    const big = s => { const m = {}; for (let i = 0; i < s.length - 1; i++) { const b = s.substr(i, 2); m[b] = (m[b] || 0) + 1; } return m; };
    const a = big(nq), b = big(nc); let inter = 0, ta = 0, tb = 0;
    for (const k in a) { ta += a[k]; if (b[k]) inter += Math.min(a[k], b[k]); }
    for (const k in b) tb += b[k];
    return (2 * inter) / ((ta + tb) || 1);
}
// Pick the highest-scoring item from a list; getText extracts the compare string.
function vasyBest(query, items, getText, minScore = 0.45) {
    let best = null, bestScore = -1;
    for (const it of items) {
        const sc = vasyFuzzy(query, getText(it));
        if (sc > bestScore) { bestScore = sc; best = it; }
    }
    return bestScore >= minScore ? { item: best, score: bestScore } : null;
}

// ── Self-learning aliases ─────────────────────────────────────────────────────
// When a fuzzy search resolves "oshwal shinde" → "oswal shinde tesla company…",
// remember it: next time the same phrase resolves instantly. The agent adapts to
// each merchant's real data over time. Stored in chrome.storage 'vasyAliases'.
function getAlias(term) {
    return new Promise(res => {
        try { chrome.storage.local.get(['vasyAliases'], r =>
            res((r.vasyAliases || {})[vasyNorm(term)] || null)); }
        catch (e) { res(null); }
    });
}
function saveAlias(term, resolvedText) {
    if (!term || !resolvedText || vasyNorm(term) === vasyNorm(resolvedText)) return;
    if (/#\d{3,}\s*$/.test(String(term))) return;          // a pinned pick is not a phrasing
    try { chrome.storage.local.get(['vasyAliases'], r => {
        const a = r.vasyAliases || {};
        a[vasyNorm(term)] = resolvedText;
        const keys = Object.keys(a);
        if (keys.length > 200) delete a[keys[0]];
        chrome.storage.local.set({ vasyAliases: a });
    }); } catch (e) {}
}

// ── Universal field-setter — SHARED across every ERP page ────────────────────
// Finds an input by (1) any of the given ids, (2) placeholder regex, (3) nearest
// <label>/column-header text regex — so handlers written for legacy pages keep
// working when a module is rebuilt in React (labels survive id changes).
// Returns true only if a value actually landed.
function smartSet(value, { ids = [], ph = null, label = null, scope = document } = {}) {
    if (value == null || value === '') return false;
    let el = null;
    for (const id of ids) { const c = document.getElementById(id); if (c && c.offsetParent) { el = c; break; } }
    if (!el && ph) el = [...scope.querySelectorAll('input,textarea')].find(i => i.offsetParent && ph.test(i.placeholder || ''));
    if (!el && label) {
        const heads = [...scope.querySelectorAll('label,th,div,span')].filter(h =>
            h.offsetParent && h.children.length <= 1 && label.test((h.innerText || '').trim()) && (h.innerText || '').trim().length < 40);
        for (const h of heads) {
            const near = (h.htmlFor && document.getElementById(h.htmlFor))
                      || h.parentElement?.querySelector('input,textarea')
                      || (h.nextElementSibling && h.nextElementSibling.querySelector && h.nextElementSibling.querySelector('input,textarea'))
                      || h.closest('div')?.querySelector('input,textarea');
            if (near && near.offsetParent) { el = near; break; }
        }
    }
    if (!el) return false;
    setVal(el, value);
    return true;
}

// Wrap every handler — uncaught exceptions always call reply() so bubble never locks.
// The guard after it covers the quieter failure: a handler that RETURNS without a
// reply, a save watcher or a hand-off to the next page left the bubble waiting out
// its full 90 s. If nothing is pending 4 s later, say what happened instead.
function safeRun(fn, label, opts = {}) {
    __vasyTask      = label;
    __vasyConfirmed = !!opts.confirmed;
    __vasyAsked     = false;   // fresh task — any earlier open question is done with
    __vasyReplied   = false;
    const run = ++__vasyRunId;
    return Promise.resolve().then(() => fn()).catch(err => {
        reply('error', null, `${label} failed unexpectedly: ${err.message || 'Unknown error. Please try again.'}`);
    }).then(() => {
        setTimeout(async () => {
            if (run !== __vasyRunId || __vasyReplied || window.__vasyWatcher) return;
            let handedOff = false;   // the background may be opening the next page for this task
            try { const r = await chrome.runtime.sendMessage({ action: 'nav_pending' }); handedOff = !!(r && r.pending); } catch (e) {}
            if (handedOff || run !== __vasyRunId || __vasyReplied || window.__vasyWatcher) return;
            vtrace('guard:silent');
            reply('info', null, `I worked through <b>${taskHumanSafe(label)}</b> on this page, but VasyERP showed nothing I could read back as a result. ` +
                  `Check the screen — I'm not waiting on anything, so you can carry on.`);
        }, 4000);
    });
}
const taskHumanSafe = t => (typeof taskHuman === 'function' ? taskHuman(t) : String(t || 'that'));

// ── Confirm-before-save safety layer ─────────────────────────────────────────
// Policy taken from the VasyERP manuals: anything that POSTS MONEY to a ledger,
// changes STOCK ON HAND, alters TAX/NUMBERING configuration, or drives an
// APPROVAL workflow must never be written without an explicit human OK. The
// agent fills the form, shows what it is about to save, and waits for "yes".
// Enforced in the ONE place every handler funnels through: clickSaveBtn().
const RISKY_TASKS = new Set([
    // posts money
    'Payment','Receipt','BillPayment','InvoiceReceipt','BankTransaction','Expense',
    // changes outstanding balances / stock / tax outcomes
    'CreditNote','DebitNote','AcctCreditNote','AcctDebitNote','JournalVoucher','PurchaseReturn','SalesReturn',
    // changes stock on hand
    'StockAdjust','StockVerification','StockTransfer','StockTransferRequest','MaterialConsumption','MaterialCreation','OpeningStock',
    'BillOfMaterials',   // V9.14.0: a production run — "Post production" consumes ingredients, adds goods
    // approval workflows
    'TransferApproval',
    // global config that affects every downstream document
    'Prefix','Tax','PaymentTerms','AdditionalCharges',
]);
// Held for the reason above, but they post nothing — say so accurately.
const CONFIG_TASKS = new Set(['Prefix','Tax','PaymentTerms','AdditionalCharges']);
// Purchase-side documents subject to the "File attachment mandatory" setting
const PURCHASE_TASKS = new Set(['PurchaseOrder','MaterialInward','SupplierBill','DebitNote','PurchaseReturn']);
let __vasyTask = null;
let __vasyConfirmed = false;
// Set when a party-lookup endpoint answers "temporarily disabled due to high
// load" so we blame the server, not the user's data.
let __vasyLookupDisabled = '';
// Set when we've asked the user something mid-task and must not save without it.
let __vasyAsked = false;
// A one-off note to append to the next success message (e.g. a value we derived).
let __vasyNote = '';

// Up to 6 labelled, filled fields — so the user sees exactly what will be saved.
function pendingSummary() {
    const out = [];
    const seen = new Set();
    // The item lines are what the user most needs to check, and they sit at the
    // bottom of the form, past the six-row cap — so list them first.
    const lines = [];
    // Product cell text, minus dropdown chrome ("Select product …") and the
    // repeats a select2 widget renders ("Notebook1 Notebook1 Noteb…").
    const cellName = row => {
        for (const td of row.querySelectorAll('td')) {
            const sel = td.querySelector('select');
            let x = sel && sel.selectedIndex > 0 ? (sel.options[sel.selectedIndex].text || '') : (td.innerText || '');
            x = x.replace(/\s+/g, ' ').replace(/^select\s+\w+\s*/i, '').trim();
            if (!/[A-Za-z]{2,}/.test(x) || x.length > 70) continue;
            const w = x.split(' '); const out = [];
            for (const t of w) if (!out.some(o => o.toLowerCase() === t.toLowerCase() || o.toLowerCase().startsWith(t.toLowerCase()))) out.push(t);
            return out.join(' ');
        }
        return '';
    };
    const pushLine = (row, q, p) => { const nm = row ? cellName(row) : '';
        if (nm) lines.push(`${nm.slice(0, 40)}${q ? ` × ${q}` : ''}${p && parseFloat(p) ? ` @ ${p}` : ''}`); };
    for (const code of pageQSA('input[id^="itemcode"]')) {
        if (!code.offsetParent || !code.value || /\{/.test(code.id)) continue;
        const k = code.id.replace('itemcode', '');
        const row = code.closest('tr');
        const nameEl = row && row.querySelector('input[id^="productName"],input[id^="itemName"],input[id^="itemname"],input[id^="productname"]');
        const q = (document.getElementById('qty' + k) || document.getElementById('poqty' + k) || {}).value;
        const p = (document.getElementById('price' + k) || {}).value;
        if (nameEl && nameEl.value) lines.push(`${nameEl.value.replace(/\s+/g, ' ').slice(0, 40)}${q ? ` × ${q}` : ''}${p && parseFloat(p) ? ` @ ${p}` : ''}`);
        else pushLine(row, q, p);
    }
    // Production grids (v9.13.0 React): .item-table-row / .mct__row
    if (!lines.length) {
        for (const r of pageQSA('.item-table-row, .mct__row')) {
            if (!r.getClientRects().length) continue;
            const nm = (r.querySelector('.item-row-name, [class*=name]') || {}).innerText || '';
            const code = (r.querySelector('.item-row-sku, .vch, [class*=sku]') || {}).innerText || '';
            const q = (r.querySelector('input.mc-qty-input-field, input[type=number]') || {}).value;
            const label = (nm.trim() && nm.trim() !== '—' ? nm.trim() : code.trim()) || cellName(r);
            if (label) lines.push(`${label.replace(/\s+/g, ' ').slice(0, 40)}${q ? ` × ${q}` : ''}`);
        }
    }
    // Grids without item-code ids (transfer requests): any visible row with a qty box
    if (!lines.length) {
        for (const qEl of pageQSA('table tbody input[id^="qty"]')) {
            if (!qEl.offsetParent || /\{/.test(qEl.id)) continue;
            pushLine(qEl.closest('tr'), qEl.value);
        }
    }
    if (lines.length) out.push(`&nbsp;• <b>Lines</b>: ${lines.slice(0, 4).join('; ').replace(/</g, '&lt;')}${lines.length > 4 ? ` (+${lines.length - 4} more)` : ''}`);
    const fields = [];
    for (const el of pageQSA('input,select,textarea')) {
        if (!el.offsetParent || ['hidden','search','file','password','checkbox','radio'].includes(el.type)) continue;
        // auto numbers and item-grid cells (already in "Lines"); a lone price cell
        // with no item lines is the AMOUNT (expense lines), so keep that one
        if (el.readOnly || /^(itemcode|qty|poqty|discount)\d/i.test(el.id || '') ||
            (lines.length && /^price\d/i.test(el.id || ''))) continue;
        let val = el.tagName === 'SELECT' ? (el.options[el.selectedIndex]?.text || '').trim() : (el.value || '').trim();
        if (!val || /^(select|choose|all|0|0\.00|none)$/i.test(val) || /^select\b/i.test(val)) continue;
        // labelNear() sometimes lands on a neighbouring figure — the receipt's
        // amount box came out as "0: 100". A label has to contain words.
        const dedupe = x => x.split(' ').filter((w, i, a) => a.indexOf(w) === i && !/^(?:custom|vos?|item|dto|list)$/i.test(w)).join(' ');
        const lbl = [labelNear(el), el.placeholder, el.getAttribute('aria-label'), dedupe(humaniseId(el.name)), dedupe(humaniseId(el.id))]
            .map(x => String(x || '').replace(/\s+/g, ' ').trim().replace(/\*+$/, '').trim())
            .find(x => x && /[A-Za-z]{2,}/.test(x) && x.length <= 34) || '';
        if (!lbl || seen.has(lbl) || /^(focus on|jump to|search)/i.test(lbl)) continue;
        seen.add(lbl);
        // What the user must check first: money and quantities, then who/which
        // ledger. Housekeeping (dates, tax type, reverse charge, numbering) last.
        const key = lbl + ' ' + (el.id || '') + ' ' + (el.name || '');
        const rank = /amount|total|price|rate|value|qty|quantity|points/i.test(key) ? 0
                   : /party|customer|supplier|vendor|account|ledger|branch|location|employee|name/i.test(key) ? 1
                   : /reverse\s*charge|tax\s*type|^type\b|prefix|\bno\b|number/i.test(key) ? 3 : 2;
        fields.push({ rank, row: `&nbsp;• <b>${lbl.replace(/</g,'&lt;')}</b>: ${val.slice(0, 40).replace(/</g,'&lt;')}` });
    }
    fields.sort((a, b) => a.rank - b.rank);
    for (const f of fields) { if (out.length >= 7) break; out.push(f.row); }
    return out;
}

// ── Reverse Charge (v9.12.0: now on BOTH Sales and Purchase documents) ───────
// GST compliance flag. Defaults to "No"; only touched when the user asks for it.
async function applyReverseCharge(data) {
    if (data.reverseCharge == null) return;
    const want = /^(y|yes|true|1|on|applicable)$/i.test(String(data.reverseCharge)) ? 'Yes' : 'No';
    const sel = document.getElementById('reverseCharge')
             || [...pageQSA('select')].find(s =>
                    (s.offsetParent || s.closest('.select2,.form-group')) && /reverse\s*charge/i.test(labelNear(s) + ' ' + (s.id || '')));
    if (!sel) return;
    const opt = [...sel.options].find(o => new RegExp(`^${want}$`, 'i').test((o.text || '').trim()));
    if (opt) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        try { window.jQuery?.(sel).trigger('change'); } catch (e) {}
        await sleep(600);   // switching RCM re-computes the tax block
    }
}

// ── Shared: fill a <select> found by its LABEL (select2 ajax or plain) ───────
// Returns true | false | 'asked' (ambiguous, user was asked to choose).
async function selectByLabel(labelRe, value, what, scope = document) {
    if (!value) return true;
    const sel = [...scope.querySelectorAll('select')].find(s =>
        (s.offsetParent || s.closest('.select2,.form-group')) &&
        (labelRe.test(labelNear(s)) || labelRe.test(s.id || '') || labelRe.test(s.name || '')));
    if (!sel) return false;
    if (setSelect2Text(sel.id, value)) return true;
    const viaAjax = await fillSelect2(sel.id, value);
    if (viaAjax === 'asked') return 'asked';
    if (viaAjax) return true;
    const opts = [...sel.options].filter(o => o.value);
    const hit = vasyBest(value, opts, o => (o.text || '').trim(), 0.45);
    if (hit) { sel.value = hit.item.value; sel.dispatchEvent(new Event('change', { bubbles: true })); return true; }
    reply('error', null, `${what} "<b>${value}</b>" not found.` +
        (opts.length ? ` Options include: ${opts.slice(0, 6).map(o => (o.text||'').trim()).join(' / ')}` : ''));
    return 'asked';   // already told the user; caller must stop
}

// ── PRE-FLIGHT 1: permission ─────────────────────────────────────────────────
// Role permissions are per-module (Insert/View/Edit/Delete). Rather than click
// and fail, look for POSITIVE evidence of denial. Never block on the mere
// absence of a form — React pages render late and that would cause false alarms.
// V9.14.0: a menu the role can't open renders "Access Denied — You have no rights for this Menu."
const DENY_RE = /\b(access denied|not authorized|unauthorized|permission denied|you (?:do not|don'?t) have (?:the )?(?:permission|access|rights)|you have no rights|no rights for this menu|no permission|not allowed to (?:access|view|create))\b/i;
function permissionBlocked(entityLabel) {
    if (/\/login/i.test(location.pathname)) {
        reply('error', null, 'Your VasyERP session has expired — please sign in again, then repeat the command.');
        return true;
    }
    const txt = pageText().slice(0, 4000);
    const m = txt.match(DENY_RE);
    if (m) {
        reply('error', null,
            `VasyERP won't let this user do that: "<b>${m[0]}</b>".<br>` +
            `<small>${entityLabel} needs <b>Insert/Edit</b> rights for that module — ask an admin to grant it in Users → User Roles.</small>`);
        return true;
    }
    return false;
}

// ── PRE-FLIGHT 2: mandatory attachment ───────────────────────────────────────
// Purchase setting "File attachment mandatory" makes the server reject a save
// with no invoice/PO file. We cannot (and must not) upload files, so when the
// form marks an attachment as required we fill everything and hand over.
// Is a file genuinely compulsory on THIS form?
//
// This used to answer yes whenever a file input carried `required`, or whenever
// an asterisk appeared within 200 characters of one. Both are worthless signals
// here: VasyERP ships `required` on #file-upload as static markup regardless of
// the setting, and purchase forms are dense with asterisks belonging to other
// fields. The result was the agent confidently refusing to save purchase orders,
// GRNs and supplier bills that save perfectly well — verified by filling a PO,
// pressing Save by hand, and watching it write /purchase/order/4086599.
//
// So: only believe explicit wording tied to the file control itself. If the ERP
// really does enforce an attachment, the save will fail and watchResult() will
// report the ERP's own words — a worse-case that is still honest, and far better
// than blocking a save that would have worked.
function attachmentRequired() {
    const files = [...pageQSA('input[type="file"]')]
        .filter(f => f.offsetParent || f.closest('label,.form-group'));
    for (const f of files) {
        const own = (labelNear(f) || '').trim();
        const box = (f.closest('.form-group,label')?.innerText || '').replace(/\s+/g, ' ').slice(0, 120);
        // "Attachment is mandatory", "Upload document (compulsory)" — the word has
        // to sit next to the file control, not merely somewhere on the page.
        if (/\b(mandator|compulsor)/i.test(own + ' ' + box)) return true;
    }
    return false;
}

// What the user calls each held task (the internal names read like code)
const TASK_HUMAN = {
    BillOfMaterials: 'production run', SalesReturn: 'credit note', PurchaseReturn: 'debit note', DebitNote: 'debit note',
    CreditNote: 'credit note', AcctCreditNote: 'accounting credit note', AcctDebitNote: 'accounting debit note',
    StockAdjust: 'stock adjustment', InvoiceReceipt: 'invoice receipt', BillPayment: 'bill payment',
    BankTransaction: 'bank / cash transfer', JournalVoucher: 'journal voucher', OpeningStock: 'opening stock',
    StockTransferRequest: 'stock transfer request', TransferApproval: 'transfer approval', AdditionalCharges: 'additional charges',
    PaymentTerms: 'payment terms',
};
const taskHuman = t => TASK_HUMAN[t] || String(t || '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
function askSaveConfirmation(extraNote = '') {
    killWatcher();
    try { chrome.runtime.sendMessage({ action: 'pending_save', task: __vasyTask, url: location.href }); } catch (e) {}
    const rows = pendingSummary();
    reply('info', 'Ready to save — confirm?',
        `I've filled in the <b>${taskHuman(__vasyTask)}</b> form but <b>have not saved it</b>.` +
        (rows.length ? `<br>${rows.join('<br>')}` : '') +
        `<br><small style="color:#888">${extraNote || (CONFIG_TASKS.has(__vasyTask)
            ? 'This is a setting every new document will use, so I never save it without your OK.'
            : 'This posts to your books or changes stock, so I never save it without your OK.')}</small>` +
        `<br>(yes/cancel)`);
}

// ── Field alias resolver — parser tiers and older saved states use different key names ──
function norm(data, entity) {
    const d = Object.assign({}, data);
    // Parser keys that no handler read — each one silently left a compulsory
    // box empty and the ERP refused the save ("Discount Code* The Title Is
    // Required"). Map them onto what the handlers actually read.
    if (d.discountName && !d.title) d.title = d.discountName;
    if (entity === 'BillOfMaterials' && !d.recipeName && !d.recipe && d.productName) d.recipe = d.productName;   // options end "RCP<n>-<product>"
    if (entity === 'Recipe' && d.productName) {
        d.finishedItemName = d.finishedItemName || d.outputItemName || d.productName;
        d.recipeName = d.recipeName || d.name || d.productName;                                           // Recipe Name* is compulsory
    }
    // name aliases
    if (!d.firstName && (d.name || d.contactName)) {
        const full = (d.name || d.contactName || '').trim().split(/\s+/);
        d.firstName = full[0] || '';
        if (!d.lastName && full.length > 1) d.lastName = full.slice(1).join(' ');
    }
    // supplier / customer aliases
    d.supplierName = d.supplierName || d.supplier || d.vendorName || d.vendor || d.partyName || '';
    d.customerName = d.customerName || d.customer || d.clientName || d.client || d.partyName || '';
    // item aliases
    d.itemName = d.itemName || d.productName || d.item || d.product || '';
    // mobile aliases
    d.mobile = d.mobile || d.mobileNo || d.phone || d.phoneNo || d.contact || '';
    return d;
}

// ── React/jQuery-safe value setter ────────────────────────────────────────────
function setVal(el, val) {
    if (!el || val == null || val === '') return false;
    const v = String(val);
    el.focus();
    try {
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
        if (setter) setter.call(el, v); else el.value = v;
    } catch(e) { el.value = v; }
    ['input','change','keyup'].forEach(ev => el.dispatchEvent(new Event(ev, {bubbles:true})));
    try { if (window.jQuery) window.jQuery(el).trigger('change'); } catch(e) {}
    el.blur();
    return true;
}

// Set a value and make sure it STAYS set. A Bootstrap dialog resets its form on
// `shown.bs.modal`, which fires after the fade completes — so a value written the
// moment the dialog becomes visible is silently wiped a tick later. Verifying and
// re-writing is the difference between a filled form and a 45-second timeout.
async function setValFirm(el, val, tries = 4) {
    if (!el || val == null || val === '') return false;
    const want = String(val);
    for (let i = 0; i < tries; i++) {
        setVal(el, want);
        await sleep(180);
        if (el.value === want) return true;
    }
    return el.value === want;
}

// ── Adaptive wait for element ─────────────────────────────────────────────────
// selector: CSS string, array of CSS strings, or function returning element
async function waitForEl(selector, ms = 4000) {
    const find = typeof selector === 'function' ? selector : () => {
        const sels = Array.isArray(selector) ? selector : [selector];
        for (const s of sels) {
            const el = pageQS(s);
            if (el) return el;
        }
        return null;
    };
    const end = Date.now() + ms;
    while (Date.now() < end) {
        const el = find();
        if (el) return el;
        await sleep(150);
    }
    return null;
}

// ── Adaptive wait for typeahead suggestions ───────────────────────────────────
async function waitForSuggestions(ms = 4000) {
    const SELS = ['.tt-suggestion', '.tt-menu .tt-suggestion', '.tt-dropdown-menu .tt-suggestion',
                  '.autocomplete-suggestion', '[class*="suggestion"]',
                  // React-style dropdowns (new VasyERP frontend)
                  '[role="listbox"] [role="option"]', 'ul[class*="autocomplete"] li',
                  '[class*="dropdown-menu"] [class*="item"]', '[class*="search-result"] li'];
    const end = Date.now() + ms;
    while (Date.now() < end) {
        for (const sel of SELS) {
            const opts = [...pageQSA(sel)].filter(o => o.offsetParent && (o.innerText||'').trim());
            if (opts.length) return opts;
        }
        await sleep(200);
    }
    return [];
}

// ── Wait for Select2 to finish initialising (DOM-based, works in any world) ───
async function waitForSelect2Init(selectId, timeoutMs = 3000) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
        const el = document.getElementById(selectId);
        // Select2 creates a rendered span with id "select2-{id}-container"
        const rendered = pageQS(`#select2-${selectId}-container`);
        if (el && rendered) return true;
        await sleep(200);
    }
    return false;
}

// ── Select2 + Typesense AJAX search ──────────────────────────────────────────
async function setSelect2Typesense(selectId, term) {
    const $ = window.jQuery;
    if (!$) return false;
    const sel = $(`#${selectId}`);
    if (!sel.length) return false;
    const aj = sel.data('select2')?.options?.options?.ajax;
    if (!aj || !aj.url) return false;
    const params = aj.data ? aj.data({term, page:1}) : {q:term};
    const headers = aj.headers || {};
    const url = aj.url + '?' + new URLSearchParams(params).toString();
    try {
        const res = await fetch(url, {headers});
        const data = await res.json();
        const hits = data.hits || data.results || data.items || [];
        if (!hits.length) return false;
        const doc = hits[0].document || hits[0];
        const text = (doc.name || doc.companyName || doc.text || term).trim();
        const val  = String(doc.id || doc.value || '');
        sel.append(new Option(text, val, true, true)).trigger('change');
        await sleep(300);
        return true;
    } catch(e) { return false; }
}

// ── Select2 + VasyERP internal AJAX search (works in MAIN world and ISOLATED world) ──
let __vasyThrottled = false, __vasyRetryAfterMs = 0;
const __vasySearchCache = new Map();
// Measured 06/10/2026: /contact/customers/find/select/json answers in 7–8 s on
// every call, so each invoice/PO/payment spent most of its time waiting for the
// same party to be found again. Found parties are remembered for a few hours
// (by search URL + term, so customers and suppliers never mix); a contact the
// agent deletes is forgotten at once.
const LOOKUP_TTL = 6 * 3600 * 1000;
function lookupCacheGet(key) {
    return new Promise(res => { try { chrome.storage.local.get(['vasyLookupCache'], r => {
        const e = (r.vasyLookupCache || {})[key];
        res(e && Date.now() - e.t < LOOKUP_TTL && Array.isArray(e.items) && e.items.length ? e.items : null);
    }); } catch (e) { res(null); } });
}
function lookupCacheSet(key, items) {
    try { chrome.storage.local.get(['vasyLookupCache'], r => {
        const c = r.vasyLookupCache || {};
        c[key] = { t: Date.now(), items: items.slice(0, 20) };
        const keys = Object.keys(c);
        if (keys.length > 300) keys.sort((a, b) => c[a].t - c[b].t).slice(0, keys.length - 300).forEach(k => delete c[k]);
        chrome.storage.local.set({ vasyLookupCache: c });
    }); } catch (e) {}
}
function lookupCacheForget(text) {
    const k = vasyNorm(text);
    if (!k) return;
    try { chrome.storage.local.get(['vasyLookupCache'], r => {
        const c = r.vasyLookupCache || {}; let changed = false;
        for (const key of Object.keys(c)) {
            if ((c[key].items || []).some(i => vasyNorm(i.text).includes(k)) || vasyNorm(key).includes(k)) { delete c[key]; changed = true; }
        }
        if (changed) chrome.storage.local.set({ vasyLookupCache: c });
    }); } catch (e) {}
}
async function setSelect2VasyAjax(selectId, term, opts = {}) {
    const $ = window.jQuery;
    const el = document.getElementById(selectId);
    if (!el) return false;
    // "<name> #<id>": the user tapped one of several same-name records
    let pinId = null;
    { const pm = String(term || '').match(/^(.*?)\s*#(\d{2,})\s*$/); if (pm) { term = pm[1].trim(); pinId = pm[2]; } }

    // ── Path A: jQuery available (main world) — use $.post which auto-adds CSRF header ──
    if ($) {
        const sel = $(`#${selectId}`);
        if (sel.length) {
            const aj = sel.data('select2')?.options?.options?.ajax;
            if (aj?.url) {
                const params = aj.data ? aj.data({term, page:1}) : {term};
                const postResult = await new Promise(resolve => {
                    $.post(aj.url, params, data => {
                        const items = data.results || data.items || data.hits || [];
                        const bp = vasyBest(term, items, r => r.text || '');
                        const match = (bp && bp.item) || items[0];
                        resolve(match ? {text: match.text || term, id: String(match.id || match.value || '')} : null);
                    }).fail(xhr => {
                        if (xhr && (xhr.status === 429 || xhr.status >= 500)) __vasyThrottled = true;
                        resolve(null);
                    });
                });
                if (postResult) {
                    sel.append(new Option(postResult.text, postResult.id, true, true)).trigger('change');
                    await sleep(300);
                    return true;
                }
            }
        }
        return false;
    }

    // ── Path B: Isolated world — read config stored in dataset by the MAIN-world helper ──
    // The helper retries until Select2 initialises; poke it and WAIT for the config
    // instead of failing instantly (this was the "not found while option is on
    // screen" race on slow pages).
    let ajUrl = el.dataset?.vasyAjaxUrl;
    if (!ajUrl) {
        const cfgEnd = Date.now() + 6000;
        while (Date.now() < cfgEnd && !(ajUrl = el.dataset?.vasyAjaxUrl)) {
            document.dispatchEvent(new CustomEvent('vasy:extract-select2'));
            await sleep(400);
        }
    }
    vtrace('cfg=' + (ajUrl ? 'ok' : 'none'));
    const ajKey    = el.dataset?.vasyAjaxKey    || 'term';
    const ajMethod = el.dataset?.vasyAjaxMethod || 'POST';
    if (!ajUrl) return false;

    const csrfToken  = pageQS('meta[name="_csrf"]')?.content || '';
    const csrfHeader = pageQS('meta[name="_csrf_header"]')?.content || 'X-CSRF-TOKEN';
    const doSearch = async (q) => {
        const body = new URLSearchParams({ [ajKey]: q, page: 1 }).toString();
        const res = await fetch(ajUrl, {
            method: ajMethod,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest',
                ...(csrfToken ? { [csrfHeader]: csrfToken } : {})
            },
            body: ajMethod === 'GET' ? undefined : body,
            credentials: 'include'
        });
        // 429 / 5xx is the server saying "not now", not "no such contact".
        // Measured: after ~10 lookups in a few seconds VasyERP answers 429 with an
        // HTML page, and treating that as an empty result is exactly how a
        // supplier that exists got reported as "not found" — and every retry the
        // user made pushed it deeper into the rate limit.
        if (res.status === 429 || res.status >= 500) {
            __vasyThrottled = true;
            const ra = parseInt(res.headers.get('Retry-After') || '', 10);
            __vasyRetryAfterMs = isFinite(ra) ? Math.min(ra * 1000, 20000) : 0;
            return null;
        }
        if (!res.ok) return [];
        const raw  = await res.text();
        const data = (() => { try { return JSON.parse(raw); } catch (e) { return {}; } })();
        // VasyERP shelves this lookup under load: {"status":false,"message":"This
        // API is temporarily disabled due to high load"}. Every term then returns
        // nothing, and reporting "customer not found" sends the user hunting for a
        // contact that exists. Flag the real cause instead.
        if (data && data.status === false && /temporarily disabled|high load/i.test(data.message || '')) {
            __vasyLookupDisabled = data.message;
            return [];
        }
        return data.results || data.items || data.hits || [];
    };

    try {
        // Learned alias first ("oshwal shinde" → exact stored display name)
        const learned = await getAlias(term);
        // Typo-tolerant variants: server ANDs each word as a prefix, so one bad
        // word ("oshwal") kills the search — fall back to distinctive tokens.
        const toks = term.split(/\s+/).filter(w => w.length >= 3);
        const byLen = toks.slice().sort((a, b) => b.length - a.length);
        const allVariants = [learned, term, byLen[0], byLen[1], toks[0], term.slice(0, 4)]
            .filter((v, i, arr) => v && v.length >= 3 && arr.indexOf(v) === i);
        // Up to six phrasings per attempt, times every patient retry, is what tipped
        // the server into rate-limiting. Early rounds try the name and ONE
        // distinctive fallback; only the final round widens to every variant.
        // Hits are cached per page so a retry never re-asks for something found.
        const variants = opts.finalRound ? allVariants : allVariants.slice(0, 3);
        let items = [];
        __vasyThrottled = false;
        for (const v of variants) {
            const key = ajUrl + '|' + ajKey + '|' + v.toLowerCase();
            let got = __vasySearchCache.get(key) || await lookupCacheGet(key);
            if (got) vtrace('q:' + v.slice(0, 12) + '=cached');
            if (!got) {
                got = await doSearch(v);
                vtrace('q:' + v.slice(0, 12) + '=' + (got ? got.length : 'x'));
                if (got === null) break;                       // throttled — stop hammering
                if (got.length) { __vasySearchCache.set(key, got); lookupCacheSet(key, got); }
                await sleep(350);                              // space the requests out
            }
            items = got;
            if (items.length) break;
        }
        if (!items.length) {
            if (__vasyLookupDisabled) {
                reply('error', null,
                    `VasyERP's contact lookup is switched off right now — it answers ` +
                    `<i>"${__vasyLookupDisabled}"</i>.<br>` +
                    `<small>This is the server, not your data: "<b>${term}</b>" may well exist. ` +
                    `Nothing was filled in. Pick the party from the dropdown yourself, or try again later.</small>`);
                return 'asked';   // stop the caller reporting "not found"
            }
            return false;
        }

        const scored = items.map(r => ({ r, sc: vasyFuzzy(term, r.text || '') }))
                            .sort((a, b) => b.sc - a.sc);
        // AMBIGUOUS: several close matches → ask the user instead of guessing.
        // An EXACT TIE has to be caught separately: this account really does hold
        // "shinchan mouse pad blue" AND "Shinchan mouse pad blue" as two different
        // products, both scoring 1.0. The old `sc < 0.97` guard let a perfect match
        // win outright, so we'd silently pick whichever the server listed first —
        // and move stock on the wrong record.
        const pinned = pinId ? items.find(r => String(r.id ?? r.value) === pinId) : null;
        if (pinned) scored.unshift({ r: pinned, sc: 1.01 });
        const tied = !pinned && scored.length > 1
            && vasyNorm(scored[0].r.text || '') === vasyNorm(scored[1].r.text || '');
        if (!pinned && scored.length > 1 && (tied || (scored[0].sc - scored[1].sc < 0.08 && scored[0].sc < 0.97))) {
            if (tied) {
                // Same name, different records — offer each by its id, labelled
                // with whatever the list shows (mobile, code) to tell them apart.
                const same = scored.filter(s => vasyNorm(s.r.text || '') === vasyNorm(scored[0].r.text || '')).map(s => s.r);
                askChoice('Which one?',
                    `There are <b>${same.length}</b> separate records named "<b>${(scored[0].r.text || term).trim()}</b>" on this account. <b>I've filled nothing in yet.</b>` +
                    `<br><small>Tap the right one:</small>`, term,
                    same.map((r, i) => ({ label: `${(r.text || term).trim()} · record ${i + 1}${r.mobile ? ' · ' + r.mobile : ''}`, value: `${(r.text || term).trim()} #${r.id ?? r.value}` })));
                return 'asked';
            }
            askChoice('Which one?', `Multiple close matches for "<b>${term}</b>" — which one did you mean?`, term,
                scored.slice(0, 4).map(x => ({ label: (x.r.text || '').trim(), value: (x.r.text || '').trim() })));
            return 'asked';
        }
        const match = scored[0].sc >= 0.45 ? scored[0].r : items[0];
        if (!match) return false;
        saveAlias(term, match.text || '');   // learn for next time

        // Set value natively — Select2 listens to native 'change' on the underlying <select>
        const opt = new Option(match.text || term, String(match.id || match.value || ''), true, true);
        el.appendChild(opt);
        el.value = String(match.id || match.value || '');
        el.dispatchEvent(new Event('change', {bubbles: true}));
        await sleep(300);
        return true;
    } catch(e) { return false; }
}

// ── Select2 with pre-loaded options ──────────────────────────────────────────
function setSelect2Text(selectId, term) {
    const $ = window.jQuery;
    const el = document.getElementById(selectId);
    if (!el || !term) return false;
    const lower = term.toLowerCase();
    const opt = [...el.options].find(o => o.value && o.text.toLowerCase().includes(lower));
    if (!opt) return false;
    if ($) $(el).val(opt.value).trigger('change');
    else setVal(el, opt.value);
    return true;
}

// ── Master Select2 filler: Typesense → pre-loaded → VasyAjax ─────────────────
// ── PATIENCE ────────────────────────────────────────────────────────────────
// VasyERP's party search is not instant, and it is not immediately consistent:
// the first lookup on a freshly loaded page is slow, and a contact saved a few
// seconds ago may not be in the search index yet. The old code made ONE pass and
// reported "not found" — so "create supplier X" followed by "create PO for X"
// failed even though X had just been saved. An empty answer now means "ask again
// in a moment", with backoff, until a deadline; only then is it "not found".
let __vasyLookupAttempts = 0, __vasyLookupMs = 0;
// ── Party warnings ──────────────────────────────────────────────────────────
// VasyERP warns about a party's history the moment it is picked — "This
// Customer Has Not Cleared Previous 1 Bills. Continue". Nobody answered that
// popup, so it swallowed the product pick and the invoice was saved with no line
// ("Please select product"). It is a warning, not a block, and the user asked for
// this document: press Continue, and tell them exactly what VasyERP said.
// Wording that means STOP (blocked / not allowed) is never clicked through.
let __vasyWarnNote = '';
async function acknowledgePartyWarning(maxMs = 2500) {
    const t0 = Date.now();
    vtrace('warn-check');
    while (Date.now() - t0 < maxMs) {
        const pop = [...pageQSA('.swal2-popup,.modal.show,.modal.in,[role=dialog]')]
            .find(m => m.offsetParent && !isChromeEl(m) && !/announcement|important notice|upgrade your hardware/i.test(m.innerText || '')
                    && /\bwarning\b|not\s+cleared|outstanding|credit\s+limit|overdue|pending\s+bills?/i.test(m.innerText || ''));
        if (pop) {
            const txt = (pop.innerText || '').replace(/\s+/g, ' ').replace(/^[!\s]+/, '').trim();
            const said = txt.replace(/\b(?:continue|cancel|ok|proceed|close)\b/gi, '').replace(/^warning\s*/i, '').replace(/[<>]/g, '').trim();
            if (/\b(?:blocked?|not\s+allowed|cannot|can't|exceeded)\b/i.test(txt)) return 'blocked:' + said;
            const btn = [...pop.querySelectorAll('button,a.btn')]
                .find(b => b.offsetParent && /^(?:continue|ok|proceed|yes)$/i.test((b.innerText || '').trim()));
            if (!btn) return 'unanswered:' + said;
            btn.click();
            // SweetAlert2 only removes a dialog when its hide ANIMATION ends, and a
            // browser tab that isn't in view runs no CSS animations — so if the user
            // switched tabs while I work, the answered warning stays on screen with
            // its button greyed out and swallows the next click (measured: that is
            // exactly how an invoice got saved with no product line). Once Continue
            // has registered (button disabled) the page's handler has already run;
            // the leftover is only the dialog shell, so clear it.
            const t1 = Date.now();
            while (Date.now() - t1 < 1800 && pop.isConnected && pop.offsetParent) await sleep(150);
            if (pop.isConnected && pop.offsetParent && btn.disabled) {
                pop.closest('.swal2-container')?.remove();
                document.body.classList.remove('swal2-shown', 'swal2-height-auto', 'swal2-no-backdrop', 'swal2-toast-shown');
                document.documentElement.classList.remove('swal2-shown', 'swal2-height-auto');
            }
            __vasyWarnNote = `VasyERP warned: “${said}” — I continued, since you asked for this document.`;
            try { chrome.storage.local.set({ vasyPendingNote: __vasyWarnNote }); } catch (e) {}
            await sleep(700);
            return 'continued';
        }
        // nothing on screen and the page has gone quiet — there is no warning
        if (Date.now() - t0 > 700 && _inflight() === 0) return null;
        await sleep(200);
    }
    return null;
}

async function fillSelect2(selectId, term, waitMs = 400, opts = {}) {
    const r = await fillSelect2Core(selectId, term, waitMs, opts);
    if (r === true && selectId === 'contactVo') {
        const w = await acknowledgePartyWarning();
        if (w && w.startsWith('blocked:')) {
            reply('error', 'VasyERP stopped this', `${w.slice(8)}<br><b>Nothing was saved.</b>`);
            return 'asked';
        }
        if (w && w.startsWith('unanswered:')) {
            reply('info', 'VasyERP is asking something', `VasyERP is showing: “${w.slice(11)}”. Answer it on screen, then send the command again. <b>Nothing was saved.</b>`);
            return 'asked';
        }
    }
    return r;
}

async function fillSelect2Core(selectId, term, waitMs = 400, opts = {}) {
    if (!term) return false;
    vtrace('party:' + selectId);
    await waitForSelect2Init(selectId);   // wait up to 3 s for Select2 to initialise
    vtrace('select2-ready');
    const $ = window.jQuery;
    const t0 = Date.now();
    const deadline = t0 + (opts.patienceMs != null ? opts.patienceMs : 20000);
    const gaps = [1200, 2000, 3000, 4000, 5000];
    let attempt = 0;
    for (;;) {
        attempt++;
        if ($) {
            // jQuery-dependent strategies (only in main world)
            if (await setSelect2Typesense(selectId, term)) { await sleep(waitMs); return true; }
            if (setSelect2Text(selectId, term)) { await sleep(200); return true; }
        }
        // VasyAjax handles jQuery and isolated-world paths internally
        const finalRound = Date.now() + gaps[Math.min(attempt - 1, gaps.length - 1)] > deadline;
        const r = await setSelect2VasyAjax(selectId, term, { finalRound });
        vtrace('lookup#' + attempt + '=' + r);
        if (r === 'asked') return 'asked';   // ambiguity / server-disabled — already explained
        if (r) { await sleep(waitMs); return true; }
        // Throttled: wait what the server asked for, or noticeably longer than a
        // normal retry — hammering a rate limit only extends it.
        let gap = gaps[Math.min(attempt - 1, gaps.length - 1)];
        if (__vasyThrottled) gap = Math.max(gap * 2, __vasyRetryAfterMs || 0, 4000);
        if (Date.now() + gap > deadline) break;
        await sleep(gap);
    }
    __vasyLookupAttempts = attempt;
    __vasyLookupMs = Date.now() - t0;
    return false;
}

// "Not found" that says what was actually tried, and — the commonest real cause —
// whether the name exists as the WRONG kind of contact. A supplier search only
// ever returns suppliers, so a contact saved as a customer is invisible to a
// purchase order however long we wait. The payment page's party lookup spans
// every contact type, which makes it the right place to ask.
async function partyNotFound(term, role) {
    if (__vasyThrottled) {
        reply('error', 'VasyERP is busy',
            `VasyERP is rate-limiting lookups right now (it answered <b>429 Too Many Requests</b>), ` +
            `so I couldn't check whether ${role} "<b>${term}</b>" exists. <b>Nothing was saved.</b>` +
            `<br><small>This is the server, not your data. Wait about half a minute and send the same ` +
            `command again — retrying straight away keeps the limit in place.</small>`);
        return;
    }
    let other = null;
    try {
        const { tok, hdr } = await _csrf();
        const res = await fetch('/payment/select/party/json', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded',
                       'X-Requested-With': 'XMLHttpRequest', ...(tok ? { [hdr]: tok } : {}) },
            body: new URLSearchParams({ accountname: term, page: 1 }).toString(),
        });
        const items = ((await res.json().catch(() => ({}))).items) || [];
        const hit = vasyBest(term, items, i => (i.text || '').trim(), 0.8);
        if (hit) other = (hit.item.text || '').trim();
    } catch (e) {}
    const secs = Math.max(1, Math.round(__vasyLookupMs / 1000));
    if (other) {
        reply('error', `${term} isn't a ${role}`,
            `<b>${other}</b> exists, but not as a <b>${role}</b> — it's saved as a different contact type, ` +
            `so the ${role} list never shows it. <b>Nothing was saved.</b>` +
            `<br><small>Open the contact and change its type to <b>${role[0].toUpperCase() + role.slice(1)}</b>, ` +
            `then ask again.</small>`);
        return;
    }
    reply('error', null,
        `I looked for ${role} "<b>${term}</b>" for ${secs}s (${__vasyLookupAttempts} tries) and VasyERP has none by that name. ` +
        `<b>Nothing was saved.</b>` +
        `<br><small>If you created it a moment ago, give it a few seconds and say it again — ` +
        `or check the spelling. 💡 Send me the corrected name and I'll retry.</small>`);
}

// ── Product search + select (Twitter Typeahead) ────────────────────────────────
// Delegates to the MAIN-world bridge (vasy_main_helper.js) which has real jQuery,
// the typeahead instance and its Bloodhound source. The bridge:
//   • progressive-prefix searches Bloodhound (so "Notebook1s" still finds "Notebook1 s")
//   • space/case-insensitive matches the best product
//   • fires typeahead:select (VasyERP's own row-adder) and sets qty/price on that row
//   • opens the Add-Product modal when nothing matches (if addIfMissing)
// Returns 'found' | 'add_product' | false.
//
// opts: { qty, price, inputId, addIfMissing }

// ── What the product box is actually offering right now ────────────────────
// A sales screen sells VARIANTS, not the parent product: ask for "Notebook1" and
// the sellable rows are "Notebook1 s", "Notebook1 m", "Notebook1 l"... The exact
// name matches nothing, so the lookup reports "not found" for a product the user
// can plainly see on the shelf. Read what the typeahead is offering and let the
// user pick, instead of denying the product exists.
//
// twitter typeahead listens on KEYUP, not input — setting .value alone never
// opens the menu. That one detail is why this looks empty if you test it wrong.
async function visibleItemSuggestions(query, inputId = 'searchItemBarcode') {
    const inp = document.getElementById(inputId);
    if (!inp) return [];
    try {
        // Clear first. After a stalled lookup the box already holds this exact
        // text, and typeahead ignores a value that has not changed — so setting
        // it again queries nothing and the list stays empty.
        setVal(inp, '');
        await sleep(120);
        setVal(inp, String(query));
        inp.focus();
        inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'e', bubbles: true }));
    } catch (e) { return []; }
    await sleep(2600);
    // Do NOT require the menu to be on screen. typeahead fills the list from the
    // remote response but only reveals it on a genuine focus/keystroke, so a
    // synthetic keyup leaves it populated and hidden — getClientRects() is empty
    // while the suggestions are sitting right there. The data is what we want.
    const rows = [...pageQSA('.tt-suggestion,.tt-selectable')]
        .map(e => (e.innerText || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    if (rows.length) return [...new Set(rows)].slice(0, 8);
    const menu = pageQS('.tt-menu,.tt-dropdown-menu');
    if (!menu) return [];
    const list = (menu.innerText || '').split('\n').map(x => x.trim()).filter(Boolean);
    return [...new Set(list)].slice(0, 8);
}

// ── react-select inside a MUI dialog ────────────────────────────────────────
// The generic fillReactSelect() looks the control up by id or label, but these
// dialogs give the combobox a generated id (react-select-5-input) and keep the
// real field name only in the surrounding label text — so it never found them.
// This locates the control by the words next to it, which is how a person does it.
//
// Sequence matters: the menu only opens on a mousedown against the control div,
// and the option list is fetched fresh for whatever is typed, so the text has to
// go in AFTER the menu is open or the list comes back empty.
async function fillDialogSelect(dlg, labelRe, value, what) {
    const boxes = [...dlg.querySelectorAll('input[id^="react-select"]')].filter(i => i.offsetParent);
    const inp = boxes.find(i => labelRe.test(
        ((i.closest('.MuiFormControl-root,.MuiBox-root') || {}).innerText || '').replace(/\s+/g, ' ')));
    if (!inp) return 'no_control';

    inp.focus();
    const ctl = inp.closest('[class*="-control"]') || inp.parentElement.parentElement;
    ['mousedown', 'mouseup', 'click'].forEach(t =>
        ctl.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, button: 0 })));
    await sleep(500);

    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(inp), 'value').set;
    setter.call(inp, '');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(300);
    setter.call(inp, String(value));
    inp.dispatchEvent(new Event('input', { bubbles: true }));

    const readOpts = () => [...pageQSA('[class*="-option"],[role="option"]')]
        .filter(o => o.getClientRects().length)
        .filter(o => !/^\d+\s*\/\s*Page$/i.test((o.innerText || '').trim()));
    await waitForEl(() => readOpts().length ? true : null, 6000);
    let opts = readOpts();
    if (!opts.length) {
        // An empty list AFTER typing means the filter matched nothing — not that
        // the control is broken. Clear it, read what does exist, and name those:
        // "there is no department called X" is useful, "the list wouldn't load"
        // sends the user hunting for a fault that isn't there.
        setter.call(inp, '');
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        await waitForEl(() => readOpts().length ? true : null, 5000);
        opts = readOpts();
        if (!opts.length) return 'no_options';
        return 'nomatch:' + opts.slice(0, 6)
            .map(o => (o.innerText || '').trim())
            .filter(t => t && !/^select\b/i.test(t)).join(' · ');
    }

    const want = vasyNorm(value);
    const hit = opts.find(o => vasyNorm(o.innerText) === want)
             || opts.find(o => vasyNorm(o.innerText).startsWith(want))
             || (vasyBest(value, opts, o => o.innerText, 0.6) || {}).item;
    if (!hit) return 'nomatch:' + opts.slice(0, 6).map(o => (o.innerText || '').trim()).join(' · ');

    hit.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    hit.click();
    await settle(1200);
    return 'ok:' + (hit.innerText || '').trim();
}

// Which starred fields in this MUI dialog are still empty?
// MUI marks required labels with a trailing asterisk and backs each react-select
// with a hidden input, so "filled" means that hidden input has a value — the
// visible combobox input is always blank once a choice is committed.
function dialogMissingRequired(dlg) {
    const out = [];
    for (const lab of dlg.querySelectorAll('label, .MuiFormLabel-root, p, span, div')) {
        if (lab.children.length > 1) continue;
        const txt = (lab.innerText || '').replace(/\s+/g, ' ').trim();
        if (!/\*\s*$/.test(txt) || txt.length > 40) continue;
        const field = txt.replace(/\s*\*\s*$/, '').trim();
        if (!field) continue;
        // find the control that belongs to this label: same form-control wrapper
        const box = lab.closest('.MuiFormControl-root, .MuiBox-root, div');
        if (!box) continue;
        const ctrl = box.querySelector('input:not([type=hidden]), select, textarea')
                  || box.querySelector('input');
        const hidden = box.querySelector('input[type=hidden], input[id]:not([id^="react-select"])');
        const val = (hidden && hidden.value) || (ctrl && ctrl.value) || '';
        if (!String(val).trim() && !out.includes(field)) out.push(field);
    }
    return out.slice(0, 3);
}

// ── The v9.13.0 production rebuild ──────────────────────────────────────────
// Material Consumption and Material Creation were rewritten in React. Their old
// field ids are gone, the save buttons are now "Post stock-out" and "Post &
// create goods" (which the save-button heuristic would never have matched), and
// the product picker is a bespoke `.mc-search-dropdown-item` list that ignores
// synthetic selection entirely — click, full pointer sequence with coordinates
// on the painted hit-target, and ArrowDown/Enter were all verified to do
// nothing. A real keystroke picks an item; a dispatched one does not.
//
// So these two handlers no longer pretend. They fill what genuinely responds,
// then hand the line-entry back with the exact product and quantity to type. An
// agent that silently adds nothing and reports success is the failure this whole
// codebase has been built to avoid — saying "I got this far, you do the rest" is
// worth more than a confident lie.
function isRebuiltProductionPage() {
    if (pageQS('.mc-search-dropdown-item, .mc-search-dropdown, .search-dropdown-item, .item-table-row, .mct__row')) return true;
    if (document.getElementById('mc-note') || document.getElementById('mc-selectUOMEveryTime')) return true;
    return [...pageQSA('button')]
        .some(b => /^post\s+(stock-?out|&\s*create\s+goods)/i.test((b.innerText || '').trim()));
}
function productionSearchBoxes() {
    return [...pageQSA('input')]
        .filter(e => e.getClientRects().length && /scan barcode|enter product/i.test(e.placeholder || ''));
}
// ── Line entry on the rebuilt production pages (re-measured 01/10/2026) ──────
// The picker DOES respond now: type with the native value setter + an input
// event, then click the dropdown item (Consumption: .search-dropdown-item;
// Creation: .mc-search-dropdown-item). The line lands as .item-table-row
// (Consumption, qty box type=number, defaults to 1) or .mct__row.is-edit-line
// (Creation, qty box input.mc-qty-input-field). Box 0 on Creation is "Item
// taken" (raw), box 1 is "Goods received" (finished).
function typeLikeUser(el, text) {
    el.focus();
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(el, String(text));
    el.dispatchEvent(new Event('input', { bubbles: true }));
}
async function productionAddLine(boxIndex, term, qty) {
    const boxes = productionSearchBoxes();
    const box = boxes[boxIndex];
    if (!box) return { err: `the product box isn't on this page` };
    const ITEM = '.search-dropdown-item, .mc-search-dropdown-item';
    const ROW = '.item-table-row, .mct__row';
    const rowsBefore = pageQSA(ROW).length;
    let items = [];
    for (let attempt = 0; attempt < 3 && !items.length; attempt++) {
        typeLikeUser(box, '');
        await sleep(150);
        typeLikeUser(box, term);
        const end = Date.now() + 6000;
        while (Date.now() < end && !(items = [...pageQSA(ITEM)].filter(e => e.getClientRects().length)).length) await sleep(250);
        if (!items.length) await sleep(1500 * (attempt + 1));
    }
    if (!items.length) return { err: `nothing matching "${term}" came up` };
    const nameOf = e => (e.firstElementChild ? e.firstElementChild.innerText : e.innerText).replace(/\s+/g, ' ').trim();
    const want = vasyNorm(term);
    // exact name, exact item code, then a single item that starts with the term
    let hit = items.find(e => vasyNorm(nameOf(e)) === want)
           || items.find(e => vasyNorm(e.innerText).includes(want) && /\d/.test(term) && e.innerText.toUpperCase().includes(String(term).toUpperCase()));
    if (!hit) {
        const pre = items.filter(e => vasyNorm(nameOf(e)).startsWith(want));
        if (pre.length === 1) hit = pre[0];
        else return { ask: pre.length ? pre : items };
    }
    hit.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    hit.click();
    const tEnd = Date.now() + 6000;
    while (Date.now() < tEnd && pageQSA(ROW).length <= rowsBefore) await sleep(200);
    const rows = [...pageQSA(ROW)];
    if (rows.length <= rowsBefore) return { err: `I picked "${nameOf(hit)}" but no line appeared` };
    const row = rows[rows.length - 1];
    const qEl = row.querySelector('input.mc-qty-input-field, input[type=number]');
    if (qty != null && qEl) {
        typeLikeUser(qEl, String(qty));
        qEl.dispatchEvent(new Event('change', { bubbles: true }));
        qEl.blur();
        await sleep(400);
        if (parseFloat(qEl.value) !== parseFloat(qty)) return { err: `the quantity for "${nameOf(hit)}" didn't stick` };
    }
    return { ok: nameOf(hit) || term, row, qty: qEl ? qEl.value : qty };
}
function askWhichProduct(term, items, retry) {
    const opts = items.slice(0, 6).map(e => ({
        label: e.innerText.replace(/\s+/g, ' ').trim().slice(0, 60),
        value: (e.firstElementChild ? e.firstElementChild.innerText : e.innerText).replace(/\s+/g, ' ').trim() }));
    askChoice('Which one?', `More than one product fits "<b>${term}</b>". <b>Nothing was saved.</b>`, term, opts);
}

async function explainProductionRebuild(moduleLabel, lines, extraNote) {
    const want = lines.filter(Boolean)
        .map(l => `<b>${l.name}</b>${l.qty ? ` × ${l.qty}` : ''}${l.role ? ` (${l.role})` : ''}`);
    const boxes = productionSearchBoxes().length;
    reply('info', `${moduleLabel} — line entry is manual here`,
        `VasyERP rebuilt <b>${moduleLabel}</b> in v9.13.0, and its product box only accepts real typing — ` +
        `it ignores anything I send it, so I can't add the line myself. <b>Nothing was saved.</b>` +
        (want.length ? `<br>Type ${want.join(' and ')} into the ${boxes > 1 ? 'boxes' : 'box'} on screen` +
                       ` and press <b>${moduleLabel === 'Material Creation' ? 'Post & create goods' : 'Post stock-out'}</b>.`
                     : `<br>Add the lines on screen and press <b>${moduleLabel === 'Material Creation' ? 'Post & create goods' : 'Post stock-out'}</b>.`) +
        (extraNote ? `<br><small>${extraNote}</small>` : '') +
        `<br><small>I've opened the page and filled everything else I can.</small>`);
}

// ══════════════════════════════════════════════════════════════════════════════
// UNIVERSAL FIELD FILLER — "set GSTIN to 24ABCDE1234F1Z5", "change credit limit
// to 50000 and save", on whatever page is open.
// ──────────────────────────────────────────────────────────────────────────────
// Every bespoke handler knows a few fields by id. Everything else on a page was
// unreachable: _editGeneric() matched only an exact name/id, so "GSTIN" could
// never find name="gstNo". This finds a control the way a person does — by what
// is written next to it — using every reading available: the <label>, the
// placeholder, aria-label, the de-camelCased name/id, and the caption drawn
// above or to the left of it (the geometric pairing that the redesigned React
// screens need, because their captions are not in the control's ancestry).
//
// It never saves unless asked, never touches a password field, and on a page
// that posts money or moves stock it holds the save for an explicit "yes".
// ══════════════════════════════════════════════════════════════════════════════
const FIELD_SYNONYMS = [
    ['gstin', 'gst', 'gst no', 'gst number', 'gstin no', 'gst in'],
    ['mobile', 'phone', 'mobile no', 'mobile number', 'phone no', 'contact no', 'contact number', 'cell'],
    ['email', 'e mail', 'email id', 'mail id', 'mail'],
    ['pincode', 'pin', 'pin code', 'zip', 'zip code', 'postal code'],
    ['pan', 'pan no', 'pan number'],
    ['address', 'address line 1', 'address line', 'street'],
    ['company name', 'company', 'business name', 'firm name', 'firm'],
    ['credit limit', 'credit amount', 'limit'],
    ['credit days', 'credit period', 'payment days', 'due days'],
    ['opening balance', 'opening', 'opening amount'],
    ['hsn', 'hsn code', 'sac', 'sac code'],
    ['barcode', 'item code', 'sku', 'item code barcode'],
    ['mrp', 'maximum retail price'],
    ['notes', 'note', 'remark', 'remarks', 'narration', 'description', 'comment'],
    ['reference', 'ref', 'ref no', 'reference no', 'reference number'],
    ['due date', 'due'],
    ['city', 'town'],
    ['state', 'province'],
    ['discount', 'disc', 'discount percent'],
];
function fieldSynonyms(label) {
    const l = String(label || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const set = new Set([l]);
    for (const group of FIELD_SYNONYMS) if (group.includes(l)) group.forEach(g => set.add(g));
    return [...set];
}
// "gstNo" -> "gst no", "contact_mobile[0]" -> "contact mobile", "mrp-1" -> "mrp"
const humaniseId = s => String(s || '')
    .replace(/\[\w*\]|\{\w*\}/g, ' ').replace(/[-_]\d+$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-.]+/g, ' ')
    .replace(/\b(vo|id|dropdown)\b/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

function fillableControls() {
    return [...pageQSA('input,textarea,select')].filter(el => {
        if (isChromeEl(el) || el.closest('#vasy-root')) return false;
        const type = (el.type || '').toLowerCase();
        if (['hidden', 'submit', 'button', 'image', 'reset', 'file', 'search'].includes(type)) return false;
        if (/search|jump to anywhere|scan barcode/i.test(el.placeholder || '')) return false;
        // a select2 hides its <select> but it is still the control to drive
        if (el.tagName === 'SELECT') return el.offsetParent || el.nextElementSibling?.classList?.contains('select2');
        return !!el.offsetParent || !!el.closest('label,[class*="MuiSwitch"]')?.offsetParent;
    });
}
function captionsAround() {
    return [...pageQSA('label,p,span,div,h6,th,td')]
        .filter(e => e.children.length === 0 && e.getClientRects().length && !isChromeEl(e) && !e.closest('#vasy-root'))
        .map(e => ({ t: (e.innerText || '').replace(/\s+/g, ' ').replace(/\s*\*\s*$/, '').trim(), r: e.getBoundingClientRect() }))
        .filter(x => x.t.length > 1 && x.t.length < 60);
}
function controlReadings(el, caps) {
    const out = [];
    const push = (s, src = 'label') => {
        s = String(s || '').replace(/\s*\*\s*$/, '').replace(/\s+/g, ' ').trim();
        if (s && s.length < 70 && !out.some(o => o.t === s)) out.push({ t: s, src });
    };
    push(labelNear(el));
    push(el.placeholder);
    push(el.getAttribute('aria-label'));
    push(humaniseId(el.name), 'id');
    push(humaniseId(el.id), 'id');
    // caption geometry: directly above in the same column, or on the left in the same row
    const target = el.tagName === 'SELECT' && el.nextElementSibling?.classList?.contains('select2')
        ? el.nextElementSibling : el;
    const r = target.getBoundingClientRect();
    if (r.width || r.height) {
        let above = null, aboveD = 1e9, left = null, leftD = 1e9;
        for (const c of caps) {
            const dy = r.top - c.r.bottom;
            if (dy > -4 && dy < 48 && Math.abs(c.r.left - r.left) < 40 && dy < aboveD) { aboveD = dy; above = c.t; }
            const mid = r.top + r.height / 2, cm = c.r.top + c.r.height / 2;
            const gap = r.left - c.r.right;
            if (Math.abs(cm - mid) < 18 && gap >= 0 && gap < 420 && gap < leftD) { leftD = gap; left = c.t; }
        }
        push(above); push(left);
    }
    return out;
}
// Lower-case, drop the asterisk, the "Select"/"Enter" prefix dropdowns carry,
// and trailing index digits ("city code0" -> "city code").
const normReading = r => String(r || '').toLowerCase()
    .replace(/\*/g, ' ').replace(/[^a-z0-9 ]/g, ' ')
    .replace(/^(?:select|enter|choose|pick|add)\s+/, '')
    .replace(/(\D)\d+\b/g, '$1').replace(/\s+/g, ' ').trim();
function readingScore(want, reading) {
    const r = normReading(reading), w = normReading(want);
    if (!r || !w) return 0;
    if (r === w) return 1;
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp('\\b' + esc + '\\b').test(r)) {
        // "city" inside "city code" is a weaker hit than a field just called
        // "City": every extra word makes it more likely to be something else.
        const extra = r.split(' ').length - w.split(' ').length;
        return Math.max(0.74, 0.92 - 0.06 * Math.max(0, extra));
    }
    return vasyFuzzy(w, r);
}


// Strict option matching for dropdowns. vasyFuzzy() treats "is a substring" as
// a strong match, so the option "1" scored 0.85 against "VASY-TEE-01" and a
// product code was written into "Barcode Length". An option only counts when it
// IS the value, or clearly starts it, or the value sits inside a longer option
// ("Ahmedabad" in "Ahmedabad (GJ)") — never a short option buried in a long value.
function bestOption(value, opts) {
    const v = vasyNorm(value);
    if (!v) return null;
    let best = null, bs = 0;
    for (const o of opts) {
        const t = vasyNorm(o.text);
        if (!t) continue;
        let sc = 0;
        if (t === v) sc = 1;
        else if ((t.startsWith(v) || v.startsWith(t)) &&
                 Math.min(t.length, v.length) / Math.max(t.length, v.length) >= 0.5) sc = 0.9;
        else if (t.includes(v) && v.length >= 3) sc = 0.82;
        else { const f = vasyFuzzy(String(value), String(o.text)); if (f >= 0.8) sc = f * 0.95; }
        if (sc && t !== v && t.length < v.length * 0.5) sc = 0;   // "1" inside "vasytee01"
        if (sc > bs) { bs = sc; best = o; }
    }
    return bs >= 0.75 ? best : null;
}
const isAjaxSelect2 = el => el.tagName === 'SELECT' &&
    (el.classList.contains('select2-hidden-accessible') || el.nextElementSibling?.classList?.contains('select2')) &&
    [...el.options].filter(o => o.value !== '').length <= 1;

// Can this control even hold this value? "VASY-TEE-01" cannot go in a numeric
// box — and when it did, the page kept "1" and the filler reported success.
// Using the VALUE as evidence is also how a person tells "Barcode" from
// "Barcode Length": only one of them would take a product code.
const _numericValue = v => /^[\s₹$]*-?[\d,]*\.?\d+\s*%?$/.test(String(v).trim());
function valueFits(el, value) {
    const type = (el.type || '').toLowerCase();
    const v = String(value).trim();
    if (type === 'number' || el.getAttribute('inputmode') === 'numeric') return _numericValue(v);
    if (type === 'email') return /@/.test(v);
    if (type === 'tel') return /\d{5,}/.test(v.replace(/\D/g, '')) || /\d/.test(v);
    if (type === 'checkbox' || type === 'radio')
        return /^(yes|no|true|false|on|off|enable[d]?|disable[d]?|0|1|tick|untick|checked|unchecked)$/i.test(v);
    // An AJAX select2 holds no options until searched, so it can't be ruled out
    // here; any other dropdown must actually contain the value.
    if (el.tagName === 'SELECT' && !isAjaxSelect2(el))
        return !!bestOption(v, [...el.options].filter(o => o.value !== ''));
    return true;
}

function findControlByLabel(label, controls, caps, value) {
    const literal = normReading(label);
    const wants = fieldSynonyms(label);
    const scored = controls.map(el => {
        let best = 0, reading = '';
        for (const rd of controlReadings(el, caps)) {
            for (const w of wants) {
                let sc = readingScore(w, rd.t);
                // a guess built from a developer id ranks below a caption a person sees
                if (rd.src === 'id') sc *= 0.9;
                // The user's OWN word beats any synonym of it, even an exact one:
                // "mobile" means the field that says Mobile, not "Contact Number",
                // though both are phones. Synonyms are there to find a field that
                // has no literal match, not to outvote one that does.
                if (normReading(w) === literal) sc += 0.06;
                else sc *= 0.85;
                if (sc > best) { best = sc; reading = rd.src === 'id' && reading ? reading : rd.t; }
            }
        }
        return { el, sc: best, reading };
    }).filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc);
    const near = scored.slice(0, 3).map(x => x.reading);
    const fit = value === undefined ? scored : scored.filter(x => valueFits(x.el, value));
    const ranked = fit.filter(x => x.sc >= 0.72);
    if (!ranked.length) return { status: 'none', near };
    const top = ranked[0];
    const next = ranked.find(x => x.el !== top.el && normReading(x.reading) !== normReading(top.reading));
    if (next && top.sc - next.sc < 0.05)
        return { status: 'ambiguous', near: [top.reading, next.reading] };
    return { status: 'ok', el: top.el, reading: top.reading, ranked };
}

async function chooseReactSelectInput(inp, value) {
    inp.focus();
    const ctl = inp.closest('[class*="-control"]') || inp.parentElement?.parentElement || inp;
    ['mousedown', 'mouseup', 'click'].forEach(t =>
        ctl.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, button: 0 })));
    await sleep(400);
    const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(inp), 'value').set;
    set.call(inp, String(value));
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    const read = () => [...pageQSA('[class*="-option"],[role="option"]')]
        .filter(o => o.getClientRects().length && !/^\d+\s*\/\s*page$/i.test((o.innerText || '').trim()));
    await waitForEl(() => read().length ? true : null, 5000);
    const opts = read();
    const hit = opts.find(o => vasyNorm(o.innerText) === vasyNorm(value))
             || (vasyBest(value, opts, o => o.innerText, 0.55) || {}).item;
    if (!hit) return 'nooption:' + opts.slice(0, 5).map(o => (o.innerText || '').trim()).join(' · ');
    hit.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    hit.click();
    await settle(800);
    return 'ok:' + (hit.innerText || '').trim();
}
async function setControlValue(el, value) {
    const type = (el.type || '').toLowerCase();
    if (type === 'password') return 'refused';
    if (el.tagName === 'SELECT') {
        const opts = [...el.options].filter(o => o.value !== '' && !/^select\b/i.test((o.text || '').trim()));
        const hitOpt = bestOption(value, opts);
        const b = hitOpt ? { item: hitOpt } : null;
        const isS2 = el.classList.contains('select2-hidden-accessible') || el.nextElementSibling?.classList?.contains('select2');
        if (b) {
            if (isS2 && el.id && setSelect2Text(el.id, (b.item.text || '').trim())) return 'ok:' + b.item.text.trim();
            el.value = b.item.value;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return 'ok:' + (b.item.text || '').trim();
        }
        // an AJAX select2 holds no options until it has been searched
        if (isS2 && el.id) {
            const r = await fillSelect2(el.id, value);
            if (r === 'asked') return 'asked';
            if (r) return 'ok:' + value;
        }
        return 'nooption:' + opts.slice(0, 5).map(o => (o.text || '').trim()).join(' · ');
    }
    if (/^react-select-\d+-input$/.test(el.id || '')) return await chooseReactSelectInput(el, value);
    if (type === 'checkbox' || type === 'radio') {
        const want = !/^(no|false|off|disable|disabled|0|unchecked|untick|remove)$/i.test(String(value).trim());
        if (el.checked !== want) el.click();
        await sleep(200);
        return el.checked === want ? 'ok:' + (want ? 'on' : 'off') : 'rejected';
    }
    const before = el.value;
    setVal(el, String(value));
    await sleep(200);
    const now = String(el.value || '').trim();
    const restore = () => { try { setVal(el, before); } catch (e) {} };
    if (!now) { restore(); return 'rejected'; }
    // Numbers are allowed to be REFORMATTED (5000 -> 5,000.00). Anything else
    // has to come back recognisably the same — "VASY-TEE-01" stored as "1" is
    // the page mangling the value, and reporting that as done is corruption.
    const num = x => parseFloat(String(x).replace(/[^0-9.\-]/g, ''));
    if (_numericValue(value) && Math.abs(num(now) - num(value)) < 0.01) return 'ok:' + now;
    const a = String(value).trim().toLowerCase(), b = now.toLowerCase();
    if (a === b || b.includes(a) || vasyFuzzy(a, b) >= 0.8) return 'ok:' + now;
    restore();
    return 'mangled:' + now;
}
// pages where a save moves money or stock — hold it for a "yes"
const FILL_RISKY_PATH = /\/(payment|receipt|expense|journalvoucher|banktransaction|manager\/internaltransfer|stocktransfer|product\/stock|pos|sales\/(?:invoice|creditnote)|purchase\/(?:bill|debitnote)|materialconsumption|materialcreation)\b/i;

async function fillFieldsByLabel(data) {
    await settle(900);
    const pairs = Array.isArray(data.pairs) ? data.pairs.filter(p => p && p.label) : [];
    if (!pairs.length) { reply('error', null, 'Which field should I set, and to what? e.g. <i>"set GSTIN to 24ABCDE1234F1Z5"</i>'); return; }
    const controls = fillableControls();
    if (!controls.length) {
        reply('info', null, `There's no form on this page to fill. Open the record or form first, then tell me the fields.`);
        return;
    }
    const caps = captionsAround();
    const done = [], failed = [];
    const used = new Set();
    // Some dropdowns are filtered by another: the City list only holds the
    // selected State's cities, Sub Category waits on Category. Filling them in
    // the order the user happened to say them leaves the child looking at the
    // wrong list — so parents go first, whatever order they were spoken in.
    const RANK = l => /\bcountry\b/i.test(l) ? 0 : /\bstate\b/i.test(l) ? 1 : /\b(?:city|district)\b/i.test(l) ? 2
                    : /\bdepartment\b/i.test(l) ? 0 : /^(?:category)\b/i.test(l) ? 1 : /\bsub\s*category\b/i.test(l) ? 2
                    : /^brand\b/i.test(l) ? 1 : /\bsub\s*brand\b/i.test(l) ? 2 : 1;
    pairs.sort((a, b) => RANK(a.label) - RANK(b.label));
    for (const { label, value } of pairs) {
        const hit = findControlByLabel(label, controls.filter(el => !used.has(el)), caps, value);
        if (hit.status === 'none') {
            failed.push(`<b>${label}</b> — no field like that here${hit.near.length ? ` (closest: ${hit.near.join(', ')})` : ''}`);
            continue;
        }
        if (hit.status === 'ambiguous') {
            failed.push(`<b>${label}</b> — could be <b>${hit.near[0]}</b> or <b>${hit.near[1]}</b>; say which`);
            continue;
        }
        if ((hit.el.type || '').toLowerCase() === 'password') {
            failed.push(`<b>${label}</b> — that's a password field; I never type passwords, please enter it yourself`);
            continue;
        }
        // Try the best match; if it mangles or refuses the value, put it back and
        // try the next candidate — the value itself is evidence of which field
        // was meant. A dropdown's "no such option" is final: that IS the field.
        let res = null, chosen = hit;
        for (const cand of (hit.ranked || [hit]).slice(0, 3)) {
            res = await setControlValue(cand.el, value);
            chosen = cand;
            if (res === 'asked') return;
            if (!/^(mangled:|rejected$)/.test(String(res))) break;
        }
        hit.el = chosen.el; hit.reading = chosen.reading;
        used.add(hit.el);
        if (String(res).startsWith('ok:')) done.push(`<b>${hit.reading}</b> → ${String(res).slice(3)}`);
        else if (String(res).startsWith('mangled:')) failed.push(`<b>${label}</b> — every matching field changed "${value}" into something else, so I left them as they were`);
        else if (String(res).startsWith('nooption:')) {
            const dep = /\b(?:city|district)\b/i.test(hit.reading) ? 'State'
                      : /\bsub\s*category\b/i.test(hit.reading) ? 'Category'
                      : /\bsub\s*brand\b/i.test(hit.reading) ? 'Brand'
                      : /\bstate\b/i.test(hit.reading) ? 'Country' : null;
            failed.push(`<b>${hit.reading}</b> — no option "${value}"` +
                (String(res).length > 9 ? `; choices include ${String(res).slice(9)}` : '') +
                (dep ? `<br><small>This list follows <b>${dep}</b> — set the ${dep.toLowerCase()} too, e.g. ` +
                       `<i>"set ${dep.toLowerCase()} to … and ${label} to ${value}"</i>.</small>` : ''));
        }
        else if (res === 'refused') failed.push(`<b>${hit.reading}</b> — password field, left for you`);
        else failed.push(`<b>${hit.reading}</b> — the page didn't accept "${value}"`);
        await sleep(150);
    }

    const summary = (done.length ? `✓ ${done.join('<br>✓ ')}` : '') +
                    (failed.length ? `${done.length ? '<br>' : ''}✗ ${failed.join('<br>✗ ')}` : '');
    if (!data.save) {
        reply(done.length ? 'success' : 'error', done.length ? 'Filled — not saved yet' : 'Nothing filled',
            summary + (done.length ? `<br><small>Say <b>"save"</b> when it looks right.</small>` : ''));
        return;
    }
    if (failed.length) {
        reply('info', 'Not saved', summary + `<br><small>I didn't save because ${failed.length === 1 ? 'one field' : 'some fields'} didn't go in.</small>`);
        return;
    }
    if (FILL_RISKY_PATH.test(location.pathname)) {
        __vasyTask = __vasyTask || 'FieldFill';
        askSaveConfirmation('This page posts to your books or moves stock, so I hold the save for your OK.');
        return;
    }
    watchResult('Saved', [], summary);
    if (!clickSaveBtn()) reply('info', 'Filled — no Save button', summary + `<br><small>I couldn't find a Save button on this page.</small>`);
}

// ── Item masters: Department / Category / Brand on one React page ───────────
// v9.13.0 merged all three into /item-masters — a MUI page with a tab each and a
// "New <thing>" button whose label follows the selected tab. The old jQuery
// pages are gone or orphaned (/department 404s), so these three no longer share
// anything with createSimpleMaster and get their own flow.
const ITEM_MASTER_TABS = ['Department', 'Category', 'Brand'];
// /item-masters opens on Department; a Category or Brand list/search must pick its tab first.
async function _itemMasterTab(kind) {
    const want = ITEM_MASTER_TABS.find(t => t.toLowerCase() === String(kind || '').toLowerCase());
    if (!want) return false;
    const tab = await waitForEl(() => [...pageQSA('button[role="tab"]')]
        .find(e => new RegExp('^' + want + '\\b', 'i').test((e.innerText || '').trim())) || null, 12000);
    if (!tab) return false;
    if (tab.getAttribute('aria-selected') !== 'true') { tab.click(); await settle(2500); }
    return true;
}

async function createItemMaster(kind, data) {
    const want = ITEM_MASTER_TABS.find(t => t.toLowerCase() === String(kind).toLowerCase());
    if (!want) { reply('error', null, `I don't know an item master called "${kind}".`); return; }
    const name = (data.name || data.categoryName || data.brandName || data.departmentName || '').trim();
    if (!name) { reply('error', null, `What should the new ${want.toLowerCase()} be called?`); return; }

    // A dialog left open from a previous step swallows every click on the page
    // behind it, which looks exactly like "the tab isn't there".
    const stray = [...pageQSA('.MuiDialog-root')].find(d => d.getClientRects().length);
    if (stray) {
        const cancel = [...stray.querySelectorAll('button')].find(x => /^cancel$/i.test((x.innerText || '').trim()));
        if (cancel) { cancel.click(); await settle(1200); }
    }

    const tab = await waitForEl(() => [...pageQSA('button[role="tab"]')]
        .find(e => new RegExp('^' + want + '\\b', 'i').test((e.innerText || '').trim())) || null, 12000);
    if (!tab) {
        reply('error', null,
            `I couldn't find the <b>${want}</b> tab on the item masters page. ` +
            `<b>Nothing was saved.</b><br><small>The page may still have been loading — try again.</small>`);
        return;
    }
    if (tab.getAttribute('aria-selected') !== 'true') { tab.click(); await settle(2500); }

    const newBtn = await waitForEl(() => [...pageQSA('button')]
        .find(x => x.getClientRects().length &&
                   new RegExp('^(new|add)\\s+' + want + '\\b', 'i').test((x.innerText || '').trim())) || null, 8000)
        || [...pageQSA('button')].find(x => x.getClientRects().length &&
                   /^(new|add)\s+/i.test((x.innerText || '').trim()));
    if (!newBtn) {
        reply('error', null,
            `The <b>New ${want}</b> button isn't on this screen — your role may not be allowed to create ` +
            `${want.toLowerCase()}s. <b>Nothing was saved.</b>`);
        return;
    }
    newBtn.click();
    await settle(2500);

    const dlg = [...pageQSA('.MuiDialog-root,[role="dialog"]')]
        .find(d => d.getClientRects().length && d.querySelector('#name,input'));
    if (!dlg) { reply('error', null, `The New ${want} dialog didn't open. <b>Nothing was saved.</b>`); return; }

    const nameEl = dlg.querySelector('#name') || dlg.querySelector('input:not([type=hidden])');
    if (!nameEl) { reply('error', null, `No name field in the New ${want} dialog. <b>Nothing was saved.</b>`); return; }
    setVal(nameEl, name);
    await sleep(400);
    if (data.code)        setVal(dlg.querySelector('#code'), data.code);
    if (data.description) setVal(dlg.querySelector('#description'), data.description);

    // v9.13.0 gave Category a compulsory PARENT: "Categories roll up into a
    // department". Without one the Create button simply does nothing — no error,
    // no toast, the dialog just sits there — so this has to be filled, not hoped
    // for. The control is a react-select backed by a hidden #department input.
    // A Department IS the top of the taxonomy — it has no parent to pick, and
    // hunting for one leaves the handler waiting on a control that never exists.
    const dept = want === 'Department' ? null
               : (data.department || data.departmentName || data.parent);
    if (dept) {
        const r = await fillDialogSelect(dlg, /department/i, dept, 'department');
        if (String(r).startsWith('nomatch:')) {
            reply('info', null,
                `There's no department called "<b>${dept}</b>". <b>Nothing was saved.</b>` +
                `<br><small>Existing ones include: ${String(r).slice(8)}</small>`);
            return;
        }
        if (r === 'no_options') {
            reply('error', null,
                `The department list wouldn't load in the New ${want} dialog. <b>Nothing was saved.</b>`);
            return;
        }
    }
    await settle(1200);

    // Create stays disabled until React has accepted the name — pressing it while
    // disabled does nothing at all and looks like a save that vanished.
    const createBtn = [...dlg.querySelectorAll('button')]
        .find(x => /^(create|save|submit|add)$/i.test((x.innerText || '').trim()));
    if (!createBtn) { reply('error', null, `No Create button in the New ${want} dialog. <b>Nothing was saved.</b>`); return; }
    if (createBtn.disabled) {
        await waitForEl(() => createBtn.disabled ? null : true, 6000);
    }
    // Clicking a live-looking Create that the dialog is quietly ignoring is the
    // worst case: it looks saved and is not. Work out WHICH starred field is
    // still empty and say so, rather than reporting a generic refusal.
    const missing = dialogMissingRequired(dlg);
    if (createBtn.disabled || missing.length) {
        reply('info', missing.length ? 'One more thing' : null,
            missing.length
                ? `A ${want.toLowerCase()} also needs <b>${missing.join('</b>, <b>')}</b>, and VasyERP won't ` +
                  `accept the dialog without it. <b>Nothing was saved.</b>` +
                  `<br><small>Say it with the parent — e.g. <i>"create ${want.toLowerCase()} ${name} ` +
                  `under &lt;${missing[0].toLowerCase()}&gt;"</i>.</small>`
                : `VasyERP is still refusing the <b>Create</b> button for this ${want.toLowerCase()}. ` +
                  `<b>Nothing was saved.</b>`);
        return;
    }
    watchResult(`${want} Created`, [], `"${name}" added under ${want}.`);
    createBtn.click();
}

// ── Retail or wholesale? The rate on every line depends on it ──────────────
// Sales documents carry a contactType radio — Retailer / Wholesaler / Merchant /
// Other — and it is what tells VasyERP which of the product's price tiers to
// use. A "B2B sale" in this ERP is not a separate document: it is this radio set
// to Wholesaler, which pulls wholesalerPrice instead of retailerPrice.
//
// It has to be set BEFORE the item is added, because the rate is copied onto the
// line at the moment the line is created — flipping it afterwards leaves the
// document showing a wholesale customer billed at retail prices.
const TRADE_TIERS = ['retailer', 'wholesaler', 'merchant', 'other'];
async function setTradeTier(kind) {
    if (!kind) return null;
    const want = String(kind).toLowerCase();
    const target = TRADE_TIERS.find(t => t === want)
                || (/whole|b2b|bulk|trade|dealer|distribut/i.test(want) ? 'wholesaler'
                  : /retail|b2c|counter|consumer/i.test(want) ? 'retailer' : null);
    if (!target) return null;
    const radio = [...pageQSA('input[type="radio"]')]
        .find(r => (r.id === 'contactType' || r.name === 'contactType') &&
                   String(r.value).toLowerCase() === target);
    if (!radio) return null;
    if (!radio.checked) {
        radio.click();
        if (window.jQuery) { try { window.jQuery(radio).trigger('change'); } catch (e) {} }
        await settle(1800);          // the grid re-rates itself on this change
    }
    return target;
}

// ── Adding a line must ALWAYS produce an answer ─────────────────────────────
// Three things can stall here — the MAIN-world Bloodhound bridge, the DOM
// fallback, and the ERP's own typeahead — and a handler that stalls leaves the
// bubble spinning with nothing said, which is the one outcome worse than an
// error. Race the whole attempt against a ceiling, then explain whatever came
// back. Every document handler goes through this, so they cannot drift apart.
//
// ctx is 'purchase' or 'sales', and it changes the diagnosis: a purchase screen
// searches the whole catalogue, while a sales screen typically only offers what
// is actually sellable at this outlet — so "not found" there usually means "no
// stock here", which is a completely different thing to tell the user.
// Several lines from one sentence ("10 Notebook1 and 5 PP10955"): each goes in
// with its own qty and price. false = a line couldn't be added (already replied).
async function addLines(data, ctx, retryFor) {
    const items = Array.isArray(data.items) && data.items.length ? data.items
                : data.itemName ? [{ name: data.itemName, qty: data.qty, price: data.price }] : [];
    for (const it of items) {
        const d = { ...data, itemName: it.name, qty: it.qty || data.qty || 1, price: it.price != null ? it.price : (items.length === 1 ? data.price : undefined) };
        delete d.items;
        if (!await addLineOrExplain(d, it.name, ctx, retryFor(it))) return false;
    }
    return true;
}
// A discount the user asked for is never dropped. The line discount box flips
// between % and ₹ per row, so rather than guess, stop with everything else
// filled and let the user key it in.
function discountGate(data, docLabel) {
    if (!data.discount) return false;
    reply('info', 'Add the discount on screen',
        `I've filled in the ${docLabel}, but I don't set discounts myself yet — enter <b>${data.discount}</b> ` +
        `in the line's discount box, then press <b>Save</b>. <b>Nothing has been saved.</b>`);
    return true;
}

async function addLineOrExplain(data, itemName, ctx, retryPhrase) {
    // PATIENCE for products. A genuine product search takes a while (a cold sales
    // catalogue needs ~16s); a "no" that comes back in a couple of seconds is far
    // more often the catalogue not having loaded yet, or the server throttling,
    // than a product that doesn't exist. Ask again before believing a fast "no".
    const attemptOnce = async () => {
        try {
            return await Promise.race([
                searchAndSelectItem(itemName, { qty: data.qty, price: data.price,
                                                discount: data.discount, addIfMissing: true }),
                sleep(38000).then(() => 'timeout'),   // > the bridge's own 22s budget
            ]);
        } catch (e) { return 'error'; }
    };
    let t0 = Date.now();
    let res = await attemptOnce();
    for (const gap of [3000, 6000]) {
        const quickNo = res === false && Date.now() - t0 < 8000;
        if (!quickNo) break;
        await sleep(gap);
        t0 = Date.now();
        res = await attemptOnce();
    }

    if (res === 'found') return true;
    if (res === 'asked') return false;            // already explained itself
    if (res === 'norow' && __vasyNoRow && __vasyNoRow.qty != null && __vasyNoRow.qty <= 0) {
        const q = __vasyNoRow.qty;
        reply('info', 'Not enough stock',
            `VasyERP won't put <b>${itemName}</b> on this ${ctx === 'sales' ? 'document' : 'form'}: it shows ` +
            `<b>${q}</b> in stock${__vasyNoRow.negative === 'blocked' ? ', and <b>Allow negative stock</b> is off' : ''}. ` +
            `<b>Nothing was saved.</b>` +
            `<br><small>Receive stock first (e.g. <i>"create purchase order for &lt;supplier&gt; 10 ${itemName}"</i>, then the GRN)` +
            (__vasyNoRow.negative === 'blocked' ? `, or allow selling below zero: <i>"enable allow negative stock"</i>` : '') +
            `. A sales <b>order</b> doesn't need stock, if you only want to book the order.</small>`);
        return false;
    }
    if (res === 'norow') {
        const extra = pageQS('.swal2-container.swal2-shown, .modal.show');
        reply('error', null,
            `I picked <b>${itemName}</b>, but VasyERP didn't add the line to the grid. <b>Nothing was saved.</b>` +
            (extra ? `<br><small>A VasyERP popup is open on the page — it may be waiting for an answer: ` +
                     `“${(extra.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120).replace(/</g, '&lt;')}”</small>`
                   : `<br><small>Try <i>"${retryPhrase}"</i> once more; if it repeats, add the line by hand.</small>`));
        return false;
    }

    // A stall and a miss want the SAME diagnosis: ask the box what it is offering.
    // The usual answer is the variants of exactly the product the user named, and
    // the lookup only stalls because none of them match the parent name exactly.
    if (res === 'timeout' || res === 'error') {
        const near = await visibleItemSuggestions(itemName);
        if (near.length && near.some(x => vasyNorm(x).startsWith(vasyNorm(itemName)))) {
            reply('info', 'Which one?',
                `<b>${itemName}</b> is sold as ${near.length === 1 ? 'a variant' : 'variants'} here, so there is ` +
                `no plain "${itemName}" line to add. <b>Nothing was saved.</b>` +
                `<br><small>Pick one: ${near.map(x => `<b>${x}</b>`).join(' · ')}` +
                `<br>Say it with the variant — e.g. <i>"${retryPhrase.replace(itemName, near[0])}"</i>.</small>`);
            return false;
        }
        reply('error', null,
            `The product box on this screen stopped responding while I was looking up ` +
            `<b>${itemName}</b>. <b>Nothing was saved.</b>` +
            (near.length ? `<br><small>It is offering: ${near.map(x => `<b>${x}</b>`).join(' · ')}</small>`
                         : `<br><small>Reload the page and try <i>"${retryPhrase}"</i> again.</small>`));
        return false;
    }

    if (res === 'add_product') {
        // Never navigate to /product/new: it discards this half-built document, and
        // the Products page is a separate right many buyers and cashiers lack. Use
        // VasyERP's own quick-create box on this screen when the screen offers one.
        const q = await quickCreateProduct(itemName, {
            price: data.price, category: data.category, context: ctx });
        if (q === 'filled') {
            reply('info', 'Product missing — fill it in here',
                `<b>${itemName}</b> isn't in the catalogue, so I opened VasyERP's <b>quick-create</b> ` +
                `box right here — your document is still intact behind it.` +
                `<br><small>Check the details, press <b>Submit</b>, then say <i>"${retryPhrase}"</i> ` +
                `and I'll add the line.</small>`);
        } else if (q === 'no_permission') {
            reply('info', null,
                `<b>${itemName}</b> isn't in the catalogue, and this screen has no quick-create box — ` +
                `either your role can't create products, or VasyERP only offers it on purchase and POS ` +
                `screens. <b>Nothing was saved.</b>` +
                `<br><small>Ask someone with product rights to add it, then say <i>"${retryPhrase}"</i>.</small>`);
        } else {
            reply('info', null,
                `<b>${itemName}</b> isn't in the catalogue and the quick-create box wouldn't open here. ` +
                `<b>Nothing was saved.</b>`);
        }
        return false;
    }

    // Before denying the product exists, ask the box what it IS offering — the
    // usual answer is the variants of exactly the product the user asked for.
    const near = await visibleItemSuggestions(itemName);
    if (near.length) {
        const looksLikeVariants = near.some(x => vasyNorm(x).startsWith(vasyNorm(itemName)));
        reply('info', looksLikeVariants ? 'Which one?' : null,
            looksLikeVariants
                ? `<b>${itemName}</b> is sold as ${near.length === 1 ? 'a variant' : 'variants'} here, so there's ` +
                  `no plain "${itemName}" line to add. <b>Nothing was saved.</b>` +
                  `<br><small>Pick one: ${near.map(x => `<b>${x}</b>`).join(' · ')}` +
                  `<br>Say it with the variant — e.g. <i>"${retryPhrase.replace(itemName, near[0])}"</i>.</small>`
                : `I couldn't find <b>${itemName}</b>. <b>Nothing was saved.</b>` +
                  `<br><small>Closest matches on this screen: ${near.map(x => `<b>${x}</b>`).join(' · ')}</small>`);
        return false;
    }

    // plain not-found
    reply('error', null, ctx === 'sales'
        ? `I couldn't find <b>${itemName}</b> in this outlet's sellable list. <b>Nothing was saved.</b>` +
          `<br><small>Sales screens only offer stock available here, so a product with none in this ` +
          `outlet won't appear even though it exists. Check the stock, or the spelling, and retry.</small>`
        : `I couldn't find <b>${itemName}</b> in the catalogue. <b>Nothing was saved.</b>` +
          `<br><small>Check the spelling or give me its item code, then say <i>"${retryPhrase}"</i>.</small>`);
    return false;
}

// ── Quick-create a product WITHOUT leaving the document ──────────────────────
// Whoever is raising a purchase order often cannot open the Products page at
// all: creating products is a separate right, and plenty of buyers and counter
// staff do not have it. That is exactly why VasyERP puts a quick-create modal on
// the document screens (the F7 shortcut) and gates it with its own flag,
// NEWPRODUCTPERMISSION, rather than with menu access.
//
// The old behaviour navigated to /product/new when an item was missing, which
// threw away the half-built document AND lands on a page the user may not be
// allowed to open. This fills the inline modal instead, so the order survives.
// These come off the <html> dataset, published by the MAIN-world helper. Reading
// window.NEWPRODUCTPERMISSION from here always yields undefined — the isolated
// world has its own globals — so the check silently claimed "no permission" on
// every screen, including the ones that do offer quick-create.
function erpFlag(name) {
    const v = document.documentElement.dataset[name];
    return v === undefined ? null : v;
}
function erpFlagTrue(name) {
    const v = erpFlag(name);
    return v !== null && v !== '0' && v !== 'false' && v !== '';
}
function quickProductAvailable() {
    if (erpFlag('vasyQuickProduct') === '0') return false;
    if (erpFlag('vasyNewProductPerm') !== null && !erpFlagTrue('vasyNewProductPerm')) return false;
    // Fallback for the rare page where the helper hasn't run: in the MAIN world
    // the function is directly visible, and in the isolated world it never is.
    return erpFlag('vasyQuickProduct') === '1' || typeof window.setProductModal === 'function';
}
function quickProductModal() {
    const m = document.getElementById('product_model_for_direct');
    return m && m.getClientRects().length ? m : null;
}
// The modal's price boxes are the same derived chain as the full product form —
// selling is recomputed from MRP, and purchase price recomputes both — so the
// write order here has to match: purchase -> MRP -> selling.
async function quickProductPrices(cost, sell) {
    const write = async (id, val) => {
        const el = document.getElementById(id);
        if (!el || val == null || val === '') return;
        for (let i = 0; i < 3; i++) {
            setVal(el, String(val));
            await sleep(200);
            if (Math.abs(parseFloat(el.value || '0') - parseFloat(val)) < 0.01) return;
        }
    };
    if (cost != null) await write('posPurchasePrice', cost);
    if (sell != null) { await write('posMrp', sell); await write('posSellingPrice', sell); }
}
// context: 'purchase' -> the line rate is what we PAY; 'sales' -> what we CHARGE.
async function quickCreateProduct(name, opts = {}) {
    if (!quickProductAvailable()) return 'no_permission';
    // The opener lives in the page's world; ask the bridge to call it.
    try {
        if (typeof window.setProductModal === 'function') window.setProductModal(0, 1);
        else document.dispatchEvent(new CustomEvent('vasy:open-quick-product'));
    } catch (e) { return 'no_permission'; }
    await settle(2500);
    const modal = quickProductModal();
    if (!modal) return 'no_modal';

    const nameEl = document.getElementById('posName');
    if (!nameEl) return 'no_modal';
    setVal(nameEl, name);
    await sleep(300);

    const rate = opts.price != null && opts.price !== '' ? parseFloat(opts.price) : null;
    if (opts.context === 'sales') await quickProductPrices(rate != null ? rate : null, rate);
    else                          await quickProductPrices(rate, rate != null ? rate : null);

    if (opts.category) setSelect2Text('category_id', opts.category);
    if (opts.hsn)      setVal(document.getElementById('posHsnCode'), opts.hsn);
    await settle(1200);
    return 'filled';
}

// ── Do the document's lines actually carry a quantity? ──────────────────────
// Qty is starred on every document grid, and a line without one is rejected with
// "The Qty is required" — after the save, when the user has already been told we
// were saving. Check first and say which line is short.
function linesMissingQty() {
    const short = [];
    for (const code of pageQSA('input[id^="itemcode"],input[id^="itemCode"]')) {
        if (!code.value || !code.offsetParent) continue;
        const n = code.id.replace(/^itemcode|^itemCode/i, '');
        const q = document.getElementById('qty' + n) || document.getElementById('poqty' + n);
        if (!q) continue;
        const v = parseFloat(q.value || '0');
        if (!(v > 0)) short.push(code.value);
    }
    return short;
}

// ── Sales documents chain like purchases, but the parent is OPTIONAL ─────────
// Estimate -> Sales Order -> Delivery Challan -> Invoice. Unlike a GRN, though, a
// direct invoice is perfectly legitimate: a walk-in sale has no order behind it.
// So honour a parent the user names, and never invent one they did not.
const SALES_PARENT_TYPE = { order: '1', challan: '3' };
async function linkSalesParent(data) {
    const ref  = data.soNumber || data.orderNumber || data.challanNumber || data.parentDoc;
    if (!ref) return 'none';
    const kind = (data.challanNumber || /^dc|challan/i.test(String(ref))) ? 'challan' : 'order';
    const typeEl = document.getElementById('parentSalesType');
    const listEl = document.getElementById('salesList');
    if (!typeEl || !listEl) return 'unsupported';

    typeEl.value = SALES_PARENT_TYPE[kind];
    typeEl.dispatchEvent(new Event('change', { bubbles: true }));
    if (window.jQuery) { try { window.jQuery(typeEl).trigger('change'); } catch (e) {} }
    await waitForEl(() => (document.getElementById('salesList') || {}).options?.length > 1 ? true : null, 8000);
    await settle(1500);

    const opts = [...(document.getElementById('salesList') || { options: [] }).options].filter(o => o.value);
    if (!opts.length) return 'empty';
    const want = vasyNorm(ref);
    const best = opts.find(o => vasyNorm(o.text) === want)
              || opts.find(o => vasyNorm(o.text).includes(want))
              || (vasyBest(ref, opts, o => o.text, 0.55) || {}).item;
    if (!best) return 'notfound:' + opts.slice(0, 6).map(o => o.text.trim()).join(' · ');

    const live = document.getElementById('salesList');
    live.value = best.value;
    live.dispatchEvent(new Event('change', { bubbles: true }));
    if (window.jQuery) { try { window.jQuery(live).trigger('change'); } catch (e) {} }
    await settle(3000);
    return 'linked:' + best.text.trim();
}

let __vasyNoRow = null;   // why the last pick added no line (stock / negative-stock rule)
async function searchAndSelectItem(query, opts = {}) {
    __vasyNoRow = null;
    if (!query) return false;
    // Back-compat: old callers passed (query, timeoutMs, inputId).
    if (typeof opts === 'number') opts = { inputId: arguments[2] };

    const inputId = opts.inputId || 'searchItemBarcode';
    const ds = document.documentElement.dataset;

    // Learned alias — a phrasing that resolved before searches by its real name.
    // Never for a pinned pick ("<name> #<id>" from a "which one?" tap): learning
    // "<name> #43569626 → <name>" once stripped the pin from every later tap, so
    // the same question came back and the sale never happened.
    const pinned = /\s#\d{3,}$/.test(String(query));
    const aliased = pinned ? null : await getAlias(String(query));
    vtrace('item:' + String(query).slice(0, 24));
    try { ds.vasyAgentStep = 'search:' + String(aliased || query).slice(0, 60) + '@' + Date.now(); } catch (e) {}

    // Hand the request to the main-world bridge via shared dataset attributes.
    ds.vasyPaResult = '';
    ds.vasyPaQuery  = String(aliased || query);
    ds.vasyPaInput  = inputId;
    ds.vasyPaQty    = opts.qty      != null ? String(opts.qty)      : '';
    ds.vasyPaPrice  = opts.price    != null ? String(opts.price)    : '';
    ds.vasyPaDiscount = opts.discount != null ? String(opts.discount) : '';
    ds.vasyPaAddIfMissing = opts.addIfMissing ? '1' : '0';
    document.dispatchEvent(new CustomEvent('vasy:product-add'));

    // Poll for the bridge's result. 9s was too short: on a SALES screen the
    // Bloodhound remote starts cold, so the bridge has to poke the input like a
    // user, wait, and search again — measured at ~16s end to end. Timing out
    // early dropped us into the DOM fallback, which then ran its own budget on
    // top and pushed the whole attempt past the caller's ceiling.
    const end = Date.now() + 22000;
    while (Date.now() < end) {
        const r = ds.vasyPaResult || '';
        if (r) {
            if (r && !r.startsWith('found')) vtrace('item=' + r.slice(0, 12));
            if (r.startsWith('found')) {
                vtrace('item=found');
                if (!pinned) saveAlias(String(query), r.slice(6));   // learn "query → real name"
                return 'found';
            }
            if (r === 'add_product')         return 'add_product';
            if (r === 'notfound')            return false;
            // Picked, but the grid never showed the line — say so, never "found"
            if (r.startsWith('norow:')) {
                const [, qty, neg] = r.slice(6).split('|');
                __vasyNoRow = { qty: qty === '' ? null : parseFloat(qty), negative: neg || '' };
                return 'norow';
            }
            if (r.startsWith('ambiguousj:')) {
                let a = {}; try { a = JSON.parse(r.slice(11)); } catch (e) {}
                const opts = a.opts || [];
                askChoice('Which one?',
                    `There are <b>${a.count || opts.length}</b> different products named "<b>${a.name || query}</b>". <b>I've added nothing yet.</b>` +
                    `<br><small>Tap the right one — they differ in price and item code:</small>`,
                    query,
                    opts.map(o => ({ label: `${o.name} · ₹${o.price || o.mrp || '?'}${o.code ? ' · ' + (o.code.length > 14 ? o.code.slice(0, 12) + '…' : o.code) : ''}`,
                                     value: `${o.name} #${o.id}` })));
                __vasyAsked = true;
                return 'asked';
            }
            if (r.startsWith('ambiguous:')) {
                // Same name, different products — never guess which stock to move.
                const [, count, name] = r.split(':');
                reply('info', null,
                    `There are <b>${count}</b> different products named "<b>${name}</b>" in this catalogue.<br>` +
                    `<small>I've added nothing — pick the right one from the product box, or give me its item code.</small>`);
                // Callers vary in how they read this return value, so latch it: the
                // shared save gate below refuses to write a document that is missing
                // the line we just declined to guess.
                __vasyAsked = true;
                return 'asked';
            }
            if (r.startsWith('error'))       return await genericSearchAndSelect(query, opts, inputId);
        }
        await sleep(150);
    }
    // Bridge never answered (no main-world helper?) — try the generic DOM path.
    return await genericSearchAndSelect(query, opts, inputId);
}

// Generic fallback for inputs that are NOT a Bloodhound typeahead: type into the
// field, wait for any rendered suggestion, and click the best match. Used by pages
// whose product search isn't typeahead.js (the bridge reports error:notypeahead).
async function genericSearchAndSelect(query, opts = {}, inputId = 'searchItemBarcode') {
    const inp = document.getElementById(inputId)
             || pageQS(`[id*="${inputId}"]`)
             || pageQS('input.tt-input, input[placeholder*="barcode" i], input[placeholder*="product" i], input[placeholder*="item name" i]');
    if (!inp) return false;

    const nativeSet = (val) => {
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(inp), 'value')?.set;
        if (setter) setter.call(inp, val); else inp.value = val;
    };
    const typeChars = async (text) => {
        inp.focus();
        nativeSet('');
        inp.dispatchEvent(new Event('input', {bubbles:true}));
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            inp.dispatchEvent(new KeyboardEvent('keydown', {key: ch, bubbles:true, cancelable:true}));
            nativeSet(text.slice(0, i + 1));
            inp.dispatchEvent(new Event('input', {bubbles:true}));
            inp.dispatchEvent(new KeyboardEvent('keyup', {key: ch, bubbles:true, cancelable:true}));
            await sleep(35);
        }
    };

    // Search term variants: exact phrase → first two words → longest word →
    // 2nd longest → first word. Merges the fuzzy strategy proven in the bridge:
    // server ANDs each word as a prefix, so a joined/split word kills the query.
    const tokens = query.split(/\s+/).filter(w => w.length >= 2);
    const byLen  = tokens.slice().sort((a, b) => b.length - a.length);
    const termVariants = tokens.length > 1
        ? [query, tokens.slice(0, 2).join(' '), byLen[0], byLen[1], tokens[0]]
        : [query, query.slice(0, Math.max(3, Math.ceil(query.length * 0.6))), query.slice(0, 4)];

    const isAddProduct = o => /add\s*(new\s*)?product|create\s*product/i.test((o.innerText||'').trim());
    let opt = null, sawAdd = false;
    const tried = new Set();
    for (const c of termVariants) {
        if (!c || c.length < 2 || tried.has(c.toLowerCase())) continue;
        tried.add(c.toLowerCase());
        await typeChars(c);
        const sugg = await waitForSuggestions(4000);
        const real = sugg.filter(o => !isAddProduct(o));
        if (sugg.some(isAddProduct)) sawAdd = true;
        if (real.length) {
            // Fuzzy-rank suggestions against the FULL query (not the typed variant).
            const bestPick = vasyBest(query, real, o => (o.innerText || '').trim());
            if (bestPick && bestPick.score >= 0.9) { opt = bestPick.item; break; } // confident — stop
            if (bestPick && !opt) opt = bestPick.item;                             // keep best so far
        }
    }
    if (!opt) {
        if (sawAdd && opts.addIfMissing) {
            // Re-type full query so the Add-Product option reflects the right name, then click it.
            await typeChars(query);
            const sugg = await waitForSuggestions(3000);
            const addOpt = sugg.find(isAddProduct);
            if (addOpt) { addOpt.click(); await sleep(500); return 'add_product'; }
        }
        return false;
    }

    opt.scrollIntoView({block:'nearest'});
    opt.dispatchEvent(new MouseEvent('mousedown', {bubbles:true}));
    opt.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
    opt.click();

    // Wait for the line-item row, then set qty/price/discount via the fixed row finder.
    const rowEnd = Date.now() + 2500;
    while (Date.now() < rowEnd) {
        const r = getLastItemRow();
        if (r.qty || r.poqty) break;
        await sleep(150);
    }
    const row = getLastItemRow();
    if (opts.qty   != null && (row.poqty || row.qty)) setVal(row.poqty || row.qty, opts.qty);
    if (opts.price != null && row.price)              setVal(row.price, opts.price);
    if (opts.discount != null && row.discount)        setVal(row.discount, opts.discount);
    await sleep(200);
    return 'found';
}

// ── Last item row inputs ──────────────────────────────────────────────────────
// VasyERP line-item grids append an EMPTY trailing entry row after a product is
// added, so "last visible qty" is the wrong target. The just-added product is the
// row with the last FILLED itemcode — key off that when present.
// v9.12.0 note: Stock Transfer now keeps a FIXED "Total Quantity / Total Amount"
// row visible while the grid scrolls. A sticky totals row lives inside the same
// table, so anything that grabs "the last row" must skip it or it will type the
// item quantity into the totals cell.
const TOTALS_ROW_RE = /^\s*(total|grand\s*total|sub\s*total|totals)\b/i;
function isTotalsRow(el) {
    try {
        const row = el.closest ? el.closest('tr,[class*="row"]') : null;
        if (!row) return false;
        const cls = (row.className || '').toString();
        if (/total|sticky|fixed|footer|summary/i.test(cls)) return true;
        if (row.closest('tfoot')) return true;
        const first = (row.querySelector('td,th')?.innerText || '').trim();
        return TOTALS_ROW_RE.test(first);
    } catch (e) { return false; }
}
function getLastItemRow() {
    const real = e => e.id && !e.id.includes('{') && e.offsetParent && !isTotalsRow(e);
    const byId = id => { const el = document.getElementById(id); return el && el.offsetParent ? el : null; };

    const codes = [...pageQSA('input[id^="itemcode"]')]
        .filter(i => real(i) && i.value && i.value.trim());
    if (codes.length) {
        const n = codes[codes.length - 1].id.replace('itemcode', '');
        return {
            qty:      byId('qty' + n) || byId('poqty' + n) || null,
            poqty:    byId('poqty' + n) || null,
            price:    byId('price' + n) || null,
            discount: byId('discount' + n) || byId('Discount' + n) || byId('discountPer' + n) || null,
        };
    }

    // Fallback for grids without itemcode ids — last visible inputs.
    const qty      = [...pageQSA('input[id^="qty"]')].filter(real);
    const poqty    = [...pageQSA('input[id^="poqty"]')].filter(real);
    const price    = [...pageQSA('input[id^="price"]')].filter(real);
    const discount = [...pageQSA('input[id*="Discount"],input[id*="discount"]')].filter(real);
    return {
        qty:      qty[qty.length-1] || poqty[poqty.length-1] || null,
        poqty:    poqty[poqty.length-1] || null,
        price:    price[price.length-1] || null,
        discount: discount[discount.length-1] || null,
    };
}

// ── Smart save button ─────────────────────────────────────────────────────────
const SAVE_SKIP = ['new','draft','print','preview','cancel','close','another','invoice','discard','create new'];
// VasyERP's React screens label their commit button "Post stock-out" and
// "Post & create goods" — neither starts with save/submit/update/create, so the
// heuristic below would have walked straight past the only button that matters.
const SAVE_EXTRA = /^post\s+(?:stock-?out|&\s*create\s+goods|entry|voucher|production)\b/i;
function clickSaveBtn(context = document, opts = {}) {
    // A question is outstanding (e.g. two products share a name) — the document
    // would be saved missing that line. We already replied; just don't write.
    if (__vasyAsked && !opts.force) { __vasyAsked = false; return true; }
    if (!opts.force) {
        // Pre-flight: a mandatory attachment we cannot supply would fail server-side
        if (PURCHASE_TASKS.has(__vasyTask) && attachmentRequired()) {
            killWatcher();
            reply('info', 'Attachment Required',
                `The form is filled in, but this outlet has <b>"File attachment mandatory"</b> switched on (Purchase settings), so VasyERP will reject the save without an invoice/PO file.<br>` +
                `<small>I can't attach files for you — add the PDF/scan and press <b>Save</b>. (Or turn that setting off: <i>"disable file attachment mandatory"</i>.)</small>`);
            return true;
        }
        // Safety gate: risky tasks stop here and ask first (see RISKY_TASKS above).
        if (!__vasyConfirmed && RISKY_TASKS.has(__vasyTask)) {
            askSaveConfirmation(opts.note);
            return true;   // not a failure — the handler must not report an error
        }
    }
    const isDisabled = b => b.disabled || b.getAttribute('aria-disabled') === 'true' ||
                             /\bdisabled\b/.test(b.className || '');
    const onScreen = [...context.querySelectorAll('button,input[type="submit"]')].filter(b =>
        b.offsetParent && !isOurs(b) && !b.closest('nav,header,.navbar,#sidebar-menu,.m-header,.m-aside')
    );
    // If the only Save on the page is disabled, the form is not acceptable to the
    // ERP yet. Report the fields it is still waiting on rather than clicking a
    // dead control and waiting out the watcher.
    const saveCandidates = onScreen.filter(b => (/^(save|submit|update|create)\b/i.test((b.innerText || b.value || '').trim()) || SAVE_EXTRA.test((b.innerText || b.value || '').trim())));
    if (saveCandidates.length && saveCandidates.every(isDisabled)) {
        // VasyERP greys Save out while its own validation runs, and re-enables it
        // a second or two later. A click that lands in that window does nothing,
        // so wait for the button to come back before concluding anything — the
        // watcher this handler already armed is good for 45s.
        if (!opts._waited) {
            let waited = 0;
            const iv = setInterval(() => {
                waited += 200;
                const live = [...context.querySelectorAll('button,input[type="submit"]')]
                    .filter(b => b.offsetParent && !isDisabled(b) &&
                                 (/^(save|submit|update|create)\b/i.test((b.innerText || b.value || '').trim()) || SAVE_EXTRA.test((b.innerText || b.value || '').trim())) &&
                                 !b.closest('nav,header,.navbar,#sidebar-menu,.m-header,.m-aside'));
                if (live.length) { clearInterval(iv); live[0].click(); return; }
                if (waited >= 10000) { clearInterval(iv); clickSaveBtn(context, { ...opts, _waited: true }); }
            }, 200);
            return true;
        }
        killWatcher();
        const empty = [...context.querySelectorAll('input,select')]
            .filter(e => e.offsetParent && !e.value && (e.required || /\*/.test(labelNear(e) || '')))
            .map(e => (labelNear(e) || e.id || e.name || '').replace(/\*/g, '').trim())
            .filter(Boolean).slice(0, 5);
        reply('info', 'Save is disabled',
            `The form is filled in, but VasyERP still has <b>Save</b> greyed out, so it is not accepting this record yet.` +
            (empty.length ? `<br><small>Still waiting on: <b>${empty.join('</b>, <b>')}</b></small>` : '') +
            `<br><small>Nothing was written. Fill the missing field and press Save, or tell me the value.</small>`);
        return true;
    }
    // The Stock IN/OUT dialog (opening stock + adjustments) saves with "Add".
    // Only this known id — a generic "Add" would hit every "Add row" button.
    const inOutAdd = document.getElementById('save_openingstock');
    if (inOutAdd && inOutAdd.offsetParent && !isDisabled(inOutAdd)) { inOutAdd.click(); return true; }
    const visible = onScreen.filter(b => !isDisabled(b));
    const txt     = b => (b.innerText || b.value || '').trim().toLowerCase();
    const exact   = visible.find(b => txt(b) === 'save');
    if (exact)  { exact.click(); return true; }
    // The production pages save with "Post stock-out" / "Post & create goods".
    // SAVE_EXTRA was only consulted for the disabled check, so those buttons
    // could be recognised as Save but never clicked — the confirm then failed.
    const post = visible.find(b => SAVE_EXTRA.test((b.innerText || b.value || '').trim()));
    if (post) { post.click(); return true; }
    // Text-based match BEFORE type=submit. On the redesigned React pages the real
    // action button is often type="button" while dozens of in-form controls are
    // type="submit" — on /users/user-roles/new the first submit is "Select All
    // Module", so trusting type alone would grant permissions and never save.
    const saveish = visible.filter(b => {
        const t = txt(b);
        return /^(save|create|update|submit|confirm)\b/.test(t) && !SAVE_SKIP.some(x => t.includes(x));
    });
    if (saveish.length) { saveish[0].click(); return true; }
    // Only trust type=submit when it is unambiguous.
    const submits = visible.filter(b => b.type === 'submit' && !SAVE_SKIP.some(x => txt(b).includes(x)));
    if (submits.length === 1) { submits[0].click(); return true; }
    return false;
}

// ── Search list input ─────────────────────────────────────────────────────────
// Clicking a modal's Save is not "find the submit button". VasyERP's modals are
// FormValidation-backed, and FormValidation injects its own
// <button type="submit" class="fv-hidden-submit"> as the FIRST submit in the
// dialog. Selecting `button[type=submit]` therefore clicked an invisible no-op:
// the category modal filled in perfectly, saved nothing, and the watcher sat
// there until it timed out 45 seconds later. Go by visible label first, exactly
// as clickSaveBtn() does for full pages, and never click something with no box.
// Bootstrap modals live in the DOM even while closed, so finding one proves
// nothing. Wait until it is actually painted before touching its controls.
async function waitForModal(id, ms = 5000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
        const m = document.getElementById(id);
        if (m && m.getClientRects().length > 0 && /\bshow\b/.test(m.className || '')) return m;
        await sleep(80);
    }
    return document.getElementById(id);
}

function clickModalSave(modal) {
    if (!modal) return false;
    // getClientRects(), NOT offsetParent: a Bootstrap modal is position:fixed, and
    // offsetParent is null for fixed elements even while they are on screen.
    const visible = el => el && el.getClientRects().length > 0 &&
                          !/fv-hidden-submit/.test(el.className || '');
    const btns = [...modal.querySelectorAll('button,input[type=submit],a.btn')].filter(visible);
    const label = el => (el.innerText || el.value || '').trim();
    const byText = btns.find(b => /^(save|submit|create|add|update|ok|done)\b/i.test(label(b)));
    const target = byText
                || btns.find(b => /\bbtn-primary\b/.test(b.className || ''))
                || btns.find(b => (b.type || '').toLowerCase() === 'submit');
    if (!target) return false;
    target.click();
    return true;
}

// Recon 05/10/2026 (/contact, /product): the search is server-side, and for about
// a second after typing the table still shows the UNFILTERED rows. The old wait
// ("any row exists") returned at once, so edit/delete took rows[0] of the old
// list — whichever record happened to be on top, not the one named.
// The search box searchInTable last typed into — its own table is the one to read
// (pages also carry the nav menu, help panels and hidden tab tables as <table>s).
let _lastSearchBox = null;
function _resultTbody() {
    const visRows = tb => [...tb.querySelectorAll('tr')].filter(r => r.getClientRects().length).length;
    const shown = tb => tb.getClientRects().length && !isChromeEl(tb);
    for (let n = _lastSearchBox, i = 0; n && i < 10; i++, n = n.parentElement) {
        const tbs = [...n.querySelectorAll('table tbody')].filter(shown);
        if (tbs.length) return tbs.sort((a, b) => visRows(b) - visRows(a))[0];
    }
    return pageQSA('table tbody').find(shown) || pageQS('table tbody');
}
function _listRows() {
    return [...pageQSA('table tbody tr')].filter(r => r.offsetParent && r.cells?.length > 1 && !isChromeEl(r));
}
async function searchInTable(query) {
    if (!query) return false;
    // the visible box first — tabbed pages (/item-masters) keep one per tab in the DOM
    // …and never the ERP header's own boxes ("Jump to anywhere…", "Search shortcuts, downloads, sessions…")
    const onScreen = e => e && e.getClientRects().length && !e.closest('[class*="helpSidebar" i],[class*="supportSidebar" i],.m-header')
                       && !/shortcut|download|session|jump\s+to|run\s+a\s+command/i.test(e.placeholder || '');
    const SEARCH_SEL = 'input[placeholder*="Search" i]:not(#global_search_web):not([id="global_search"])';
    const box = [document.getElementById('datatableCustomSearchInput'), ...pageQSA('input.search-input'), ...pageQSA(SEARCH_SEL)].find(onScreen)
             || document.getElementById('datatableCustomSearchInput')
             || pageQS('input.search-input')
             || pageQS(SEARCH_SEL);
    _lastSearchBox = box || null;
    if (!box) return false;
    const sig = () => _listRows().map(r => r.innerText).join('|').slice(0, 3000);
    const before = sig();
    setVal(box, query);
    box.dispatchEvent(new Event('input', {bubbles:true}));
    box.dispatchEvent(new Event('keyup',  {bubbles:true}));
    const t0 = Date.now();
    while (Date.now() - t0 < 9000) {
        await sleep(200);
        const proc = pageQS('.dataTables_processing');
        const busy = !!(proc && proc.offsetParent && getComputedStyle(proc).display !== 'none');
        if (busy) continue;
        if (sig() !== before) break;
        const body = (pageQS('table tbody') || {}).innerText || '';
        if (Date.now() - t0 > 2500 && /no (matching )?(data|records?)|nothing found/i.test(body)) break;
    }
    // React tables (/item-masters) blank out while they re-filter, and that blank is
    // already "a change" — wait until the rows hold still (and, if empty, a little longer).
    let last = sig(), still = Date.now();
    const t1 = Date.now();
    while (Date.now() - t1 < 4000) {
        await sleep(200);
        const s = sig();
        if (s !== last) { last = s; still = Date.now(); continue; }
        if (Date.now() - still >= 700 && (s || Date.now() - t1 > 2500)) break;
    }
    await settle(500);
    return true;
}

// Which row IS the record? An exact name (or "name - company") cell wins; else
// the one row containing the query. Several → ask, never take the first.
function pickRecordRow(rows, q) {
    const k = vasyNorm(q);
    if (!rows.length) return { row: null, many: [] };
    if (!k) return rows.length === 1 ? { row: rows[0] } : { row: null, many: rows };
    const cells = r => [...r.cells].map(c => (c.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    const names = r => cells(r).flatMap(t => [t, ...t.split(/\s+-\s+/)]);
    const exact = rows.filter(r => names(r).some(t => vasyNorm(t) === k || vasyNorm(t) === '91' + k));
    if (exact.length === 1) return { row: exact[0] };
    if (exact.length > 1) return { row: null, many: exact };
    const contains = rows.filter(r => vasyNorm(r.innerText).includes(k));
    if (contains.length === 1) return { row: contains[0] };
    return { row: null, many: contains };
}
function _rowSummary(row) {
    return [...row.cells].map(c => (c.innerText || '').replace(/\s+/g, ' ').trim())
        .filter(t => t && !/^\d{1,3}$/.test(t) && !/^(active|inactive|un-?verified|verified)$/i.test(t)).slice(0, 3).join(' | ');
}
// Several records match: offer them, keyed by something that tells them apart
// (a mobile number, else an item code / the name cell).
function askWhichRecord(rows, q, verb) {
    const key = r => (r.innerText.match(/\b(\d{10})\b/) || [])[1] ||
                     ([...r.cells].map(c => (c.innerText || '').trim()).find(t => /^[A-Z]{2,}[\w\-\/]*\d/.test(t))) || _rowSummary(r).split(' | ')[0];
    askChoice(`Which one?`,
        `<b>${rows.length}</b> records match "<b>${q}</b>" — I won't ${verb} a guess. <b>Nothing was changed.</b>` +
        `<br><small>Tap the right one:</small>`,
        q, rows.slice(0, 6).map(r => ({ label: _rowSummary(r).slice(0, 70), value: key(r) })), 'searchQuery');
}
// The contact list shows one type at a time (Customer / Supplier / Transport radios).
async function _contactTab(type) {
    const id = /supplier|vendor/i.test(type || '') ? 'supplier' : /transport/i.test(type || '') ? 'transport' : 'customer';
    const r = document.getElementById(id);
    if (!r || r.checked) return;
    const sig = _listRows().map(x => x.innerText).join('|').slice(0, 1500);
    r.click();
    const t0 = Date.now();
    while (Date.now() - t0 < 6000 && _listRows().map(x => x.innerText).join('|').slice(0, 1500) === sig) await sleep(200);
    await settle(500);
}
// Find the record row for edit/delete. Contacts: the named type's tab, else both.
async function findRecordRow(entity, data, verb) {
    const q = String(data.searchQuery || data.firstName || data.name ||
              data.customerName || data.supplierName || data.productName || '').trim();
    if (!q) { reply('error', null, `Which record should I ${verb}? Give me its name (or mobile number).`); return null; }
    const isContactList = entity === 'Contact' || !!document.getElementById('supplier') && !!document.getElementById('customer');
    const tabs = isContactList ? (data.contactType ? [data.contactType] : ['customer', 'supplier']) : [null];
    for (const tab of tabs) {
        if (tab) await _contactTab(tab);
        await searchInTable(q);
        const pick = pickRecordRow(_listRows(), q);
        if (pick.row) return { row: pick.row, q };
        if (pick.many && pick.many.length) { askWhichRecord(pick.many, q, verb); return null; }
    }
    reply('error', null, `No record found matching "<b>${q}</b>"${isContactList && !data.contactType ? ' among customers or suppliers' : ''}. <b>Nothing was changed.</b>`);
    return null;
}

// ── Watch for save result ─────────────────────────────────────────────────────
// VasyERP's own refusals, said so the user knows what to do next. The ERP's
// words stay (quoted) — this only adds the next step.
const ERP_ERROR_HELP = [
    [/tax\s*rate\s+is\s+already\s+exist/i, 'VasyERP keeps one tax per rate, and this rate already has one — use the existing tax instead of creating another.'],
    [/(?:name|code)\s+(?:is\s+)?already\s+exist|already\s+exists?\b/i, 'Something with that name or number is already there — use a different name, or open the existing one.'],
    [/mobile\s*(?:no\.?|number)?\s+(?:is\s+)?already/i, 'That mobile number belongs to another contact — use a different number, or edit that contact instead.'],
    [/minimum\s+one\s+(?:bill|item|product)\s+is\s+required|please\s+select\s+(?:a\s+)?product/i, 'The document has no line on it — tell me the product and quantity.'],
    [/price\s+is\s+invalid/i, 'The line has no valid price — give me one, e.g. "… at 450".'],
    // V9.14.0 also validates stock on sales and stock transfers when negative selling is off
    [/(?:insufficient|not\s+enough)\s+(?:stock|qty|quantity)|stock\s+(?:is\s+)?not\s+available|out\s+of\s+stock|negative\s+(?:stock|selling|billing|qty|quantity)\s+(?:is\s+)?(?:not\s+allowed|disabled|restricted)|exceeds?\s+(?:the\s+)?available\s+(?:stock|qty|quantity)|available\s+(?:stock|qty|quantity)\s*(?:is|:)\s*-?\d/i,
     'There isn’t enough stock for that quantity, and VasyERP blocks sales and transfers that would take stock below zero while <b>Allow Negative Stock</b> is off. Lower the quantity, add stock first ("increase stock of Notebook1 by 10"), or — only if your business allows it — say "enable negative stock".'],
    [/financial\s+year/i, 'Switch to the current financial year (header FY selector), then try again.'],
    [/access\s+denied|not\s+authori[sz]ed|no\s+rights|permission/i, 'Your VasyERP role isn’t allowed to do this — an admin can grant it in User Roles.'],
];
function explainErpError(msg) {
    const plain = String(msg || '').replace(/<[^>]+>/g, ' ');
    const hit = ERP_ERROR_HELP.find(([re]) => re.test(plain));
    return hit && !/<small>/.test(String(msg)) ? `${msg}<br><small>${hit[1]}</small>` : msg;
}

function watchResult(successTitle, successUrlPatterns = [], hint = '') {
    killWatcher();
    let resolved = false;
    const startUrl = location.href;

    function done(status, title, msg) {
        if (resolved) return;
        resolved = true;
        if (w) { clearInterval(w.poll); w.observer.disconnect(); clearTimeout(w.timeout); }
        window.__vasyWatcher = null;
        if (status === 'error') msg = explainErpError(msg);
        const docRef = status === 'success' ? docRefFromTitle(document.title) : null;
        if (__vasyWarnNote) {
            msg = (msg || '') + `<br><small>⚠️ ${__vasyWarnNote}</small>`;
            __vasyWarnNote = '';
            try { chrome.storage.local.remove('vasyPendingNote'); } catch (e) {}
        }
        reply(status, docRef && title ? `${title} — ${docRef}` : title, msg,
              docRef ? { docRef, docUrl: location.href } : null);
    }

    function urlSuccessMsg() {
        return hint ? `Saved successfully.<br><small style="color:#888">${hint}</small>` : 'Saved successfully.';
    }

    // The Stock IN/OUT dialog (opening stock, adjustments) saves by closing
    // itself and refreshing the list behind it — no toast, no URL change — so
    // the watcher saw nothing although the entry had been posted.
    const inOut = document.getElementById('addProductModal');
    const inOutWasOpen = !!(inOut && inOut.getClientRects().length);
    // URL redirect check (works for most create forms) + active error scan
    const poll = setInterval(() => {
        if (inOutWasOpen && !inOut.getClientRects().length && !visibleErrorText()) {
            done('success', successTitle, urlSuccessMsg()); return;
        }
        const cur = location.href;
        if (cur !== startUrl) {
            if (successUrlPatterns.length) {
                if (successUrlPatterns.some(p => cur.includes(p))) { done('success', successTitle, urlSuccessMsg()); return; }
            } else if (/\/\d+([?#].*)?$/.test(new URL(cur).pathname)) {
                done('success', successTitle, urlSuccessMsg()); return;
            }
        }
        // VasyERP can answer Save with its OWN SweetAlert confirmation rather than
        // saving — e.g. a credit note against an unpaid invoice warns "Bill Payment
        // For Current Sales Is Still Pending… You Won't Be Able To Revert This!".
        // Nothing is written until it is answered, so the save looks like a no-op
        // and this watcher would just time out. Surface the ERP's own words and let
        // the user decide — never auto-accept an irreversible warning.
        const erp = erpConfirmDialog();
        // Some ERP questions only ask WHICH document the save will produce —
        // "Only taxable products are present… A Tax Invoice will be generated. Do
        // you want to continue?". The user asked for this invoice, so answer yes
        // once, say so in the result, and keep watching for the real outcome.
        if (erp && SAFE_ERP_CONFIRM.test(erp.text) && !erp.pop.dataset.vasyAnswered) {
            erp.pop.dataset.vasyAnswered = '1';
            erp.confirm.click();
            const said = erp.text.replace(/\s*do you want to continue\??/i, '').replace(/^confirm document generation\s*/i, '').trim();
            __vasyWarnNote = (__vasyWarnNote ? __vasyWarnNote + '<br>' : '') + `VasyERP noted: “${said.replace(/</g, '&lt;')}” — I confirmed.`;
            try { chrome.storage.local.set({ vasyPendingNote: __vasyWarnNote }); } catch (e) {}
            // a background tab never finishes the close animation (see acknowledgePartyWarning)
            setTimeout(() => { if (erp.pop.isConnected && erp.pop.offsetParent && erp.confirm.disabled) {
                erp.pop.closest('.swal2-container')?.remove();
                document.body.classList.remove('swal2-shown', 'swal2-height-auto'); } }, 1800);
            return;
        }
        if (erp && erp.pop.dataset.vasyAnswered) return;   // answered; wait for the save to land
        if (erp) {
            window.__vasyErpConfirm = erp;
            // "yes" must reach THIS question — the held save it came from was
            // already used up by the first "yes", so register it again.
            try { chrome.runtime.sendMessage({ action: 'pending_save', task: __vasyTask, url: location.href }); } catch (e) {}
            done('info', null,
                `VasyERP is asking before it saves:<br><b>${erp.text}</b><br>` +
                `<small>Nothing has been written yet. Reply <b>yes</b> to go ahead, or <b>cancel</b>.</small> (yes/cancel)`);
            return;
        }
        // Still on the form after the grace period → look for a toast, then for a
        // blocking validation error.
        if (scanVisibleToast()) return;
        scanVisibleError();
    }, 300);

    const SUCCESS = VASY_SUCCESS, ERRORS = VASY_ERRORS, IGNORE = VASY_IGNORE;
    const ignored = (text) => IGNORE.some(w => text.toLowerCase().includes(w));
    const ERR_SELECTORS = VASY_ERR_SELECTORS;
    let scanArmed = Date.now() + 1200; // grace period for async dup-checks to populate
    // Deliberately a tight selector and a short length cap: the notifications
    // panel is full of words like "order" and "added" and must never be mistaken
    // for a save confirmation.
    const TOAST_SEL = '.toast,.toast-message,#toast-container,.alert,.alert-success,' +
                      '.swal2-popup,[class*="snackbar" i],.m-alert';
    function scanVisibleToast() {
        if (Date.now() < scanArmed) return false;
        for (const el of pageQSA(TOAST_SEL)) {
            if (!el.getClientRects().length) continue;
            const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
            if (text.length < 3 || text.length > 200) continue;
            if (ignored(text)) continue;
            // A QUESTION is never a result. The word "generated" in "A Tax Invoice
            // will be generated. Do you want to continue?" was read as a successful
            // save while the invoice sat unsaved behind the dialog. A SweetAlert
            // with buttons is a question too, even mid-render before its text lands.
            if (isQuestionNode(el, text)) continue;
            const low = text.toLowerCase();
            if (ERRORS.some(w => new RegExp(w, 'i').test(text))) { done('error', null, text); return true; }
            if (SUCCESS.some(w => low.includes(w))) { done('success', successTitle, text); return true; }
        }
        return false;
    }
    function scanVisibleError() {
        if (Date.now() < scanArmed) return;
        const nodes = pageQSA(ERR_SELECTORS);
        for (const n of nodes) {
            if (!n.offsetParent) continue;
            const text = (n.innerText || n.textContent || '').replace(/\s+/g,' ').trim();
            if (text.length < 3 || text.length > 300) continue;
            if (ignored(text)) continue;
            if (ERRORS.some(w => new RegExp(w, 'i').test(text))) {
                done('error', null, text);
                return true;
            }
        }
        // Pass 2 — HIGH-SIGNAL phrases anywhere on the page (new React UI renders
        // validation text without the classic error classes)
        const bodyTxt = pageText();
        const hard = bodyTxt.match(/[^\n]{0,80}(already exist\w*|already registered|already in use)[^\n]{0,40}/i);
        if (hard) {
            done('error', null, hard[0].replace(/\s+/g, ' ').trim());
            return true;
        }
        return false;
    }

    // Toast / alert observer
    const observer = new MutationObserver(muts => {
        for (const mut of muts) {
            for (const node of mut.addedNodes) {
                if (node.nodeType !== 1) continue;
                if (isOurs(node) || isOurs(mut.target)) continue;   // our own chat line, not the ERP's
                const tag = (node.tagName||'').toLowerCase();
                if (['script','style','link','meta'].includes(tag)) continue;
                const text = (node.innerText || node.textContent || '').toLowerCase().trim();
                if (text.length < 2 || text.length > 600) continue;
                if (ignored(text)) continue;
                if (isQuestionNode(node, text)) continue;
                const isSuccess = SUCCESS.some(w => text.includes(w));
                const isError   = ERRORS.some(w => new RegExp(w).test(text));
                if (isSuccess && !isError) done('success', successTitle, (node.innerText||'').trim().slice(0,200) || 'Saved.');
                else if (isError)          done('error', null, (node.innerText||'').replace(/\s+/g,' ').trim().slice(0,300));
            }
        }
    });
    observer.observe(document.body, {childList:true, subtree:true});
    const timeout = setTimeout(() => {
        let why = '';
        try {
            const saves = [...pageQSA('button,input[type=submit]')]
                .filter(b => b.offsetParent && /^(save|submit|update)\b/i.test((b.innerText || b.value || '').trim()));
            const blocked = saves.length && saves.every(b =>
                b.disabled || /\bdisabled\b/.test(b.className || ''));
            const empty = [...pageQSA('input,select')]
                .filter(e => e.offsetParent && !e.value && (e.required || /\*/.test(labelNear(e) || '')))
                .map(e => (labelNear(e) || e.id || e.name || '').replace(/\*/g, '').trim())
                .filter(Boolean).slice(0, 4);
            if (blocked) why = 'VasyERP still has <b>Save</b> greyed out, so it is not accepting the record yet.';
            else if (location.href === startUrl) why = 'The form is still open and VasyERP gave no confirmation.';
            if (empty.length) why += `<br><small>Empty required field(s): <b>${empty.join('</b>, <b>')}</b></small>`;
        } catch (e) {}
        done('error', null,
            `No confirmation from VasyERP after 45s${why ? ' — ' + why : '.'}` +
            `<br><small>Most likely nothing was saved. Check the form before retrying so you don't create a duplicate.</small>`);
    }, 45000);
    const w = { poll, observer, timeout, kill: () => { clearInterval(poll); observer.disconnect(); clearTimeout(timeout); } };
    window.__vasyWatcher = w;
}

// ── React-Select filler ───────────────────────────────────────────────────────
// Locate a react-select's hidden text input by id, by its label, or by the visible
// text currently shown in the control (these pages pre-fill Country/State/City).
// The react-select's OUTER box (control's parent). With classNamePrefix="react-select"
// (V9.14.0 production pages) closest('-container') stops at react-select__input-container,
// an empty inner wrapper — its text never carries the placeholder or the label.
function rsOuter(inp) {
    const ctrl = inp && inp.closest('[class*="__control"],[class*="-control"]');
    return (ctrl && ctrl.parentElement) || (inp && inp.closest('[class*="-container"]')) || (inp && inp.parentElement);
}
function findReactSelectInput(idOrLabel) {
    const direct = typeof idOrLabel === 'string' && document.getElementById(idOrLabel);
    if (direct) return direct;

    const re  = idOrLabel instanceof RegExp ? idOrLabel
              : new RegExp(String(idOrLabel).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const all = [...pageQSA('input[id^="react-select-"][id$="-input"]')]
                    .filter(i => i.offsetParent || i.closest('[class*="-container"]'));

    for (const inp of all) {
        const box = rsOuter(inp);
        // The label usually sits just above the control, outside the container.
        let n = box, hops = 0;
        while (n && hops++ < 4) {
            n = n.parentElement; if (!n) break;
            const lb = n.querySelector('label');
            if (lb && re.test(lb.innerText || '')) return inp;
            const head = String(n.innerText || '').trim().split('\n')[0];
            if (head && head.length < 60 && re.test(head)) return inp;
        }
    }
    return null;
}

// react-select on the redesigned ERP pages is styled with EMOTION class hashes
// (css-b62m3t-container), so the classic `react-select__option` prefix is absent.
// Option element IDs (react-select-<n>-option-<i>) are the one stable hook.
// Returns true | false | 'asked' — 'asked' means we surfaced an ambiguity and
// must not be treated as a failure by the caller.
async function fillReactSelect(inputIdOrLabel, value, ms = 1800, what = '') {
    if (!value) return false;
    const inp = findReactSelectInput(inputIdOrLabel);
    if (!inp) return false;

    const idn  = (inp.id.match(/^react-select-(.+)-input$/) || [])[1];
    const box  = rsOuter(inp);
    const ctrl = inp.closest('[class*="__control"],[class*="-control"]') || (box && box.querySelector('[class*="-control"]'));
    // These controls open on mousedown; a plain click does not open the menu.
    if (ctrl) ctrl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    inp.focus();
    // Type WITHOUT setVal: setVal blurs at the end, and a react-select clears its
    // search text and closes the menu on blur — the search never ran, and the
    // journal voucher said "Rent didn't match any account ledger".
    const typeIn = v => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, v);
        inp.dispatchEvent(new Event('input', { bubbles: true }));
    };
    // A tapped answer reads "rent (Indirect Expenses)" — search by the name, then
    // pick the exact entry (the server's search knows nothing of the group).
    typeIn(String(value).replace(/\s*\([^)]*\)\s*$/, '') || String(value));

    const optSel = idn ? `[id^="react-select-${idn}-option-"]` : '[id^="react-select-"][id*="-option-"]';
    let shown = await waitForEl(optSel, ms);
    if (!shown) {
        // remote-backed lists (JV ledgers) sometimes miss the first keystroke while
        // the control is still mounting — type once more before giving up on search
        typeIn('');
        typeIn(String(value).replace(/\s*\([^)]*\)\s*$/, '') || String(value));
        shown = await waitForEl(optSel, Math.max(2500, ms / 2));
    }
    if (!shown) {
        // Not every react-select filters on typed text (Print Type, Generate From
        // and friends are plain pick-lists). ArrowDown opens those and shows the
        // whole list, which we can then match against.
        typeIn('');
        inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }));
        if (!await waitForEl(optSel, 2000)) return false;
    }
    await sleep(250);   // let the filter settle before reading the list

    // getClientRects, not offsetParent: the JV account menu now renders as a
    // position:fixed overlay, where every option's offsetParent is null — the
    // filter discarded all of them and "Rent" "didn't match any ledger".
    const opts = [...pageQSA(optSel)].filter(o => o.getClientRects().length);
    if (!opts.length) return false;
    const txt = o => String(o.innerText || '').trim();
    if (opts.length === 1 && /no option|no result/i.test(txt(opts[0]))) return false;

    // Exact (normalised) hits first. This ERP allows duplicate role names — an
    // account here has eight roles all called "cashier" with different rights —
    // so picking one silently would grant permissions nobody chose.
    const exact = opts.filter(o => vasyNorm(txt(o)) === vasyNorm(value));
    if (exact.length > 1) {
        reply('info', null,
            `There are <b>${exact.length}</b> entries named "<b>${value}</b>"${what ? ` for ${what}` : ''}, ` +
            `and they can carry different permissions.<br><small>Open the list and pick the right one, ` +
            `or give me the exact name of the one you want.</small>`);
        return 'asked';
    }
    if (exact.length === 1) { exact[0].click(); await sleep(200); return true; }

    const best = vasyBest(value, opts, txt, 0.45);
    if (!best) return false;
    const scored = opts.map(o => ({ o, sc: vasyFuzzy(value, txt(o)) })).sort((a, b) => b.sc - a.sc);
    const runner = scored.find(x => x.o !== best.item);
    if (runner && best.score - runner.sc < 0.08 && best.score < 0.97
        && vasyNorm(txt(runner.o)) !== vasyNorm(txt(best.item))) {
        // Ledgers read "rent (Indirect Expenses)": the one literally named what was
        // typed goes first, then every close match (an account here has six Rents).
        const bare = o => txt(o).replace(/\s*\([^)]*\)\s*$/, '');
        const close = scored.filter(x => best.score - x.sc < 0.15)
            .sort((a, b) => (vasyNorm(bare(b.o)) === vasyNorm(value)) - (vasyNorm(bare(a.o)) === vasyNorm(value)) || b.sc - a.sc)
            .slice(0, 6);
        askChoice('Which one?', `<b>${close.length}</b> close matches for "<b>${value}</b>"${what ? ` (${what})` : ''}. <b>Nothing is saved yet.</b>` +
            `<br><small>Tap the right one:</small>`, value,
            close.map(x => ({ label: txt(x.o), value: txt(x.o) })));
        return 'asked';
    }
    best.item.click();
    await sleep(200);
    return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

async function createContact(data) {
    const typeMap = {customer:'customers', supplier:'suppliers', transport:'transport'};
    const typeVal = typeMap[(data.contactType||'Customer').toLowerCase()] || 'customers';
    // The contact TYPE decides which lists the record appears in — a supplier
    // saved as a customer is invisible to every purchase order. This used to be
    // best-effort: no radio found → silently saved as the default (customer), and
    // any /contact/… landing counted as success. Wait for the radio, confirm it
    // stuck, and refuse to save otherwise.
    const typeLabel = typeVal === 'suppliers' ? 'Supplier' : typeVal === 'transport' ? 'Transport' : 'Customer';
    const typeRadio = await waitForEl(() =>
        pageQS(`input[name="typeOfContact"][value="${typeVal}"]`), 6000);
    if (!typeRadio) {
        reply('error', null,
            `The contact form isn't offering a <b>${typeLabel}</b> type right now, so I didn't save — ` +
            `it would have gone in as the wrong kind of contact. <b>Nothing was saved.</b>`);
        return;
    }
    if (!typeRadio.checked) { typeRadio.click(); await sleep(300); }
    if (!typeRadio.checked) {
        typeRadio.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await sleep(300);
    }
    if (!typeRadio.checked) {
        reply('error', null, `I couldn't switch the contact type to <b>${typeLabel}</b>, so I didn't save. <b>Nothing was saved.</b>`);
        return;
    }

    if (data.businessType) {
        const bRadio = pageQS(`input[name="contact_type"][value="${data.businessType.toLowerCase()}"]`);
        if (bRadio) { bRadio.click(); await sleep(150); }
    }

    // norm() already resolved firstName/lastName from any name alias
    const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ').trim();
    // Company Name is MANDATORY on the contact form — default it to the person's
    // full name when the user didn't give a company (e.g. an individual customer).
    const companyName = data.companyName || fullName;

    setVal(document.getElementById('firstName'),               data.firstName);
    setVal(document.getElementById('lastName'),                data.lastName);
    setVal(document.getElementById('companyName'),             companyName);
    setVal(document.getElementById('mobNo'),                   data.mobile);
    setVal(document.getElementById('whatsappNo'),              data.mobile);
    setVal(pageQS('input[name="email"]'),      data.email);
    // Mirror into the Address-Details contact-person block (also has mandatory
    // Contact Company Name*) so its validation passes too.
    setVal(document.getElementById('companyName0'),            companyName);
    if (!document.getElementById('firstName0')?.value) setVal(document.getElementById('firstName0'), data.firstName);
    if (data.gstin)     setVal(pageQS('input[name="gstin"],input[id*="gstin" i]'), data.gstin);
    if (data.remark)    setVal(pageQS('input[name="remark"]'),    data.remark);
    if (data.telephone) setVal(pageQS('input[name="telephone"]'), data.telephone);

    // only the page for the type that was asked for counts as success
    watchResult(`${typeLabel} Created`, [`/contact/${typeVal}/`]);
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on Contact form.');
}

async function createEmployee(data) {
    const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ');
    // Recon (expo): Name* | Mobile No.* | Country* | State* | City* are mandatory,
    // plus User Name* / Password* / Select Role* under Add Authentication Details.
    // Country/State/City come pre-defaulted (India / Gujarat / Ahmedabad).
    if (!setVal(document.getElementById('employeeName'), fullName))
        smartSet(fullName, { ph:/^name$/i, label:/^name/i });
    if (!setVal(pageQS('input[name="mobNo"]'), data.mobile))
        smartSet(data.mobile, { label:/mobile\s*no/i });
    if (data.email && !setVal(document.getElementById('employeeEmail'), data.email))
        smartSet(data.email, { label:/^email/i });
    await sleep(300);
    for (const [key, re] of [['country',/select\s*country/i], ['state',/select\s*state/i], ['city',/select\s*city/i]]) {
        if (!data[key]) continue;
        const sel = [...pageQSA('select')].find(s => s.offsetParent && re.test(labelNear(s)));
        if (sel) {
            if (!setSelect2Text(sel.id, data[key])) {
                const opt = vasyBest(data[key], [...sel.options], o => (o.text||'').trim(), 0.45);
                if (opt) { sel.value = opt.item.value; sel.dispatchEvent(new Event('change', {bubbles:true})); await sleep(400); }
            }
        } else {
            await fillReactSelect(re, data[key], 1800, key);   // redesigned page: react-select
        }
    }

    if (data.department) {
        const deptSel = pageQS('select[name*="department" i]');
        if (deptSel) setSelect2Text(deptSel.id, data.department);
        else await fillReactSelect(/department/i, data.department, 1800, 'department');
    }

    // Authentication details (User Name* / Password* / Select Role*) is COLLAPSED
    // on the redesigned page and opens from a "+" icon in the section header —
    // there is no longer an "Add Authentication Details" button. Role lives inside
    // it, so it does not exist in the DOM until this is expanded.
    const needAuth = data.role || data.username || data.password;
    if (needAuth && !document.getElementById('username')) {
        const head = [...pageQSA('.form-section-header')]
            .find(h => /authentication/i.test(h.innerText || ''));
        const opener = head && (head.querySelector('.form-section-icon-container')
                             || head.querySelector('button,[role=button],svg'));
        if (opener) { opener.click(); await sleep(900); }
        else {
            const authBtn = [...pageQSA('button')].find(b =>
                /add authentication|authentication detail/i.test(b.innerText || ''));
            if (authBtn) { authBtn.click(); await sleep(900); }
        }
    }

    if (needAuth) {
        const usernameEl = document.getElementById('username')
                        || pageQS('[name="username"],[id*="username" i]')
                        || [...pageQSA('input')].find(i => i.offsetParent && /user\s*name/i.test(labelNear(i)));
        const passwordEl = document.getElementById('password')
                        || pageQS('[name="password"],[id*="password" i]')
                        || [...pageQSA('input[type="password"]')].find(i => i.offsetParent);

        if (!usernameEl || !passwordEl) {
            reply('info', null,
                `I filled in ${fullName}'s details, but couldn't open the <b>Authentication details</b> section, ` +
                `so there's no login yet.<br><small>Expand it with the <b>+</b> next to "Authentication details", ` +
                `set the user name, password and role, then press <b>Create employee</b>.</small>`);
            return;
        }
        setVal(usernameEl, data.username || data.mobile || '');
        // A login without a password the user chose would be a credential we invented.
        if (data.password) setVal(passwordEl, data.password);
        await sleep(300);

        if (data.role) {
            const roleSel = [...pageQSA('select')].find(s => s.offsetParent && /select\s*role|^role/i.test(labelNear(s)));
            let ok;
            if (roleSel) {
                ok = setSelect2Text(roleSel.id, data.role);
                if (!ok) {
                    const opt = vasyBest(data.role, [...roleSel.options], o => (o.text||'').trim(), 0.4);
                    if (opt) { roleSel.value = opt.item.value; roleSel.dispatchEvent(new Event('change', {bubbles:true})); ok = true; }
                }
            } else {
                ok = await fillReactSelect(/select\s*role|^role/i, data.role, 2000, 'role');
            }
            if (ok === 'asked') return;                 // ambiguity already reported
            if (!ok) {
                reply('error', null,
                    `Role "<b>${data.role}</b>" didn't match any role on this account. ` +
                    `<small>Check the exact name under <b>Users › User Roles</b>.</small>`);
                return;
            }
            await sleep(300);
        }

        if (!data.password) {
            reply('info', null,
                `${fullName}'s details and role are filled in, but I've left <b>Password*</b> blank — ` +
                `I don't create login credentials.<br><small>Type a password and press <b>Create employee</b>.</small>`);
            return;
        }
    }

    // Set up result watcher BEFORE clicking save
    // Success: URL contains numeric ID like /employee/123, OR a success toast
    watchResult('Employee Created', []);

    // Click the MAIN FORM save — explicitly exclude any modal buttons
    const mainSave = [...pageQSA('button,input[type="submit"]')]
        .filter(b => b.offsetParent
                  && !b.closest('.modal,.modal-content,.modal-dialog')
                  && !b.closest('nav,header,.navbar,#sidebar-menu,.m-header,.m-aside'))
        .find(b => {
            const t = (b.innerText || b.value || '').trim().toLowerCase();
            return t === 'save' || t === 'create employee'   // redesigned page renames Save
                || (t.startsWith('save') && !['save and new','save & new','save another','save & add'].some(x => t.includes(x)));
        });

    if (mainSave) mainSave.click();
    else if (!clickSaveBtn()) reply('error', null, 'Save button not found on Employee form.');
}

async function createProduct(data) {
    const nameEl = document.getElementById('name')
                || pageQS('input[placeholder="Product Name"], input[placeholder*="Product Name" i]');
    setVal(nameEl, data.productName);
    await sleep(200);

    // Category* is compulsory — a product can't be saved without one, so a
    // missing category stops here (the old message claimed it had been "saved
    // without it" while nothing was saved at all).
    if (data.category) {
        const cSel = document.getElementById('category_id');
        const cOpts = cSel ? [...cSel.options].filter(o => o.value && (o.text || '').trim()) : [];
        const want = vasyNorm(data.category);
        // STRICT: exact, else a single clear prefix match. A loose match filed a
        // product asked for under "Plants" (a department here) into category "A".
        let cHit = cOpts.find(o => vasyNorm(o.text) === want);
        if (!cHit && want.length >= 3) {
            const pre = cOpts.filter(o => vasyNorm(o.text).startsWith(want));
            if (pre.length === 1) cHit = pre[0];
        }
        if (cHit && cSel) {
            cSel.value = cHit.value;
            cSel.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            const near = [...new Set(cOpts.map(o => ({ t: o.text.trim(), sc: vasyFuzzy(data.category, o.text) }))
                .filter(x => x.t.length >= 3 && x.sc >= 0.35).sort((a, b) => b.sc - a.sc).map(x => x.t))].slice(0, 5);
            askChoice('Which category?',
                `There's no category called "<b>${data.category}</b>". <b>Nothing was saved.</b>` +
                `<br><small>${near.length ? 'Tap one of the closest, or ' : ''}create it first: <i>"create category ${data.category} under &lt;department&gt;"</i>.</small>`,
                data.category, near.map(x => ({ label: x, value: x })));
            return;
        }
        await sleep(300);
    }
    if (data.brand) {
        if (!setSelect2Text('brand', data.brand)) {
            reply('info', null, `Brand "<b>${data.brand}</b>" not found — continuing without it.`);
        }
        await sleep(150);
    }

    // Unit* is compulsory and Save stays greyed out without it (measured: every
    // price filled correctly, Save disabled, "Unit* — Select Unit"). Match the
    // spoken unit exactly first — "kg" must not land on "KG-" — then by the
    // usual synonyms, and ask rather than guess when nothing fits.
    const uomSel = document.getElementById('uom');
    if (uomSel) {
        const opts = [...uomSel.options].filter(o => o.value && (o.text || '').trim());
        if (!data.unit) {
            reply('info', 'Which unit?',
                `<b>${data.productName || data.name}</b> needs a <b>Unit</b> — VasyERP won't save a product without one. <b>Nothing was saved.</b>` +
                `<br><small>Say it again with the unit, e.g. <i>"… unit PCS"</i>. This account has: ` +
                `${opts.map(o => o.text.trim()).filter(t => /^(pcs|nos|kg|g|box|pair|ltrs|ml|mtr|piece|dozen|strip|tablet|set)$/i.test(t)).slice(0, 10).join(', ') || opts.slice(0, 10).map(o => o.text.trim()).join(', ')}.</small>`);
            return;
        }
        const SYN = { pieces: 'pcs', piece: 'pcs', pc: 'pcs', pcs: 'pcs', nos: 'nos', no: 'nos', numbers: 'nos', number: 'nos',
                      kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg', grams: 'g', gram: 'g', gms: 'g', gm: 'g',
                      litre: 'ltrs', litres: 'ltrs', liter: 'ltrs', liters: 'ltrs', ltr: 'ltrs', l: 'ltrs', boxes: 'box', pairs: 'pair',
                      meter: 'mtr', meters: 'mtr', metre: 'mtr', metres: 'mtr', dozens: 'dozen', strips: 'strip', tablets: 'tablet', sets: 'set' };
        const want = vasyNorm(data.unit), canon = SYN[want] || want;
        const hit = opts.find(o => vasyNorm(o.text) === want) || opts.find(o => vasyNorm(o.text) === canon)
                 || opts.find(o => SYN[vasyNorm(o.text)] === canon) || opts.find(o => vasyNorm(o.text).startsWith(canon) && canon.length >= 2);
        if (!hit) {
            reply('info', 'Which unit?',
                `There's no unit called "<b>${data.unit}</b>" on this account. <b>Nothing was saved.</b>` +
                `<br><small>Pick one of: ${opts.slice(0, 14).map(o => o.text.trim()).join(', ')} — or create it first: <i>"create uom ${data.unit}"</i>.</small>`);
            return;
        }
        uomSel.value = hit.value;
        uomSel.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(400);
        if (uomSel.value !== hit.value) { uomSel.value = hit.value; uomSel.dispatchEvent(new Event('change', { bubbles: true })); await sleep(300); }
    }
    if (data.taxRate) setSelect2Text('sales_tax', String(data.taxRate));

    // Pricing — ORDER IS LOAD-BEARING. This grid is derived, not a set of
    // independent boxes: selling price is recomputed from MRP and margin on every
    // input event, and purchase price recomputes both of the others. Writing
    // selling price first (as this did) got it instantly rewritten back to 0.00,
    // so every product was saved priced at zero — or refused, because VasyERP
    // keeps Save greyed out until the grid is coherent.
    // Purchase price -> MRP -> selling price is the only order that survives.
    let priceApplied = true;
    const priceField = ids => ids.map(i => document.getElementById(i)).find(Boolean);
    const writePrice = async (val, ids, label) => {
        const el = priceField(ids);
        if (!el) return smartSet(val, { ids, label });
        // Re-assert once: the margin recalculation lands a tick later and can
        // leave the figure a few paise out (799 -> 799.03).
        for (let i = 0; i < 3; i++) {
            setVal(el, String(val));
            await sleep(220);
            if (Math.abs(parseFloat(el.value || '0') - parseFloat(val)) < 0.01) return true;
        }
        return Math.abs(parseFloat(el.value || '0') - parseFloat(val)) < 0.5;
    };
    if (data.purchasePrice)
        priceApplied = await writePrice(data.purchasePrice, ['purchasePrice-1','purchasePrice'], /^purchase\s*price/i) && priceApplied;
    // MRP must be non-zero before a selling price will stick. When the user gave
    // only one figure, it is the shelf price — seed MRP with it.
    const mrpVal = data.mrp || data.price;
    if (mrpVal)
        priceApplied = await writePrice(mrpVal, ['mrp-1','mrp'], /^mrp/i) && priceApplied;
    if (data.price)
        priceApplied = await writePrice(data.price, ['sellingPrice-1','sellingPrice'], /^selling\s*price/i) && priceApplied;

    // The row carries THREE more price tiers besides selling — retailer,
    // wholesaler and online — and VasyERP refuses the save when any of them sits
    // at or below landing cost, with "Wholesaler Price is smaller than Landing
    // Cost". They default to the purchase price, so a product priced purely by
    // its selling price fails a validation the user never saw: the button just
    // greys out. Lift any tier that is under the selling price up to it.
    const landing = parseFloat((document.getElementById('landingCost-1') || {}).value || '0') || 0;
    const sell    = parseFloat((document.getElementById('sellingPrice-1') || {}).value || '0') || 0;
    const target  = sell > landing ? sell : (landing * 1.1);
    if (target > 0) {
        for (const id of ['retailerPrice-1', 'wholesalerPrice-1', 'onlinePrice-1']) {
            const el = document.getElementById(id);
            if (!el) continue;
            const cur = parseFloat(el.value || '0') || 0;
            if (cur > landing) continue;             // already a sane margin — leave it
            setVal(el, target.toFixed(2));
            await sleep(180);
        }
    }
    if (data.hsn)           smartSet(data.hsn,     { ids: ['hsnCode'], ph: /hsn/i, label: /^hsn/i });
    if (data.barcode)       smartSet(data.barcode, { ids: ['itemCode-1'], ph: /barcode|item\s*code/i });
    if (data.description)   setVal(pageQS('textarea[name*="description" i]'), data.description);

    // ── Variants (Size/Color/…) — drives the "Add Variant" section ────────────
    if (Array.isArray(data.variants) && data.variants.length) {
        // For variant products the GRID is the pricing target — the main Pricing
        // section being absent must not trip the integrity guard.
        priceApplied = true;
        const nativeSet = (el, val) => {
            const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
            if (setter) setter.call(el, val); else el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        };
        // Tag-style inputs commit on Enter; some need keypress or change+blur too.
        // Verify the commit (input clears / a chip appears) and escalate if not.
        const commitValue = async (el, val) => {
            el.focus();
            nativeSet(el, val);
            await sleep(200);
            ['keydown', 'keypress', 'keyup'].forEach(ev =>
                el.dispatchEvent(new KeyboardEvent(ev, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true })));
            await sleep(350);
            if (el.value === val) {                       // Enter didn't take — escalate
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.blur();
                await sleep(350);
                if (el.value === val) { el.focus(); nativeSet(el, ''); return false; }
            }
            return true;
        };
        // Row-scoped lookups: the i-th variant uses the i-th Option-Name input and
        // the value input INSIDE THE SAME ROW — never the first one on the page.
        const nameInputs = () => [...pageQSA('input')].filter(x =>
            x.offsetParent && /size,?\s*colou?r|option\s*name/i.test(x.placeholder || ''));
        const rowValueInput = (nameInp) => {
            let el = nameInp.parentElement;
            for (let hops = 0; hops < 6 && el; hops++) {
                const cand = [...el.querySelectorAll('input')].find(x =>
                    x !== nameInp && x.offsetParent && /option\s*value/i.test(x.placeholder || ''));
                if (cand) return cand;
                el = el.parentElement;
            }
            return null;
        };

        const addVarBtn = [...pageQSA('button,a')].find(b => b.offsetParent && /add\s*variant/i.test(b.innerText || ''));
        if (addVarBtn) { addVarBtn.click(); await sleep(700); }

        let variantTrouble = false;
        for (let i = 0; i < data.variants.length; i++) {
            const v = data.variants[i];
            // Make sure row i exists — click "Add New" until it does
            let names = nameInputs();
            let guard = 0;
            while (names.length <= i && guard++ < 3) {
                const addNew = [...pageQSA('button')].find(b => b.offsetParent && /^add\s*new$/i.test((b.innerText || '').trim()));
                if (!addNew) break;
                addNew.click(); await sleep(600);
                names = nameInputs();
            }
            const nameInp = names[i];
            if (!nameInp) { variantTrouble = true; break; }
            nameInp.focus();
            nativeSet(nameInp, v.name);
            nameInp.dispatchEvent(new Event('change', { bubbles: true }));
            await sleep(300);
            const valInp = rowValueInput(nameInp);
            if (!valInp) { variantTrouble = true; break; }
            for (const val of v.values) {
                const ok = await commitValue(valInp, val);
                if (!ok) variantTrouble = true;
            }
        }
        if (variantTrouble) {
            reply('info', null, `I filled what I could, but some <b>variant values didn't stick</b> — please review the Variants section (each option needs its values as chips) and press <b>Save</b>.`);
            return;
        }
        await sleep(700);

        // Variant BULK pricing row — "each having mrp 500 selling 450 purchase 100".
        // The bulk row is the one holding the "Set Price" button; its input ORDER is
        // stable: [0]=Purchase Price, [1]=MRP, [2]=Selling Discount, [3]=Selling Price.
        // (Label-matching failed here — the grid's headers live in separate cells.)
        if (data.price || data.mrp || data.purchasePrice) {
            const setBtn = [...pageQSA('button')].find(b => b.offsetParent && /set\s*price/i.test(b.innerText || ''));
            let bulkOk = false;
            if (setBtn) {
                let row = setBtn.parentElement;
                for (let hops = 0; hops < 7 && row; hops++) {
                    if ([...row.querySelectorAll('input')].filter(i => i.offsetParent).length >= 4) break;
                    row = row.parentElement;
                }
                const inputs = row ? [...row.querySelectorAll('input')].filter(i => i.offsetParent && i.type !== 'checkbox') : [];
                if (inputs.length >= 4) {
                    // Order matters: MRP first (the page auto-derives other columns
                    // from it), then overwrite selling & purchase with exact values.
                    if (data.mrp)           setVal(inputs[1], data.mrp);
                    await sleep(250);
                    if (data.price)         setVal(inputs[3], data.price);
                    if (data.purchasePrice) setVal(inputs[0], data.purchasePrice);
                    await sleep(300);
                    // "Set Price" only applies the columns whose APPLY checkbox is
                    // ticked — tick them all in the bulk row before clicking.
                    const cbs = [...row.querySelectorAll('input[type="checkbox"]')].filter(c => c.offsetParent);
                    for (const cb of cbs) { if (!cb.checked) { cb.click(); await sleep(120); } }
                    setBtn.click();
                    await settle(1100);
                    // Verify: at least one variant-row input outside the bulk row
                    // must now carry a value we set — otherwise it silently no-oped.
                    const want = parseFloat(data.mrp || data.price || data.purchasePrice);
                    bulkOk = [...pageQSA('input')].some(i =>
                        i.offsetParent && !row.contains(i) && parseFloat(i.value) === want);
                }
            }
            if (!bulkOk) priceApplied = false;
        }
        await sleep(300);
    }

    // ── Data-integrity guard: NEVER silently drop what the user specified ─────
    if ((data.price || data.mrp || data.purchasePrice) && !priceApplied) {
        reply('info', null, `Name${Array.isArray(data.variants)&&data.variants.length?' and variants are':' is'} in, but I <b>couldn't place all the prices</b> (MRP/Selling/Purchase inputs weren't where I expected). Please enter them in the Pricing section and press <b>Save</b> — I didn't save a half-filled product.`);
        return;
    }

    // PO Qty* must be GREATER than Stock Limit* (VasyERP's own rule), and the
    // form pre-fills both with 0 — so a fresh product could never be saved: every
    // price right, Save greyed out. Use what the user said, else the smallest
    // valid order quantity, and say so.
    const slEl = document.getElementById('stockLimit'), pqEl = document.getElementById('poQuantity');
    const prodNotes = [];
    if (slEl && data.stockLimit != null && data.stockLimit !== '') setVal(slEl, data.stockLimit);
    if (pqEl) {
        const sl = parseFloat(slEl && slEl.value) || 0;
        let pq = parseFloat(data.poQty);
        if (!(pq > sl)) {
            if (isFinite(pq)) prodNotes.push(`PO Qty has to be more than the stock limit (${sl}), so I used ${sl + 1}`);
            else prodNotes.push(`PO Qty set to ${Math.max(1, sl + 1)} (say "po qty N" to change it)`);
            pq = Math.max(1, sl + 1);
        }
        setVal(pqEl, String(pq));
        await sleep(500);
    }
    const brandSel = document.getElementById('brand');
    if (!data.brand && brandSel && brandSel.selectedIndex > 0)
        prodNotes.push(`brand is VasyERP's default "${(brandSel.options[brandSel.selectedIndex].text || '').trim()}"`);
    watchResult('Product Created', ['/product/'], prodNotes.length ? `Note: ${prodNotes.join('; ')}.` : '');
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on Product form.');
}

async function createPurchaseOrder(data) {
    const supplier = data.supplierName;
    if (!supplier) { reply('error', null, 'Supplier name is required for a Purchase Order.'); return; }
    const _ps = await fillSelect2('contactVo', supplier);
    if (_ps === 'asked') return;
    if (!_ps) {
        await partyNotFound(supplier, 'supplier'); return;
    }
    await sleep(400);
    if (data.expectedDate) setVal(document.getElementById('purchaseDate'), data.expectedDate);
    if (data.notes)        setVal(pageQS('[name="shippingnotes"]'), data.notes);

    if ((data.itemName || data.items) &&
        !await addLines(data, 'purchase', it => `create purchase order for ${data.supplierName} ${it.qty || 1} ${it.name}`)) return;
    await applyReverseCharge(data);   // v9.12.0: RCM on sales + purchase
    const _short = linesMissingQty();
    if (_short.length) {
        reply('error', null,
            `<b>Qty</b> is compulsory on every line and ${_short.length === 1 ? 'one line has none' : _short.length + ' lines have none'} ` +
            `(${_short.slice(0, 3).join(', ')}). <b>Nothing was saved.</b>` +
            `<br><small>Tell me the quantity — e.g. <i>"… ${'$'}{_short[0]} qty 10"</i> — and I'll redo it.</small>`);
        return;
    }
    if (discountGate(data, 'purchase order')) return;
    watchResult('Purchase Order Created', ['/purchase/order/'], 'Note the PO number on this page — say "create GRN for [supplier] PO-XXX" to record goods receipt.');
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on Purchase Order form.');
}

// ── Which supplier is a purchase document for? ──────────────────────────────
// "receive goods against PO BIL214" names the document, not the supplier — but
// the GRN form only lists a supplier's POs once that supplier is picked. The PO
// and GRN lists are server-side DataTables that search by number, so ask them.
// Measured: the server wants Spring-style dot keys (search.value, columns[0].data
// — jQuery's usual search[value] gets HTTP 500) and at least one column (none →
// 400); branch and the other list filters are optional.
async function lookupPurchaseDoc(kind, number) {
    const url = { po: '/purchase/order/customdatatable', grn: '/purchase/materialinward/customdatatable' }[kind];
    if (!url || !number) return null;
    const { tok, hdr } = await _csrf();
    const want = vasyNorm(number), digits = String(number).replace(/\D/g, '');
    for (const range of ['currentYear', '']) {
        const p = new URLSearchParams({ draw: '1', 'order[0].column': '0', 'order[0].dir': 'asc', start: '0', length: '10',
            'search.value': number, 'search.regex': 'false', 'columns[0].data': 'purchaseId',
            'columns[0].searchable': 'true', 'columns[0].orderable': 'false', 'columns[0].search.value': '',
            status: 'All', daterange: range });
        let j = null;
        try {
            const res = await fetch(url, { method: 'POST', credentials: 'include', body: p.toString(),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                           'X-Requested-With': 'XMLHttpRequest', ...(tok ? { [hdr]: tok } : {}) } });
            if (res.ok) j = await res.json();
        } catch (e) { j = null; }
        const rows = (j && j.data) || [];
        const hit = rows.find(r => vasyNorm((r.prefix || '') + r.purchaseNo) === want)
                 || (digits && rows.find(r => String(r.purchaseNo) === digits));
        if (hit) return { supplier: (hit.companyName || '').trim(), status: String(hit.status || '').toLowerCase(),
                          number: (hit.prefix || '') + hit.purchaseNo, parent: hit.parentBillNo || null };
    }
    return null;
}

async function createMaterialInward(data) {
    if (!data.supplierName && data.poNumber) {
        const doc = await lookupPurchaseDoc('po', data.poNumber);
        if (!doc || !doc.supplier) {
            reply('error', null, `I couldn't find purchase order <b>${data.poNumber}</b>. <b>Nothing was saved.</b>` +
                `<br><small>Check the number on the Purchase Order list, or tell me the supplier too.</small>`);
            return;
        }
        if (/^(close|closed|delivered|completed)$/.test(doc.status)) {
            reply('info', null, `Purchase order <b>${doc.number}</b> from <b>${doc.supplier}</b> is already fully received ` +
                `(status: ${doc.status}), so there is nothing left to book a GRN for. <b>Nothing was saved.</b>`);
            return;
        }
        data.supplierName = doc.supplier;
    }
    if (!data.supplierName) { reply('error', null, 'Which supplier are the goods from?'); return; }
    const _ps2 = await fillSelect2('contactVo', data.supplierName);
    if (_ps2 === 'asked') return;
    if (!_ps2) { await partyNotFound(data.supplierName, 'supplier'); return; }
    await settle(1200);

    // THE PURCHASE ORDER IS COMPULSORY. A GRN is a receipt *against* a PO: it is
    // where the item lines, quantities and rates come from, and VasyERP rejects a
    // GRN without one. The previous version printed "select the PO manually" and
    // then pressed Save anyway — a save that could never succeed, followed by a
    // second, contradictory message from the watcher. Nothing is saved here until
    // a real PO is selected.
    const poEl = await waitForEl(() => {
        const el = document.getElementById('purchaseIdformaterialinward');
        return el && el.options.length > 1 ? el : null;
    }, 9000) || document.getElementById('purchaseIdformaterialinward');
    if (!poEl) { reply('error', null, 'The Purchase Order selector is missing from this GRN form.'); return; }

    const opts = [...poEl.options].filter(o => o.value);
    const list = n => opts.slice(0, n).map(o => o.text.trim()).join(' · ');
    if (!opts.length) {
        reply('info', null,
            `<b>${data.supplierName}</b> has no open purchase order to receive against, and a GRN must be booked against one.<br>` +
            `<small>Raise it first — <i>"create purchase order for ${data.supplierName} 10 &lt;product&gt;"</i> — then say ` +
            `<i>"receive goods from ${data.supplierName}"</i>. Nothing was saved.</small>`);
        return;
    }

    let chosen = null;
    if (data.poNumber) {
        const want = vasyNorm(data.poNumber);
        chosen = opts.find(o => vasyNorm(o.text) === want)
              || opts.find(o => vasyNorm(o.text).includes(want))
              || vasyBest(data.poNumber, opts, o => o.text, 0.55);
        if (!chosen) {
            reply('info', null,
                `No purchase order matching "<b>${data.poNumber}</b>" for ${data.supplierName}. Nothing was saved.<br>` +
                `<small>Open POs: ${list(6)}${opts.length > 6 ? ` … (${opts.length} total)` : ''}</small>`);
            return;
        }
    } else if (opts.length === 1) {
        chosen = opts[0];                       // only one open PO — no ambiguity
    } else {
        reply('info', null,
            `<b>${data.supplierName}</b> has ${opts.length} open purchase orders — which one are these goods against?<br>` +
            `<small>${list(8)}</small><br>` +
            `<small>Say <i>"receive goods from ${data.supplierName} ${opts[0].text.trim()}"</i>. Nothing was saved.</small>`);
        return;
    }

    // Select it, then let the PO's lines load into the grid.
    setSelect2Text('purchaseIdformaterialinward', chosen.text.trim());
    if (poEl.value !== chosen.value) {
        poEl.value = chosen.value;
        poEl.dispatchEvent(new Event('change', { bubbles: true }));
        if (window.jQuery) { try { window.jQuery(poEl).trigger('change'); } catch (e) {} }
    }
    await settle(3000);
    if (poEl.value !== chosen.value) {
        reply('error', null,
            `Couldn't attach purchase order <b>${chosen.text.trim()}</b> to the GRN, so nothing was saved.`);
        return;
    }

    // The PO should have populated the item grid. Saving an empty GRN is pointless.
    const lines = [...pageQSA('input[id^="itemcode"],input[id^="itemCode"]')]
        .filter(i => i.value && i.offsetParent);
    if (!lines.length) {
        reply('info', null,
            `Purchase order <b>${chosen.text.trim()}</b> is attached, but no item lines came through, so there is nothing to receive.<br>` +
            `<small>Nothing was saved — check the PO still has pending quantity.</small>`);
        return;
    }

    if (data.notes) setVal(pageQS('[name="shippingnotes"]'), data.notes);
    watchResult('Material Inward Created', ['/purchase/materialinward/'],
        `Received ${lines.length} line${lines.length === 1 ? '' : 's'} against ${chosen.text.trim()} — ` +
        `say "create supplier bill for ${data.supplierName}" to book the bill.`);
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on the Material Inward form.');
}

async function createSupplierBill(data) {
    if (!data.supplierName && data.miNumber) {
        const doc = await lookupPurchaseDoc('grn', data.miNumber);
        if (!doc || !doc.supplier) {
            reply('error', null, `I couldn't find material inward <b>${data.miNumber}</b>. <b>Nothing was saved.</b>` +
                `<br><small>Check the number on the Material Inward list, or tell me the supplier too.</small>`);
            return;
        }
        data.supplierName = doc.supplier;
        data._grnStatus = doc.status;
    }
    if (!data.supplierName) { reply('error', null, 'Which supplier sent the bill?'); return; }
    const _ps2 = await fillSelect2('contactVo', data.supplierName);
    if (_ps2 === 'asked') return;
    if (!_ps2) { await partyNotFound(data.supplierName, 'supplier'); return; }
    await settle(1200);

    // THE MATERIAL INWARD IS COMPULSORY, for the same reason the PO is compulsory
    // on a GRN: the bill's item lines come from the goods actually received. With
    // nothing linked the grid is empty and VasyERP answers "The Qty is required",
    // which is a confusing way to be told you skipped a step. The old code printed
    // "select the GRN manually" and then pressed Save regardless.
    const miEl = await waitForEl(() => {
        const el = document.getElementById('materialInwardIds');
        return el && el.options.length > 1 ? el : null;
    }, 9000) || document.getElementById('materialInwardIds');
    if (!miEl) { reply('error', null, 'The Material Inward selector is missing from this bill form.'); return; }

    const opts = [...miEl.options].filter(o => o.value);
    const list = n => opts.slice(0, n).map(o => o.text.trim()).join(' · ');
    if (!opts.length) {
        reply('info', null,
            `<b>${data.supplierName}</b> has no un-billed material inward to bill against.<br>` +
            `<small>Receive the goods first — <i>"receive goods from ${data.supplierName}"</i> — then book the bill. Nothing was saved.</small>`);
        return;
    }

    let chosen = null;
    if (data.miNumber) {
        const want = vasyNorm(data.miNumber);
        chosen = opts.find(o => vasyNorm(o.text) === want)
              || opts.find(o => vasyNorm(o.text).includes(want))
              || vasyBest(data.miNumber, opts, o => o.text, 0.55);
        if (!chosen) {
            reply('info', null,
                `No open material inward matching "<b>${data.miNumber}</b>" for ${data.supplierName}. Nothing was saved.<br>` +
                (data._grnStatus === 'completed' ? `<small>${data.miNumber} is marked <b>completed</b> — it has most likely been billed already.</small><br>` : '') +
                `<small>Available: ${list(6)}${opts.length > 6 ? ` … (${opts.length} total)` : ''}</small>`);
            return;
        }
    } else if (opts.length === 1) {
        chosen = opts[0];
    } else {
        reply('info', null,
            `<b>${data.supplierName}</b> has ${opts.length} un-billed receipts — which one is this bill for?<br>` +
            `<small>${list(8)}</small><br>` +
            `<small>Say <i>"create supplier bill for ${data.supplierName} ${opts[0].text.trim()}"</i>. Nothing was saved.</small>`);
        return;
    }

    setSelect2Text('materialInwardIds', chosen.text.trim());
    if (miEl.value !== chosen.value && !chosen.selected) {
        if (miEl.multiple) chosen.selected = true; else miEl.value = chosen.value;
        miEl.dispatchEvent(new Event('change', { bubbles: true }));
        if (window.jQuery) { try { window.jQuery(miEl).trigger('change'); } catch (e) {} }
    }
    await settle(3000);

    const lines = [...pageQSA('input[id^="itemcode"],input[id^="itemCode"]')]
        .filter(i => i.value && i.offsetParent);
    if (!lines.length) {
        reply('info', null,
            `Material inward <b>${chosen.text.trim()}</b> is linked, but no item lines came through, so there is nothing to bill.<br>` +
            `<small>Nothing was saved — open the GRN and check it still has un-billed quantity.</small>`);
        return;
    }

    if (data.billDate) setVal(document.getElementById('purchaseDate'), data.billDate);
    if (data.dueDate)  setVal(document.getElementById('dueDate'),      data.dueDate);
    if (data.notes)    setVal(pageQS('[name="shippingnotes"]'), data.notes);
    await applyReverseCharge(data);   // v9.12.0: RCM on sales + purchase
    watchResult('Supplier Bill Created', ['/purchase/bill/'],
        `Billed ${lines.length} line${lines.length === 1 ? '' : 's'} against ${chosen.text.trim()} — ` +
        `say "pay ${data.supplierName} <amount> cash" to settle it.`);
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on the Supplier Bill form.');
}

async function createSalesOrder(data) {
    const customer = data.customerName;
    if (!customer) { reply('error', null, 'Customer name is required for a Sales Order.'); return; }
    const _pc = await fillSelect2('contactVo', customer);
    if (_pc === 'asked') return;
    if (!_pc) {
        await partyNotFound(customer, 'customer'); return;
    }
    await sleep(400);
    if (data.deliveryDate) setVal(document.getElementById('dueDate'), data.deliveryDate);
    if (data.notes)        setVal(pageQS('textarea[name="note"]'), data.notes);

    // B2B vs retail decides the rate, so choose the tier before the line.
    const _tier = await setTradeTier(data.contactType || data.tradeType);
    if ((data.itemName || data.items) &&
        !await addLines(data, 'sales', it => `create sales order for ${data.customerName} ${it.qty || 1} ${it.name}`)) return;
    await applyReverseCharge(data);   // v9.12.0: RCM on sales + purchase
    const _short = linesMissingQty();
    if (_short.length) {
        reply('error', null,
            `<b>Qty</b> is compulsory on every line and ${_short.length === 1 ? 'one line has none' : _short.length + ' lines have none'} ` +
            `(${_short.slice(0, 3).join(', ')}). <b>Nothing was saved.</b>` +
            `<br><small>Tell me the quantity and I'll redo it.</small>`);
        return;
    }
    if (discountGate(data, 'sales order')) return;
    watchResult('Sales Order Created', ['/sales/order/'], 'Note the SO number on this page — say "create sales invoice for [customer] SO-XXX" to generate an invoice.');
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on Sales Order form.');
}

async function createSalesInvoice(data) {
    const customer = data.customerName;
    if (!customer) { reply('error', null, 'Customer name is required for a Sales Invoice.'); return; }
    const _pc = await fillSelect2('contactVo', customer);
    if (_pc === 'asked') return;
    if (!_pc) {
        await partyNotFound(customer, 'customer'); return;
    }
    await settle(1200);
    if (data.dueDate) setVal(document.getElementById('dueDate'), data.dueDate);

    // Estimate -> Order -> Challan -> Invoice. If the user named the order or the
    // challan this invoice is against, link it so the lines and rates come from
    // there instead of being re-typed (and re-priced) by hand.
    const _parent = await linkSalesParent(data);
    if (String(_parent).startsWith('notfound:')) {
        reply('info', null,
            `I couldn't find that sales order or challan for <b>${customer}</b>. <b>Nothing was saved.</b>` +
            `<br><small>Open ones: ${String(_parent).slice(9)}</small>`);
        return;
    }
    if (_parent === 'empty') {
        reply('info', null,
            `<b>${customer}</b> has no open sales order or delivery challan to invoice against. <b>Nothing was saved.</b>` +
            `<br><small>Raise the order first, or drop the reference to bill them directly.</small>`);
        return;
    }

    // B2B vs retail decides the rate, so choose the tier before the line.
    const _tier = await setTradeTier(data.contactType || data.tradeType);
    if ((data.itemName || data.items) &&
        !await addLines(data, 'sales', it => `create sales invoice for ${data.customerName} ${it.qty || 1} ${it.name}`)) return;
    await applyReverseCharge(data);   // v9.12.0: RCM on sales + purchase
    const _short = linesMissingQty();
    if (_short.length) {
        reply('error', null,
            `<b>Qty</b> is compulsory on every line and ${_short.length === 1 ? 'one line has none' : _short.length + ' lines have none'} ` +
            `(${_short.slice(0, 3).join(', ')}). <b>Nothing was saved.</b>` +
            `<br><small>Tell me the quantity — e.g. <i>"… ${'$'}{_short[0]} qty 10"</i> — and I'll redo it.</small>`);
        return;
    }
    if (discountGate(data, 'invoice')) return;
    watchResult('Invoice Created', ['/sales/invoice/'], 'Say "collect ₹amount from [customer] cash" to record payment receipt.');
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on Sales Invoice form.');
}

// Recon 05/10/2026 (/sales/creditnote/new): picking the Source Invoice loads only
// its settings; the LINES arrive when "Display All Items" (getCreditnoteData) is
// pressed — before that the grid is one blank "Search Product" row, so a credit
// note saved straight after the pick returned nothing. Each line has a
// productVarientIdN select (the name), qtyN and a [data-item-remove] cross.
// /purchase/debitnote/new is the same with productVariantIdN rows.
// Returns true (lines loaded and trimmed), false (replied — stop), or null (no
// such button on this page — the caller keeps its old path).
async function _loadReturnLines(data, what) {
    const btn = [...pageQSA('button,a')].find(b => b.offsetParent && /display\s*all\s*items/i.test(b.innerText || ''));
    if (!btn) return null;
    const live = () => [...pageQSA('#product_table tr[data-sales-item], #product_table tr[data-purchase-item], tr[data-sales-item]')]
        .filter(r => r.getClientRects().length && !r.classList.contains('m--hide') &&
                     (r.querySelector('input[id^="itemcode"]') || {}).value);
    const nameOf = r => {
        const sel = r.querySelector('select[id^="productVarientId"], select[id^="productVariantId"]');   // sales / purchase spelling
        const t = sel && sel.selectedOptions && sel.selectedOptions[0] ? sel.selectedOptions[0].text : '';
        return (t || (r.querySelector('input[id^="itemcode"]') || {}).value || '').trim();
    };
    btn.click();
    await waitForEl(() => live().length ? true : null, 9000);
    await settle(900);
    let rows = live();
    if (!rows.length) {
        reply('info', null, `That ${what} has no lines left to return — it may already be fully returned. <b>Nothing was saved.</b>`);
        return false;
    }
    if (data.itemName) {
        const keep = rows.filter(r => vasyFuzzy(data.itemName, nameOf(r)) >= 0.85);
        if (!keep.length) {
            reply('error', null,
                `Product "<b>${data.itemName}</b>" not found on that ${what} — it has ${rows.map(r => '<b>' + nameOf(r) + '</b>').join(', ')}. <b>Nothing was saved.</b>`);
            return false;
        }
        for (const r of rows.filter(r => !keep.includes(r))) {
            const x = r.querySelector('[data-item-remove]');
            if (x) { x.click(); await sleep(350); }
        }
        await settle(600);
        rows = live();
        if (rows.some(r => !keep.includes(r))) {
            reply('error', null, `I couldn't take the other lines off this return, so I stopped before saving. <b>Nothing was saved.</b>` +
                `<br><small>Remove every line except <b>${data.itemName}</b>, then press Save.</small>`);
            return false;
        }
    }
    if (data.qty && rows.length === 1) {
        // exactly qtyN — the row also carries qtyUomN / poqtyN, and the hidden qtyUomN comes first
        const q = [...rows[0].querySelectorAll('input')].find(i => /^qty\d+$/.test(i.id));
        if (q && String(q.value) !== String(data.qty)) { setVal(q, String(data.qty)); await sleep(300); }
    }
    return true;
}

// A return (credit / debit note) has to point at the document it reverses, and
// the ERP will not save one without it. When we weren't told which — or the one
// named isn't this party's — offer the party's own documents as answers and stop.
// Saving on regardless (the old behaviour) either failed on the server or, worse,
// produced a second reply after "please pick it manually".
function _sourceDocOptions(sel) {
    if (!sel) return [];
    return [...sel.options].filter(o => o.value && o.value !== '0' && o.value !== '-1' &&
        (o.text || '').trim() && !/^(select|choose|--|none)/i.test((o.text || '').trim()));
}
// Options read "INV/1352 - (300.0000)": the document number, then its amount.
function _docNo(o) { return String((o && o.text) || '').split(/\s+-\s+/)[0].replace(/\s+/g, ' ').trim(); }
function _docLabel(o) {
    const amt = (String(o.text || '').match(/\(\s*([\d,]+(?:\.\d+)?)\s*\)\s*$/) || [])[1];
    const v = amt ? parseFloat(amt.replace(/,/g, '')) : NaN;
    return _docNo(o) + (isFinite(v) ? ' · ₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '');
}
// Pick the source document the user named — exactly. A substring pick ("INV/13"
// → INV/1310) or a fuzzy one (BIL214 ≈ BIL241) returns the wrong goods; when the
// name doesn't single one out, the caller asks instead.
function pickSourceDoc(sel, ref) {
    const opts = _sourceDocOptions(sel);
    const k = vasyNorm(ref);
    if (!k) return false;
    let hit = opts.filter(o => vasyNorm(_docNo(o)) === k);
    if (!hit.length) hit = opts.filter(o => vasyNorm(o.text) === k);
    if (!hit.length) {
        // "1352" for "INV/1352" — the number alone, if exactly one document ends with it
        const tail = opts.filter(o => vasyNorm(_docNo(o)).endsWith(k) && /^\d{2,}$/.test(k));
        if (tail.length === 1) hit = tail;
    }
    if (hit.length !== 1) return false;
    const $ = window.jQuery;
    if ($) $(sel).val(hit[0].value).trigger('change');
    else { sel.value = hit[0].value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    return true;
}
function askSourceDoc(sel, docRef, what, field, party) {
    const opts = _sourceDocOptions(sel);
    if (!opts.length) {
        reply('info', null,
            `<b>${party}</b> has no ${what} I can return against` +
            (docRef ? ` — and "<b>${docRef}</b>" isn't one of theirs` : '') + `. <b>Nothing was saved.</b>` +
            `<br><small>Check the party name, or raise the ${what} first.</small>`);
        return;
    }
    // Document numbers grow, so the highest number is the most recent (the amount
    // after the number must not take part — every one ends ".0000").
    const seq = o => { const m = _docNo(o).match(/(\d+)\D*$/); return m ? Number(m[1]) : 0; };
    const recent = opts.slice().sort((a, b) => seq(b) - seq(a)).slice(0, 6);
    askChoice(`Which ${what}?`,
        (docRef ? `"<b>${docRef}</b>" isn't among <b>${party}</b>'s ${what}s.`
                : `A return has to point at the original ${what}.`) +
        ` <b>Nothing is saved yet.</b><br><small>Tap the right one` +
        (opts.length > recent.length ? ` — latest ${recent.length} of ${opts.length} shown, or type its number` : '') + `:</small>`,
        docRef || '', recent.map(o => ({ label: _docLabel(o), value: _docNo(o) })), field);
}

async function createSalesReturn(data) {
    // Credit Note = customer returns goods → sales return
    const customer = data.customerName;
    if (!customer) { reply('error', null, 'Customer name is required for a Credit Note.'); return; }
    const _pc = await fillSelect2('contactVo', customer);
    if (_pc === 'asked') return;
    if (!_pc) {
        await partyNotFound(customer, 'customer'); return;
    }
    await sleep(500);

    // Support both SO number and invoice number as the source document
    const docRef = data.soNumber || data.invoiceNumber || data.billNumber || data.referenceNo || '';
    // Wait for the source document dropdown to populate after customer is selected
    const srcEl = await waitForEl(() => {
        const el = document.getElementById('salesId')
                || pageQS('select[id*="salesId"],select[id*="invoiceId"],select[name*="sales"]');
        return el && el.options.length > 1 ? el : null;
    }, docRef ? 5000 : 7000) || document.getElementById('salesId');
    if (!docRef) { askSourceDoc(srcEl, '', 'invoice', 'invoiceNumber', customer); return; }
    if (!srcEl) {
        reply('info', null, `The Source Invoice list didn't load for <b>${customer}</b>, so I can't link the return. <b>Nothing was saved.</b>`);
        return;
    }
    if (!pickSourceDoc(srcEl, docRef)) { askSourceDoc(srcEl, docRef, 'invoice', 'invoiceNumber', customer); return; }
    await settle(1500); // wait for items to auto-populate from the source doc

    const _lines = await _loadReturnLines(data, 'invoice');
    if (_lines === false) return;

    // If items are specified, find and update them
    if (data.itemName && _lines === null) {
        // The user named WHAT comes back. If that line can't be put on the note,
        // saving would return something else (or the whole document) instead.
        const _ri = await searchAndSelectItem(data.itemName, { qty: data.qty, price: data.price });
        if (_ri === 'asked') return;
        if (_ri !== 'found') {
            reply('error', null, `Product "<b>${data.itemName}</b>" not found on this return, so I stopped before saving. <b>Nothing was saved.</b>`);
            return;
        }
    }

    if (data.date) {
        const dateEl = document.getElementById('creditNoteDate')
                    || document.getElementById('salesDate')
                    || pageQS('input[id*="date" i].custom-datepicker, input[placeholder*="dd/mm" i]');
        if (dateEl) setVal(dateEl, data.date);
    }
    if (data.reason || data.notes) setVal(pageQS('textarea[name="note"],textarea[name="description"],textarea'), data.reason || data.notes);

    await applyReverseCharge(data);   // v9.12.0: RCM on sales + purchase
    watchResult('Credit Note Created', ['/sales/creditnote/']);
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on Credit Note form.');
}

async function createStockAdjustment(data) {
    if (/\/product\/opening-stock/.test(location.pathname))
        return stockInOut(data, /decrease|reduce|remove|damage|scrap|write|\bout\b/i.test(data.adjustType || '') ? 'OUT' : 'IN');
    if (data.itemName) {
        await searchInTable(data.itemName);
        const adjustBtn = await waitForEl(() =>
            [...pageQSA('button,a')].find(b =>
                b.offsetParent && /adjust/i.test(b.innerText || b.title || '')
            ), 3000
        );
        if (adjustBtn) {
            adjustBtn.click();
            const modal = await waitForEl('.modal.show, .modal[style*="block"]', 2000);
            if (modal) {
                if (data.adjustType) {
                    const t = (data.adjustType||'').toLowerCase().includes('increase') ? 'Increase' : 'Decrease';
                    const radio = modal.querySelector(`input[value="${t}"],input[value="${t.toLowerCase()}"]`);
                    if (radio) radio.click();
                }
                const qtyInput = modal.querySelector('input[name*="qty"],input[id*="qty"],input[type="number"]');
                if (qtyInput && data.qty) setVal(qtyInput, data.qty);
                const remarkInput = modal.querySelector('textarea,input[name*="reason"],input[name*="remark"]');
                if (remarkInput && data.reason) setVal(remarkInput, data.reason);
                await sleep(300);
                const saveBtn = [...modal.querySelectorAll('button')].find(b =>
                    b.offsetParent && /save|confirm|submit|ok/i.test(b.innerText||'')
                );
                // This moves STOCK ON HAND. Reporting "Stock Adjusted" without a
                // save button, or without checking what the page said afterwards,
                // told the user their stock had changed when it had not.
                if (!saveBtn) {
                    reply('info', null,
                        `I filled the adjustment for <b>${data.itemName}</b> (${data.adjustType||'adjust'} ${data.qty||'?'}) ` +
                        `but couldn't find the <b>Save</b> button in the dialog — <b>nothing was changed</b>. ` +
                        `<small>Check the values and save it yourself.</small>`);
                    return;
                }
                watchResult('Stock Adjusted', [],
                    `${data.adjustType||'Adjusted'} <b>${data.qty||'?'}</b> units of <b>${data.itemName}</b>.`);
                saveBtn.click();
                return;
            }
        }
    }
    // No adjust control on this account (measured on v9.13.0: the Stocks grid,
    // the product page and the menu have none — the menu offers only "Stocks"
    // and "Stock Verification"). The old reply sent people to a button that
    // doesn't exist. Stock is corrected by a physical count instead, so work out
    // the count this adjustment implies and offer to prepare it.
    const onHand = await readOnHand(data.itemName);
    const q = parseFloat(data.qty);
    const down = /decrease|reduce|remove|damage|scrap|write/i.test(data.adjustType || '');
    let target = null;
    if (onHand != null && isFinite(q)) target = Math.max(0, down ? onHand - q : onHand + q);
    reply('info', 'Adjust through a stock count',
        `This VasyERP account has no direct Stock Adjustment screen — stock is corrected with a ` +
        `<b>Stock Verification</b> (count → approve), which posts the difference as an adjustment. <b>Nothing was changed.</b>` +
        (onHand != null ? `<br><b>${data.itemName}</b> shows <b>${onHand}</b> on hand` +
            (target != null ? `, so ${down ? 'removing' : 'adding'} ${q} means a count of <b>${target}</b>.` : '.') : '') +
        `<br><small>Say <i>"create stock verification for ${data.itemName}${target != null ? ' ' + target : ' &lt;counted qty&gt;'}"</i> ` +
        `and I'll prepare it — it stays pending until someone approves it.</small>`);
}

// On-hand quantity from the Stocks grid (/product/stock), or null.
async function readOnHand(itemName) {
    if (!itemName || !/\/product\/stock/.test(location.pathname)) return null;
    await settle(1500);
    const heads = [...pageQSA('table thead th')].map(t => (t.innerText || '').trim());
    const qi = heads.findIndex(h => /total\s+available\s+qty/i.test(h));
    if (qi < 0) return null;
    const want = vasyNorm(itemName);
    for (const r of pageQSA('table tbody tr')) {
        const cells = [...r.cells].map(c => (c.innerText || '').trim());
        const link = r.querySelector('a[href^="/product/"]');
        const names = [cells[1], cells[2], link && (link.innerText || link.title)].filter(Boolean).map(vasyNorm);
        if (names.some(x => x === want)) {
            const v = parseFloat(String(cells[qi] || '').replace(/,/g, ''));
            return isFinite(v) ? v : null;
        }
    }
    return null;
}

async function createCRMLead(data) {
    // This used to count every visible input and bail at <=2. The ERP then added
    // a global "Search shortcuts…" box to the support widget on EVERY page, so
    // the count became 3 and the honest answer stopped firing — the agent went on
    // to fill a form that does not exist and died on "Save button not found".
    if (pageFormFields().length < 2) {
        reply('info', null,
            `CRM in VasyERP has no leads module — <b>${document.title || 'this page'}</b> only lists customer ` +
            `feedback left against invoices.<br><small>CRM here means Coupons, Memberships, Discounts, Loyalty ` +
            `and Feedback. To track a prospect, make them a contact: ` +
            `"<b>create customer ${data.name||'Name'}${data.mobile?`, mobile ${data.mobile}`:''}</b>".</small>`
        );
        return;
    }
    const nameEl = pageQS('input[name*="name" i]:not(#global_search_web),input[id*="name" i]:not(#global_search_web)');
    setVal(nameEl, data.name);
    setVal(pageQS('input[name*="mobile" i],input[name*="phone" i]'), data.mobile);
    setVal(pageQS('input[name*="email" i]'), data.email);
    if (data.notes) setVal(pageQS('textarea,input[name*="note" i]'), data.notes);
    watchResult('CRM Lead Created', []);
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on CRM form.');
}

async function createPayment(data) {
    // Payment = outward money to supplier/vendor
    const mode = (data.paymentMode || 'Cash').toLowerCase();
    const isBankMode = mode.includes('bank') || mode.includes('upi') || mode.includes('online')
                    || mode.includes('cheque') || mode.includes('neft') || mode.includes('rtgs') || mode.includes('imps');
    const radioId = isBankMode ? 'paymentModeBank' : 'paymentModeCash';
    const radio   = document.getElementById(radioId)
                 || pageQS(`input[type="radio"][value*="${isBankMode ? 'bank' : 'cash'}" i]`);
    if (radio) { radio.click(); await sleep(400); }

    // "Select Cash Type" is mandatory and is NOT defaulted. Leaving it empty made
    // Save do nothing at all — no validation text, no toast, no navigation — so
    // the payment looked recorded when the form had never been accepted.
    if (!isBankMode) {
        const cashSel = document.getElementById('cashdropdown');
        if (cashSel) {
            const cashOpts = [...cashSel.options].filter(o => o.value);
            let pick = null;
            if (data.cashAccount) {
                const b = vasyBest(data.cashAccount, cashOpts, o => o.text, 0.45);
                pick = b && (b.item || b);
            }
            // Default to plain cash-in-hand rather than whatever happens to be first.
            if (!pick) pick = cashOpts.find(o => /^cash\s*\(/i.test((o.text || '').trim())) || cashOpts[0];
            if (pick) {
                cashSel.value = pick.value;
                cashSel.dispatchEvent(new Event('change', { bubbles: true }));
                if (window.jQuery) { try { window.jQuery(cashSel).trigger('change'); } catch (e) {} }
                await sleep(400);
            }
        }
    }
    if (isBankMode && data.bank) {
        setSelect2Text('bankVo', data.bank) || await fillSelect2('bankVo', data.bank);
    }

    if (data.partyName || data.supplierName || data.vendorName) {
        // Money without its party lands on the wrong ledger — stop, don't post it unlinked.
        const _party = data.partyName || data.supplierName || data.vendorName;
        const _pf = await fillSelect2('accountCustomId', _party);
        if (_pf === 'asked') return;
        if (!_pf) { await partyNotFound(_party, 'supplier'); return; }
    }

    // VasyERP defaults the allocation radio to "Against Bill", and then refuses to
    // save with "Minimum One Bill Is required". A payment the user described only
    // by party and amount is an on-account payment, so say so explicitly.
    // (payBill() takes the against-bill route, because there the bill IS the point.)
    if (!data.billNumber && !data.invoiceNumber && !data.againstBill) {
        const onAcc = document.getElementById('onAccount');
        if (onAcc && !onAcc.checked) { onAcc.click(); await sleep(600); }
    }

    const amtEl = document.getElementById('totalPayment')
               || pageQS('input[name="totalPayment"],input[id*="amount" i]:not([id*="tds" i])');
    if (amtEl && data.amount != null && data.amount !== '') {
        for (let i = 0; i < 4; i++) {
            setVal(amtEl, String(data.amount));
            await sleep(220);
            if (parseFloat(amtEl.value || '0') === parseFloat(data.amount)) break;
        }
    }

    const dateEl = document.getElementById('paymentDate') || pageQS('input[id*="date" i]');
    if (dateEl && (data.paymentDate || data.date)) setVal(dateEl, data.paymentDate || data.date);

    if (data.reference || data.chequeNo || data.transactionId) {
        const refEl = document.getElementById('accountNo')
                   || pageQS('input[name*="reference" i],input[name*="cheque" i],input[id*="accountNo"]');
        if (refEl) setVal(refEl, data.reference || data.chequeNo || data.transactionId);
    }

    // TDS handling
    if (data.applyTds) {
        const tdsCheck = pageQS('input[name*="tds" i][type="checkbox"]');
        if (tdsCheck && !tdsCheck.checked) { tdsCheck.click(); await sleep(300); }
        if (data.tdsAmount) {
            const tdsEl = pageQS('input[id*="tds" i][type="number"],input[name*="tds" i]');
            if (tdsEl) setVal(tdsEl, data.tdsAmount);
        }
    }

    if (data.notes || data.description) setVal(pageQS('textarea'), data.notes || data.description);
    watchResult('Payment Recorded', ['/payment/']);
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on Payment form.');
}

async function createReceipt(data) {
    // Receipt = inward money from customer
    const mode = (data.paymentMode || 'Cash').toLowerCase();
    const isBankMode = mode.includes('bank') || mode.includes('upi') || mode.includes('online')
                    || mode.includes('cheque') || mode.includes('neft') || mode.includes('rtgs') || mode.includes('imps');
    const radio = document.getElementById(isBankMode ? 'receiptModeBank' : 'receiptModeCash')
               || pageQS(`input[type="radio"][value*="${isBankMode ? 'bank' : 'cash'}" i]`);
    if (radio) { radio.click(); await sleep(400); }

    // "Select Cash Type" is mandatory and is NOT defaulted. Leaving it empty made
    // Save do nothing at all — no validation text, no toast, no navigation — so
    // the payment looked recorded when the form had never been accepted.
    if (!isBankMode) {
        const cashSel = document.getElementById('cashdropdown');
        if (cashSel) {
            const cashOpts = [...cashSel.options].filter(o => o.value);
            let pick = null;
            if (data.cashAccount) {
                const b = vasyBest(data.cashAccount, cashOpts, o => o.text, 0.45);
                pick = b && (b.item || b);
            }
            // Default to plain cash-in-hand rather than whatever happens to be first.
            if (!pick) pick = cashOpts.find(o => /^cash\s*\(/i.test((o.text || '').trim())) || cashOpts[0];
            if (pick) {
                cashSel.value = pick.value;
                cashSel.dispatchEvent(new Event('change', { bubbles: true }));
                if (window.jQuery) { try { window.jQuery(cashSel).trigger('change'); } catch (e) {} }
                await sleep(400);
            }
        }
    }
    if (isBankMode && data.bank) {
        setSelect2Text('bankVo', data.bank) || await fillSelect2('bankVo', data.bank);
    }

    if (data.partyName || data.customerName || data.clientName) {
        // Money without its party lands on the wrong ledger — stop, don't post it unlinked.
        const _party = data.partyName || data.customerName || data.clientName;
        const _pf = await fillSelect2('accountCustomId', _party);
        if (_pf === 'asked') return;
        if (!_pf) { await partyNotFound(_party, 'customer'); return; }
    }

    // VasyERP defaults the allocation radio to "Against Bill", and then refuses to
    // save with "Minimum One Bill Is required". A payment the user described only
    // by party and amount is an on-account payment, so say so explicitly.
    // (payBill() takes the against-bill route, because there the bill IS the point.)
    if (!data.billNumber && !data.invoiceNumber && !data.againstBill) {
        const onAcc = document.getElementById('onAccount');
        if (onAcc && !onAcc.checked) { onAcc.click(); await sleep(600); }
    }

    const amtEl = document.getElementById('totalPayment')
               || pageQS('input[name="totalPayment"],input[id*="amount" i]:not([id*="tds" i])');
    if (amtEl && data.amount != null && data.amount !== '') {
        for (let i = 0; i < 4; i++) {
            setVal(amtEl, String(data.amount));
            await sleep(220);
            if (parseFloat(amtEl.value || '0') === parseFloat(data.amount)) break;
        }
    }

    const dateEl = document.getElementById('receiptDate') || pageQS('input[id*="date" i]');
    if (dateEl && (data.receiptDate || data.paymentDate || data.date))
        setVal(dateEl, data.receiptDate || data.paymentDate || data.date);

    if (data.reference || data.chequeNo || data.transactionId || data.utrNo) {
        const refEl = document.getElementById('accountNo')
                   || pageQS('input[name*="reference" i],input[name*="cheque" i],input[id*="accountNo"]');
        if (refEl) setVal(refEl, data.reference || data.chequeNo || data.transactionId || data.utrNo);
    }

    // TDS handling
    if (data.applyTds) {
        const tdsCheck = pageQS('input[name*="tds" i][type="checkbox"]');
        if (tdsCheck && !tdsCheck.checked) { tdsCheck.click(); await sleep(300); }
        if (data.tdsAmount) {
            const tdsEl = pageQS('input[id*="tds" i][type="number"],input[name*="tds" i]');
            if (tdsEl) setVal(tdsEl, data.tdsAmount);
        }
    }

    // Link to outstanding invoice if specified
    if (data.invoiceNumber || data.soNumber) {
        const invEl = pageQS('select[id*="invoice"],select[id*="outstanding"]');
        if (invEl) {
            setSelect2Text(invEl.id, data.invoiceNumber || data.soNumber)
            || await fillSelect2(invEl.id, data.invoiceNumber || data.soNumber);
        }
    }

    if (data.notes || data.description) {
        const noteEl = pageQS('textarea[name="description"],textarea');
        if (noteEl) setVal(noteEl, data.notes || data.description);
    }

    watchResult('Receipt Recorded', ['/receipt/']);
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on Receipt form.');
}

async function createPurchaseReturn(data) {
    // Debit Note = we return goods to supplier → purchase return
    const supplier = data.supplierName;
    if (!supplier) { reply('error', null, 'Supplier name is required for a Debit Note.'); return; }
    const _ps = await fillSelect2('contactVo', supplier);
    if (_ps === 'asked') return;
    if (!_ps) {
        await partyNotFound(supplier, 'supplier'); return;
    }
    await sleep(500);

    // Recon (expo): Select Supplier* | Debit Note Date* | Debit Note No. | Reference
    // Bill No.* | Payment Term | Due Date* | Shipping Date* | Reverse Charge |
    // Select Purchase* | Reason | Select Account Ledger* (defaults "Purchase Return")
    if (data.date) {
        const dateEl = document.getElementById('purchaseDate')
                    || pageQS('input[id*="date" i]:not([id*="due" i])');
        if (!setVal(dateEl, data.date)) smartSet(data.date, { label:/debit\s*note\s*date/i });
    }

    // Link to original bill/supplier invoice
    const docRef = data.billNumber || data.invoiceNumber || data.poNumber || data.referenceNo || '';
    // "Reference Bill No.*" is mandatory and defaults to the DN number — set it to
    // the real bill reference when we know it, otherwise leave the ERP default.
    // "Select Purchase*" is the source-bill picker that pulls the item rows in
    const billEl = await waitForEl(() => {
        const el = document.getElementById('purchaseIdfordebitnote')
                || pageQS('select[id*="debitnote"],select[id*="purchaseId"],select[name*="purchase"]')
                || [...pageQSA('select')].find(s => s.offsetParent && /select\s*purchase/i.test(labelNear(s)));
        return el && el.options.length > 1 ? el : null;
    }, docRef ? 6000 : 8000) || document.getElementById('purchaseIdfordebitnote');
    if (!docRef) { askSourceDoc(billEl, '', 'bill', 'billNumber', supplier); return; }
    if (!billEl) {
        reply('info', null, `The Select Purchase list didn't load for <b>${supplier}</b>, so I can't link the return. <b>Nothing was saved.</b>`);
        return;
    }
    if (!pickSourceDoc(billEl, docRef)) { askSourceDoc(billEl, docRef, 'bill', 'billNumber', supplier); return; }
    smartSet(docRef, { label:/reference\s*bill\s*no/i });
    await settle(1800); // let items auto-populate from source bill
    const _lines = await _loadReturnLines(data, 'bill');
    if (_lines === false) return;

    // If a specific item is being returned
    if (data.itemName && _lines === null) {
        // The user named WHAT comes back. If that line can't be put on the note,
        // saving would return something else (or the whole document) instead.
        const _ri = await searchAndSelectItem(data.itemName, { qty: data.qty, price: data.price });
        if (_ri === 'asked') return;
        if (_ri !== 'found') {
            reply('error', null, `Product "<b>${data.itemName}</b>" not found on this return, so I stopped before saving. <b>Nothing was saved.</b>`);
            return;
        }
    }

    if (data.reason || data.notes) {
        const reasonEl = pageQS('[name="reasonDescription"],[name="reason"]')
                      || [...pageQSA('input,textarea')].find(i => i.offsetParent && /enter\s*a\s*reason|^reason/i.test((i.placeholder||'') + ' ' + labelNear(i)));
        if (reasonEl) setVal(reasonEl, data.reason || data.notes);
    }

    await applyReverseCharge(data);   // v9.12.0: RCM on sales + purchase
    watchResult('Debit Note Created', ['/purchase/debitnote/']);
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on Debit Note form.');
}

async function createSalesEstimate(data) {
    const _pc2 = await fillSelect2('contactVo', data.customerName);
    if (_pc2 === 'asked') return;
    if (!_pc2) {
        await partyNotFound(data.customerName, 'customer'); return;
    }
    await sleep(400);
    if (data.validUntil || data.dueDate) setVal(document.getElementById('dueDate'), data.validUntil || data.dueDate);
    if (data.notes) setVal(pageQS('textarea[name="note"]'), data.notes);

    if (data.itemName || data.items) {
        if (!await addLines(data, 'sales', it => `create estimate for ${data.customerName} ${it.qty || 1} ${it.name}`)) return;
        if (!data.items) {
            const row = getLastItemRow();
            if (row.qty   && data.qty && row.qty.value != data.qty) setVal(row.qty,   data.qty);
            if (row.price && data.price)                            setVal(row.price, data.price);
        }
    }
    if (discountGate(data, 'estimate')) return;
    await applyReverseCharge(data);   // v9.12.0: RCM on sales + purchase
    watchResult('Sales Estimate Created', ['/sales/estimate/']);
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on Sales Estimate form.');
}

async function createDeliveryChallan(data) {
    const _pc2 = await fillSelect2('contactVo', data.customerName);
    if (_pc2 === 'asked') return;
    if (!_pc2) {
        await partyNotFound(data.customerName, 'customer'); return;
    }
    await sleep(400);
    if (data.dueDate) setVal(document.getElementById('dueDate'), data.dueDate);
    if (data.notes)   setVal(pageQS('textarea[name="note"]'), data.notes);
    if (data.itemName || data.items) {
        if (!await addLines(data, 'sales', it => `create delivery challan for ${data.customerName} ${it.qty || 1} ${it.name}`)) return;
        if (!data.items) {
            const row = getLastItemRow();
            if (row.qty   && data.qty && row.qty.value != data.qty) setVal(row.qty,   data.qty);
            if (row.price && data.price)                            setVal(row.price, data.price);
        }
    }
    if (discountGate(data, 'delivery challan')) return;
    await applyReverseCharge(data);   // v9.12.0: RCM on sales + purchase
    watchResult('Delivery Challan Created', ['/sales/deliverychallan/']);
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on Delivery Challan form.');
}

// The "To" list on both transfer screens is a plain preloaded <select> of
// "<Name> - <code>" entries ("Test - testB"). Returns true, 'asked' (already
// replied), or false.
async function pickToLocation(term) {
    __vasyDestValue = '';
    {
        // The "To" list is a plain preloaded <select> of "<Name> - <code>" entries
        // ("Test - testB"). Match on the name, the code, or with a spoken
        // "branch"/"outlet" dropped — and when nothing fits, say what DOES exist
        // instead of a bare "not found".
        const sel = document.getElementById('branchTo');
        const opts = sel ? [...sel.options].filter(o => o.value && (o.text || '').trim()) : [];
        let ok = false;
        if (opts.length) {
            const bare = term.replace(/\s+(?:branch|outlet|store|location|franchise|warehouse)$/i, '').trim();
            const txt = o => (o.text || '').trim();
            const parts = o => txt(o).split(/\s+-\s+/);
            // STRICT. Fuzzy scoring against short codes is worthless here: "Main
            // Branch" scored above 0.6 against "AN - ANM" and would have sent the
            // stock to the wrong franchise. Exact name/code, then containment of a
            // 4+ letter name, then only a very close fuzzy match — and when two
            // entries fit, ask instead of choosing.
            const N = x => vasyNorm(x);
            const cands = opts.map(o => ({ o, nm: N(parts(o)[0]), code: N(parts(o)[1] || ''), full: N(txt(o)) }));
            let hits = [];
            for (const q of [...new Set([term, bare])].map(N).filter(Boolean)) {
                hits = cands.filter(c => c.nm === q || c.code === q || c.full === q);
                if (!hits.length && q.length >= 4)
                    hits = cands.filter(c => c.nm.includes(q) || (c.nm.length >= 4 && q.includes(c.nm)));
                if (hits.length) break;
            }
            if (!hits.length) {
                const f = vasyBest(bare, opts, o => parts(o)[0], 0.85);
                if (f) hits = [cands.find(c => c.o === f.item)];
            }
            if (hits.length > 1) {
                askChoice('Which one?', `More than one location fits "<b>${term}</b>". <b>Nothing was saved.</b>`, term,
                    hits.slice(0, 6).map(h => ({ label: txt(h.o), value: parts(h.o)[1] || txt(h.o) })));
                return 'asked';
            }
            const best = hits.length ? { item: hits[0].o } : null;
            if (best) {
                // The page's own start-up code resets this select a moment after
                // load, silently undoing the pick — set it, then make sure it stays.
                __vasyDestValue = best.item.value;
                // The page REJECTS some destinations on change and clears the box —
                // "This location cannot be used for interstate stock transfer as it
                // is not GST registered." Remember what was on screen before, so a
                // rejection can be reported in VasyERP's own words.
                const pageMsgs = () => [...pageQSA('.swal2-popup,.toast,.toast-message,#toast-container,.alert,.m-alert')]
                    .filter(e => e.getClientRects().length && !isChromeEl(e))
                    .map(e => (e.innerText || '').replace(/\s+/g, ' ').trim()).filter(t => t.length > 12 && t.length < 260);
                const seenMsgs = new Set(pageMsgs());
                for (let k = 0; k < 4; k++) {
                    if (sel.value !== __vasyDestValue) {
                        sel.value = __vasyDestValue;
                        sel.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    await sleep(700);
                    if (sel.value === __vasyDestValue) { ok = true; if (k >= 1) break; }
                    const why = pageMsgs().find(t => !seenMsgs.has(t));
                    if (why && sel.value !== __vasyDestValue) {
                        pageQS('.swal2-popup .swal2-confirm')?.click();
                        const others = opts.filter(o => o !== best.item).slice(0, 6).map(o => `<b>${txt(o)}</b>`).join(' · ');
                        reply('error', 'VasyERP rejected that location',
                            `VasyERP won't send stock to <b>${txt(best.item)}</b>: “${why.replace(/</g, '&lt;')}” <b>Nothing was saved.</b>` +
                            `<br><small>Other destinations on this account: ${others}.</small>`);
                        __vasyDestValue = '';
                        return 'asked';
                    }
                }
            } else {
                reply('error', 'Where to?',
                    `There's no branch or location called "<b>${term}</b>" to transfer to. <b>Nothing was saved.</b>` +
                    `<br><small>This account can send stock to: ${opts.slice(0, 8).map(o => `<b>${txt(o)}</b>`).join(' · ')}` +
                    `${opts.length > 8 ? ` and ${opts.length - 8} more` : ''}.</small>`);
                return 'asked';
            }
        } else {
            ok = await fillSelect2('branchTo', term);
            if (ok === 'asked') return;
        }
        if (!ok) { reply('error', null, `Branch/Location "<b>${term}</b>" not found. <b>Nothing was saved.</b>`); return 'asked'; }
        return true;
    }
}
// The page can reset the destination while a line loads; put it back before Save.
let __vasyDestValue = '';
function reassertToLocation(want = __vasyDestValue) {
    const sel = document.getElementById('branchTo');
    if (sel && want && sel.value !== want) { sel.value = want; sel.dispatchEvent(new Event('change', { bubbles: true })); return true; }
    return false;
}

async function createStockTransfer(data) {
    await settle(1200);
    const term = data.toLocation || data.toBranch;
    if (term) {
        const ok = await pickToLocation(term);
        if (ok !== true) return;
    }
    if (data.date) setVal(document.getElementById('stockTransferDate'), data.date);
    if (data.notes) setVal(pageQS('[name="note"]'), data.notes);

    if (data.itemName) {
        if (!await addLineOrExplain(data, data.itemName, 'stock',
                `stock transfer ${data.itemName} qty ${data.qty || 1} to ${term || 'branch'}`)) return;
        const row = getLastItemRow();
        if (row.qty && data.qty && row.qty.value != data.qty) setVal(row.qty, data.qty);
        if (row.price && data.price)       setVal(row.price,    data.price);
        if (row.discount && data.discount) setVal(row.discount, data.discount);

        // A batch whose purchase price is 0.00 leaves the row price at 0 and the
        // ERP rejects the save with "The Price Is Invalid" — a dead end for the
        // user. The batch option carries the real figures
        // ("PP : 0.00 - LC : 0.00 - MRP : 500 - SP : 300 - QTY : 4"), so fall back
        // to Selling Price, then MRP, and say which was used.
        if (row.price && !data.price && (!row.price.value || parseFloat(row.price.value) === 0)) {
            const n   = (row.price.id || '').replace(/^price/, '');
            const bSel = document.getElementById('batchId' + n);
            const bTxt = bSel && bSel.options[bSel.selectedIndex] ? bSel.options[bSel.selectedIndex].text : '';
            const sp  = (bTxt.match(/SP\s*:\s*([\d.]+)/i)  || [])[1];
            const mrp = (bTxt.match(/MRP\s*:\s*([\d.]+)/i) || [])[1];
            const use = [sp, mrp].map(parseFloat).find(v => v > 0);
            if (use) {
                setVal(row.price, String(use));
                await sleep(400);
                __vasyNote = `Used the batch's ${sp && parseFloat(sp) === use ? 'selling price' : 'MRP'} ₹${use} — that batch has no purchase price.`;
            }
        }
    }
    if (term) { await sleep(300); reassertToLocation(); }
    watchResult('Stock Transfer Created', ['/stocktransfer/'], __vasyNote || '');
    __vasyNote = '';
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on Stock Transfer form.');
}

async function createStockTransferRequest(data) {
    await settle(1200);
    // Recon (expo): "To Location" select | Transfer Date | Transfer No. (auto,
    // e.g. ST-REQ35) | "Enter Barcode or Search Product" | grid #/Product/Unit/Qty
    const term = data.toLocation || data.toBranch;
    if (term) {
        const ok = await pickToLocation(term);
        if (ok !== true) return;
        await sleep(600);
    }

    const dateEl = document.getElementById('stockTransferDate') || pageQS('input[name*="date" i]');
    if (data.date && dateEl) setVal(dateEl, data.date);
    if (data.notes) setVal(pageQS('[name="note"],[name="remark"]'), data.notes);

    if (data.itemName) {
        if (!await addLineOrExplain(data, data.itemName, 'stock',
                `create stock transfer request to ${term || 'branch'} for ${data.itemName} ${data.qty || 1}`)) return;
        const row = getLastItemRow();
        if (row.qty && data.qty && row.qty.value != data.qty) setVal(row.qty, data.qty);
    }
    if (term) { await sleep(300); reassertToLocation(); }
    watchResult('Stock Transfer Request Created', ['/stocktransferrequest/']);
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on Stock Transfer Request form.');
}

async function createMaterialConsumption(data) {
    await settle(2500);
    if (isRebuiltProductionPage()) {
        if (!data.itemName) { reply('info', null, 'Which item was consumed, and how much?'); return; }
        const qty = data.qty || 1;
        const r = await productionAddLine(0, data.itemName, qty);
        if (r.ask) { askWhichProduct(data.itemName, r.ask, `record consumption of ${(r.ask[0].firstElementChild || r.ask[0]).innerText.trim()} ${qty}`); return; }
        if (r.err) { reply('error', null, `Material Consumption: ${r.err}. <b>Nothing was saved.</b>`); return; }
        const note = document.getElementById('mc-note')
                  || [...pageQSA('input,textarea')].find(e => e.getClientRects().length && /e\.g\. damaged|remark|note/i.test((e.placeholder || '') + ' ' + labelNear(e)));
        if (note && (data.reason || data.notes)) typeLikeUser(note, data.reason || data.notes);
        watchResult('Material Consumed', ['/materialconsumption'], `Consumed <b>${r.qty}</b> × <b>${r.ok}</b>.`);
        if (!clickSaveBtn(document, { note: `This takes ${r.qty} × ${r.ok} out of stock (type and location as shown on the form), so I never post it without your OK.` }))
            reply('error', null, 'The "Post stock-out" button was not found.');
        return;
    }
    // ── legacy (pre-9.13.0) layout ──────────────────────────────────────────
    if (!data.itemName) { reply('error', null, 'Which item was consumed?'); return; }
    if (!await addLineOrExplain(data, data.itemName, 'purchase',
        `record consumption of ${data.itemName} ${data.qty || 1}`)) return;
    if (data.employee) await fillSelect2('employeeId', data.employee);
    if (data.date)     setVal(document.getElementById('consumptionDate'), data.date);
    const short = linesMissingQty();
    if (short.length) {
        reply('error', null, `<b>Qty</b> is compulsory and ${short.join(', ')} has none. <b>Nothing was saved.</b>`);
        return;
    }
    watchResult('Material Consumption Recorded', ['/materialconsumption/'], 'Stock has been issued out.');
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on the Material Consumption form.');
}


async function createExpense(data) {
    await settle(1200);
    // MANDATORY on this form (learned the hard way — the server rejects without
    // them): Select Party*, Select Account* (the expense ledger) and the tax
    // type. Amount/Price is obviously required too. We ask rather than fail.
    const party = data.partyName || data.vendorName || data.supplierName;
    const account = data.account || data.ledger || data.category || data.expenseCategory;
    const missing = [];
    if (!party)       missing.push('<b>Party</b> (who you paid — e.g. "to Reliance Fresh")');
    if (!account)     missing.push('<b>Account</b> (the expense ledger — e.g. "account Tea &amp; Refreshment")');
    if (!data.amount) missing.push('<b>Amount</b>');
    if (missing.length) {
        reply('error', null,
            `An expense needs a bit more before it can be saved — VasyERP marks these compulsory:<br>• ${missing.join('<br>• ')}` +
            `<br><small>e.g. <i>"add expense 500 tea to Reliance Fresh account Staff Welfare"</i></small>`);
        return;
    }

    const mode = (data.paymentMode || 'Cash').toLowerCase();
    const isBankMode = mode.includes('bank') || mode.includes('upi') || mode.includes('cheque');
    const radio = document.getElementById(isBankMode ? 'paymentModeBank' : 'paymentModeCash');
    if (radio) { radio.click(); await sleep(400); }
    if (isBankMode && data.bank) setSelect2Text('bankVo', data.bank);
    if (!isBankMode && data.cashAccount) setSelect2Text('cashdropdown', data.cashAccount);

    // Select Party* — id first, then by label
    let ok = await fillSelect2('accountCustomId', party);
    if (ok === 'asked') return;
    if (!ok) {
        ok = await selectByLabel(/select\s*party|^party/i, party, 'Party');
        if (ok === 'asked') return;
        if (!ok) { reply('error', null, `I couldn't find the <b>Select Party</b> field on this Expense form.`); return; }
    }
    await sleep(500);

    // Select Account* — the expense ledger (never the party dropdown)
    // The expense LINE account is #account0. Hidden TCS/TDS account pickers and
    // the "account{index}" row template sit earlier in the page and matched the
    // old "first select that says account" rule — so the search ran in the wrong
    // box and a ledger that exists came back "not found".
    const acctCands = [...pageQSA('select')].filter(s =>
        s.id !== 'accountCustomId' && !/\{|tcs|tds/i.test(s.id || '') &&
        (s.offsetParent || s.nextElementSibling?.offsetParent || s.closest('.select2,.form-group')) &&
        (/^account\d+$/.test(s.id || '') || /select\s*account|^account|search\s*account/i.test((labelNear(s) || '').trim())));
    const acctSel = acctCands.find(s => /^account\d+$/.test(s.id)) || acctCands[0];
    let acctOk = false;
    if (acctSel) {
        acctOk = setSelect2Text(acctSel.id, account) || await fillSelect2(acctSel.id, account);
        if (acctOk === 'asked') return;
    }
    if (!acctOk) {
        reply('error', null, `Expense account "<b>${account}</b>" not found. Check the ledger name under Accounting → Account, then try again.`);
        return;
    }
    await sleep(400);

    // Applied Tax Type (defaults to CGST/SGST) — only override when asked
    if (data.taxType) {
        const t = await selectByLabel(/applied\s*tax|tax\s*type/i, data.taxType, 'Tax type');
        if (t === 'asked') return;
    }

    if (data.date) setVal(document.getElementById('expenseDate'), data.date);
    if (data.invoiceNumber) setVal(pageQS('[name="invoiceNumber"]'), data.invoiceNumber);
    if (data.notes) setVal(pageQS('[name="remark"]'), data.notes);
    const priceEl = pageQS('input[id^="price"]:not([id*="{"])');
    if (!setVal(priceEl, data.amount)) smartSet(data.amount, { label:/^price|^amount/i });
    const descEl = pageQS('textarea[id^="description"]');
    if (descEl && (data.description || data.itemName)) setVal(descEl, data.description || data.itemName);

    // The line TAX is compulsory: the save was refused with the tax list as its
    // only message. Take it from the command ("gst 18", "no gst") or ask.
    const taxSel = document.getElementById('tax0');
    if (taxSel && taxSel.selectedIndex <= 0) {
        const tOpts = [...taxSel.options].filter(o => o.value && (o.text || '').trim());
        if (data.tax == null || data.tax === '') {
            reply('info', 'Which GST?',
                `VasyERP needs the <b>tax</b> on this expense line. <b>Nothing was saved.</b>` +
                `<br><small>Say it again with the GST, e.g. <i>"… gst 18"</i>, or <i>"… no gst"</i> if there isn't any.</small>`);
            return;
        }
        const rate = parseFloat(data.tax);
        const nm = o => (o.text || '').trim();
        const hit = rate === 0
            ? (tOpts.find(o => /^gst\s*0$/i.test(nm(o))) || tOpts.find(o => /^(non\s*gst|exempt)\s*0$/i.test(nm(o))))
            : (tOpts.find(o => new RegExp('^gst\\s*' + rate + '$', 'i').test(nm(o))) || tOpts.find(o => new RegExp('\\b' + rate + '(?:\\.0+)?\\s*%?$').test(nm(o))));
        if (!hit) {
            reply('info', 'Which GST?', `There's no ${rate}% tax on this account. <b>Nothing was saved.</b>` +
                `<br><small>Available: ${[...new Set(tOpts.map(nm))].slice(0, 12).join(', ')}.</small>`);
            return;
        }
        taxSel.value = hit.value;
        taxSel.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(500);
    }

    watchResult('Expense Created', ['/expense/']);
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on Expense form.');
}

async function createInternalTransfer(data) {
    const isTransfer = !!(data.toAccount) || (data.type||'').toLowerCase().includes('transfer');

    if (isTransfer) {
        const transferTab = [...pageQSA('button,.nav-link,a')].find(b =>
            /^transfer$/i.test((b.innerText||'').trim()) && b.offsetParent
        );
        if (transferTab) { transferTab.click(); await sleep(500); }
        if (data.fromAccount) setSelect2Text('fromaccount_tranfer', data.fromAccount);
        if (data.toAccount)   setSelect2Text('account_tranfer',     data.toAccount);
        setVal(document.getElementById('amountTransfer'), data.amount);
        if (data.date) setVal(document.getElementById('transactionDatetransfer'), data.date);
        if (data.notes) setVal(pageQSA('[name="description"]')[1] || pageQS('[name="description"]'), data.notes);
    } else {
        if (data.fromAccount) setSelect2Text('fromaccount', data.fromAccount);
        if (data.toEmployee)  setSelect2Text('account',     data.toEmployee);
        setVal(document.getElementById('amountWithdraw'), data.amount);
        if (data.date) setVal(document.getElementById('transactionDateWithdraw'), data.date);
        if (data.notes) setVal(pageQS('[name="description"]'), data.notes);
    }
    watchResult('Transfer Recorded', ['/manager/internaltransfer/']);
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on Internal Transfer form.');
}

// ── V9.14.0 (15/10/2026): Recipe and Bill of Materials are React pages ─────────
// Recipe  /recipe/new — Recipe Name* input[name=name] · Recipe No. (auto) · Type
//   react-select (Assemble / Disassemble) · Recipe Date* .custom-datepicker, then
//   Inputs  .search-input-field "…add as input…"  → row: qty (number, 1) + wastage
//   Outputs .search-input-field "…add as output…" → row: qty (number, 1) · Save.
// BOM  /billofmaterials/new — now a PRODUCTION RUN: Date · Doc no. (auto) · Allow
//   Reverse Calculation switch · "Recipes to produce*" multi react-select (options
//   "<recipe> RCCpp<n>-<finished good>"); each pick adds a line with a BATCHES
//   stepper (− n + Max), its ingredients and a cost panel (Units produced, Stock
//   shortages). "Post production" consumes the ingredients and adds the goods.
// The product boxes are Typesense-backed: they search on keystrokes, not on a
// value set in one go; hits are .search-dropdown-item (.search-item-name/-code).
async function typeKeys(inp, text) {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    inp.focus(); inp.click();
    set.call(inp, ''); inp.dispatchEvent(new Event('input', { bubbles: true }));
    for (const ch of String(text)) {
        set.call(inp, inp.value + ch);
        inp.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
        inp.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch, inputType: 'insertText' }));
        inp.dispatchEvent(new KeyboardEvent('keyup', { key: ch, bubbles: true }));
        await sleep(60);
    }
}
// "2 Notebook1 and 1 PP10955" / "Notebook1 x2, PP10955" → [{name, qty}]
function recipeLineList(s, qty) {
    if (Array.isArray(s)) return s.filter(l => l && l.name);
    const out = String(s || '').split(/\s*(?:,|;|\band\b|\+|&)\s*/i).map(x => x.trim()).filter(Boolean).map(x => {
        let m = x.match(/^(\d+(?:\.\d+)?)\s*(?:x|×|pcs?|units?|nos?|kgs?)?\s+(.+)$/i);
        if (m) return { name: m[2].trim(), qty: m[1] };
        m = x.match(/^(.+?)\s*(?:x|×|qty)\s*(\d+(?:\.\d+)?)$/i);
        return m ? { name: m[1].trim(), qty: m[2] } : { name: x, qty: null };
    });
    if (out.length === 1 && qty && !out[0].qty) out[0].qty = qty;
    return out;
}
// Pick one product from a search box. 'asked' = a "which one?" is on screen.
// `getInp` is a finder, not an element: setting a line's qty re-renders the form and
// replaces the search boxes, so a box held from before types into a detached node.
async function pickSearchProduct(getInp, term, choiceField, what) {
    const pin = (String(term).match(/#\s*([A-Za-z0-9\-\/]+)\s*$/) || [])[1];
    const q = String(term).replace(/\s*#\s*[A-Za-z0-9\-\/]+\s*$/, '').trim();
    const items = () => [...pageQSA('.search-dropdown-list .search-dropdown-item')].filter(e => e.getClientRects().length);
    let list = [];
    for (let attempt = 0; attempt < 2 && !list.length; attempt++) {
        const inp = typeof getInp === 'function' ? getInp() : getInp;
        if (!inp) return false;
        await typeKeys(inp, pin || q);
        for (let i = 0; i < (attempt ? 24 : 9) && !(list = items()).length; i++) await sleep(250);
    }
    await sleep(500);
    list = items();
    const nameOf = e => (e.querySelector('.search-item-name')?.innerText || '').trim();
    const codeOf = e => (e.querySelector('.search-item-code')?.innerText || '').trim();
    pickSearchProduct.seen = list.slice(0, 5).map(e => [nameOf(e), codeOf(e)].filter(Boolean).join(' '));
    if (!list.length) return false;
    let hit = pin ? list.find(e => vasyNorm(codeOf(e)) === vasyNorm(pin)) : null;
    if (!hit) {
        const exact = list.filter(e => vasyNorm(nameOf(e)) === vasyNorm(q) || vasyNorm(codeOf(e)) === vasyNorm(q));
        const pool = exact.length ? exact : list.filter(e => vasyFuzzy(q, nameOf(e)) >= 0.6);
        if (pool.length === 1) hit = pool[0];
        else if (pool.length > 1) {
            askChoice('Which one?', `<b>${pool.length}</b> products match "<b>${q}</b>"${what ? ` (${what})` : ''}. <b>Nothing is saved yet.</b>`, q,
                pool.slice(0, 6).map(e => ({ label: `${nameOf(e)} (${codeOf(e)})`, value: `${nameOf(e)} #${codeOf(e)}` })), choiceField);
            return 'asked';
        }
    }
    if (!hit) return false;
    hit.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    hit.click();
    await sleep(700);
    return true;
}

async function createRecipeV2(data) {
    // a tapped "which one?" answer lands as pick:inputs:<i> / pick:outputs:<i>
    const inputs = recipeLineList(data.inputs || data.rawItemName, data.rawQty).map(l => ({ ...l }));
    const outputs = recipeLineList(data.outputs || data.finishedItemName || data.outputItemName, data.finishedQty || data.outputQty).map(l => ({ ...l }));
    for (const [k, v] of Object.entries(data)) {
        const m = k.match(/^pick:(inputs|outputs):(\d+)$/);
        const arr = m && (m[1] === 'inputs' ? inputs : outputs);
        if (arr && arr[+m[2]] && v) arr[+m[2]].name = v;
    }
    const name = data.recipeName || data.name;
    if (!name) { reply('error', null, 'What should the recipe be called?'); return; }
    if (!inputs.length) { reply('info', null, `What goes into <b>${name}</b> per batch? e.g. <i>"2 Notebook1 and 1 PP10955"</i>`); return; }
    if (!outputs.length) { reply('info', null, `What does one batch of <b>${name}</b> make? e.g. <i>"makes 1 Gift Hamper"</i>`); return; }
    if (!setVal(pageQS('input[name="name"]'), name)) { reply('error', null, 'Recipe Name box not found on the new Recipe form.'); return; }
    if (data.recipeType && /dis|un/i.test(data.recipeType)) {   // Assemble is the default
        const r = await fillReactSelect(/^type$/i, 'Disassemble', 1500, 'recipe type');
        if (r !== true) { reply('error', null, `I couldn't set the recipe Type to <b>Disassemble</b>. <b>Nothing was saved.</b>`); return; }
    }
    if (data.date) {
        const d = pageQS('input.custom-datepicker');
        if (d) setVal(d, data.date);
    }
    const box = re => [...pageQSA('input.search-input-field')].find(i => i.getClientRects().length && re.test(i.placeholder || ''));
    const qtyBoxes = () => [...pageQSA('input[type="number"]')].filter(i => i.getClientRects().length && !i.classList.contains('recipe-row-wastage-input'));
    const added = [];
    for (const [list, re, kind] of [[inputs, /add as input/i, 'inputs'], [outputs, /add as output/i, 'outputs']]) {
        for (let i = 0; i < list.length; i++) {
            if (!box(re)) { reply('error', null, `The ${kind === 'inputs' ? 'Inputs' : 'Outputs'} search box isn't on the Recipe form.`); return; }
            await settle(600);   // the previous line's qty edit re-renders the form
            const before = new Set(qtyBoxes());
            const st = await pickSearchProduct(() => box(re), list[i].name, `pick:${kind}:${i}`, kind === 'inputs' ? 'goes in' : 'comes out');
            if (st === 'asked') return;
            if (!st) {
                const seen = (pickSearchProduct.seen || []).join(', ');
                reply('error', null, `No product called "<b>${list[i].name}</b>"${kind === 'outputs' ? ' among the finished goods' : ''}. <b>Nothing was saved.</b> Check the name or give me its item code.` +
                    (seen ? `<br><small>The search offered: ${seen}</small>` : ''));
                return;
            }
            const fresh = qtyBoxes().find(b => !before.has(b));
            if (fresh && list[i].qty) { setVal(fresh, list[i].qty); await sleep(250); }
            added.push(`${kind === 'inputs' ? '⬇' : '⬆'} ${list[i].name.replace(/\s*#\S+$/, '')} × ${list[i].qty || 1}`);
        }
    }
    watchResult('Recipe Created', ['/recipe'], added.join('<br>'));
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on the Recipe form.');
}

async function createProductionRun(data) {
    const term = String(data.recipeName || data.recipe || '').trim();
    if (!term) { reply('error', null, 'Which recipe should I produce?'); return; }
    const pin = (term.match(/#\s*(\w+)\s*$/) || [])[1];
    const q = term.replace(/\s*#\s*\w+\s*$/, '');
    const inp = [...pageQSA('input[id^="react-select-"][id$="-input"]')].find(i =>
        /recipes?\s+to\s+produce/i.test(rsOuter(i)?.innerText || ''));
    if (!inp) { reply('error', null, `The "Recipes to produce" picker isn't on the production page.`); return; }
    if (data.reverseCalculation) {
        const sw = pageQS('input[aria-label="toggle-switch"]');
        if (sw && !sw.checked) { sw.click(); await sleep(300); }
    }
    const ctrl = inp.closest('[class*="__control"],[class*="-control"]');
    if (ctrl) ctrl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    inp.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, pin || q);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    const idn = (inp.id.match(/^react-select-(.+)-input$/) || [])[1];
    const optSel = `[id^="react-select-${idn}-option-"]`;
    await waitForEl(optSel, 3000);
    await sleep(300);
    // "Mix Mithai RCCpp2-Mix Mithai" → recipe name · recipe no. · finished good
    const opts = [...pageQSA(optSel)].filter(o => o.getClientRects().length).map(o => {
        const t = (o.innerText || '').replace(/\s+/g, ' ').trim();
        const m = t.match(/^(.*?)\s+(RC\w*?\d+)-(.*)$/i);
        return { o, t, name: m ? m[1] : t, code: m ? m[2] : '', good: m ? m[3] : '' };
    });
    if (!opts.length || /no option/i.test(opts[0].t)) { reply('error', null, `No recipe called "<b>${q}</b>". Create it first: <i>"create recipe ${q} with … makes …"</i>`); return; }
    const k = vasyNorm(q);
    let pool = pin ? opts.filter(x => vasyNorm(x.code) === vasyNorm(pin)) : opts.filter(x => vasyNorm(x.name) === k || vasyNorm(x.code) === k);
    if (!pool.length) pool = opts.filter(x => vasyNorm(x.good) === k);
    if (!pool.length) pool = opts.filter(x => vasyFuzzy(q, x.name) >= 0.7);
    if (pool.length !== 1) {
        if (!pool.length) pool = opts.slice(0, 6);
        askChoice('Which recipe?', `${pool.length > 1 ? `<b>${pool.length}</b> recipes match` : 'No exact recipe for'} "<b>${q}</b>". <b>Nothing is posted.</b>`, q,
            pool.slice(0, 6).map(x => ({ label: `${x.name} (${x.code} → ${x.good})`, value: `${x.name} #${x.code}` })), 'recipeName');
        return;
    }
    pool[0].o.click();
    const batchBox = await waitForEl(() => [...pageQSA('input[type="number"]')].find(i => i.getClientRects().length), 6000);
    if (!batchBox) { reply('error', null, `I picked <b>${pool[0].name}</b> but no production line appeared. <b>Nothing was posted.</b>`); return; }
    const batches = data.batches || data.qty;
    if (batches && String(batches) !== '1') { setVal(batchBox, batches); await settle(1500); }
    // what this run will do, read off the page's own cost panel
    const txt = pageText();
    const num = re => ((txt.match(re) || [])[1] || '').trim();
    const units = num(/Units produced\s+([\d.,]+)/i), short = num(/Stock shortages\s+(\d+)/i),
          cost = num(/Total batch cost\s+([\d.,]+)/i), value = num(/Output value\s+([\d.,]+)/i);
    const note = `<b>${pool[0].name}</b> → ${pool[0].good} · <b>${batchBox.value || 1}</b> batch(es)` +
        (units ? ` = <b>${units}</b> units` : '') + (cost ? `<br>Batch cost ₹${cost}` : '') + (value ? ` · output value ₹${value}` : '') +
        (short && short !== '0' ? `<br><b style="color:#b3202a">⚠ ${short} ingredient(s) short of stock</b> — posting will take stock negative or be refused.` : '') +
        `<br><small style="color:#888">Posting consumes the ingredients and adds the finished goods to stock, so I hold it for your OK.</small>`;
    watchResult('Production Posted', ['/billofmaterials'], `${pool[0].name} × ${batchBox.value || 1} batch(es)`);
    if (!clickSaveBtn(document, { note })) reply('error', null, 'Post production button not found.');
}

async function createBillOfMaterials(data) {
    await settle(1200);
    const v2 = await waitForEl(() => [...pageQSA('input[id^="react-select-"]')].find(i =>
        /recipes?\s+to\s+produce/i.test(rsOuter(i)?.innerText || '')), 5000);
    if (v2) return createProductionRun(data);
    // Recon (expo): Bill Of Materials Date* | Bill Of Materials No. (auto) |
    // Select Recipe* (options read "<recipe name> RCP<n>-<finished product>") |
    // Allow Reverse Calculation | then a Product Details grid pulled from the recipe.
    if (data.date && !setVal(document.getElementById('materialsDate'), data.date))
        smartSet(data.date, { label:/bill\s*of\s*materials\s*date/i });
    if (data.recipeName || data.recipe) {
        const term = data.recipeName || data.recipe;
        let ok = setSelect2Text('recipeId', term);
        if (!ok) {
            const sel = document.getElementById('recipeId')
                     || [...pageQSA('select')].find(s => s.offsetParent && /select\s*recipe/i.test(labelNear(s)));
            if (sel) {
                const opts = [...sel.options].filter(o => o.value);
                const hit = vasyBest(term, opts, o => (o.text || '').trim(), 0.45);
                if (hit) { sel.value = hit.item.value; sel.dispatchEvent(new Event('change', { bubbles: true })); ok = true; }
                else {
                    reply('error', null, `Recipe "<b>${term}</b>" not found. Closest: ${opts.slice(0,4).map(o=>(o.text||'').trim().slice(0,30)).join(' / ')}`);
                    return;
                }
            }
        }
        if (!ok) { reply('error', null, `Recipe "<b>${term}</b>" not found. Create it first via Production › Recipes.`); return; }
        await settle(2500);   // recipe pull populates both product grids
    }
    if (data.reverseCalculation) {
        const cb = [...pageQSA('input[type="checkbox"]')].find(c =>
            (c.offsetParent || c.closest('label')) && /allow\s*reverse/i.test(labelNear(c) + ' ' + (c.closest('label')?.innerText || '')));
        if (cb && !cb.checked) { cb.click(); await sleep(400); }
    }
    if (data.qty) {
        // Finished qty lives in the first grid row ("Qty*")
        const qtyInp = [...pageQSA('input')].find(i => i.offsetParent && /^qty/i.test((i.placeholder||'') + ' ' + labelNear(i)));
        if (qtyInp) setVal(qtyInp, data.qty);
    }
    watchResult('Bill of Materials Created', ['/billofmaterials/']);
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on Bill of Materials form.');
}

async function createRecipe(data) {
    await settle(1200);
    if (await waitForEl(() => pageQS('input[name="name"]') && pageQS('input.search-input-field'), 5000)) return createRecipeV2(data);
    // Recon labels: Recipe Name* | Recipe Date* | Recipe No. | Recipe Type (ASSEMBLE / UNASSEMBLE)
    const nm = data.recipeName || data.name;
    if (!setVal(document.getElementById('recipeName'), nm))
        smartSet(nm, { ids:['recipeName'], ph:/recipe\s*name/i, label:/recipe\s*name/i });
    if (data.date && !setVal(document.getElementById('recipeDateString'), data.date))
        smartSet(data.date, { label:/recipe\s*date/i });
    if (data.recipeType && !setSelect2Text('recipetype', data.recipeType)) {
        const sel = [...pageQSA('select')].find(s => s.offsetParent && /recipe\s*type/i.test(labelNear(s)));
        if (sel) {
            const opt = vasyBest(data.recipeType, [...sel.options], o => (o.text||'').trim(), 0.4);
            if (opt) { sel.value = opt.item.value; sel.dispatchEvent(new Event('change', {bubbles:true})); }
        }
    }

    // Two grids, each with a "Scan Barcode/Enter Product Name" box:
    // Raw Product (qty column "Use Qty*") then Final Product ("Qty Generate*").
    const recipeBoxes = () => [...pageQSA('input')].filter(i =>
        i.offsetParent && /scan\s*barcode|enter\s*product\s*name/i.test(i.placeholder || ''));
    if (data.rawItemName) {
        const boxes = recipeBoxes();
        const st = await searchAndSelectItem(data.rawItemName, { inputId: (boxes[0] && boxes[0].id) || 'searchParentItemBarcode' });
        if (st === 'asked') return;
        if (!st) { reply('error', null, `Raw product "<b>${data.rawItemName}</b>" not found.`); return; }
        if (data.rawQty) {
            const qtyEl = pageQS('input[id^="recipeParentItemqty"]:not([id*="{"])');
            if (!setVal(qtyEl, data.rawQty)) smartSet(data.rawQty, { label:/use\s*qty/i });
        }
        await sleep(400);
    }
    if (data.finishedItemName || data.outputItemName) {
        const name = data.finishedItemName || data.outputItemName;
        const boxes = recipeBoxes();
        const st = await searchAndSelectItem(name, { inputId: (boxes[1] && boxes[1].id) || 'searchRecipeItemBarcode' });
        if (st === 'asked') return;
        if (!st) { reply('error', null, `Final product "<b>${name}</b>" not found.`); return; }
        const q = data.finishedQty || data.outputQty;
        if (q) {
            const qtyEl = pageQS('input[id^="recipeItemqty"]:not([id*="{"])');
            if (!setVal(qtyEl, q)) smartSet(q, { label:/qty\s*generate/i });
        }
    }
    watchResult('Recipe Created', ['/recipe/']);
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on Recipe form.');
}

// The redesigned page is a div grid, not a table: each line holds a react-select
// account picker and TWO amount boxes that both read placeholder "0.00" — the
// first is Debit, the second Credit. The old handler looked for
// input[placeholder="Debit"] (never matched, so the amount was silently dropped)
// and refused the credit side outright, which can only ever leave an unbalanced
// voucher the ERP will not accept.
async function createJournalVoucher(data) {
    await settle(1500);
    const amtInputs = () => [...pageQSA('input')]
        .filter(i => i.offsetParent && i.placeholder === '0.00');
    const rowOf = (el) => { let n = el;
        for (let i = 0; i < 6 && n; i++) { n = n.parentElement;
            if (n && n.querySelector('input[id^="react-select-"]')
                  && n.querySelectorAll('input[placeholder="0.00"]').length === 2) return n; }
        return null; };
    const rowAt = (k) => { const a = amtInputs(); return a[k * 2] ? rowOf(a[k * 2]) : null; };
    const fillLine = async (rowEl, account, amount, side) => {
        const rs = rowEl && rowEl.querySelector('input[id^="react-select-"][id$="-input"]');
        if (!rs) return `couldn't find the account picker on line ${side}`;
        // The ledger list is remote-backed and slow to first paint — 1.8s (the
        // fillReactSelect default) intermittently returned "no options" for a
        // term that plainly matches.
        const ok = await fillReactSelect(rs.id, account, 7000, `the ${side} account`);
        if (ok === 'asked') return 'asked';
        if (!ok) return `"${account}" didn't match any account ledger`;
        await sleep(350);
        const boxes = [...rowEl.querySelectorAll('input[placeholder="0.00"]')];
        const target = side === 'debit' ? boxes[0] : boxes[1];
        if (!target) return `couldn't find the ${side} amount box`;
        setVal(target, String(amount));
        await sleep(250);
        return null;
    };

    if (data.date) { const d = pageQS('input[placeholder*="DD/MM"]'); if (d) setVal(d, data.date); }
    if (data.reference) { const r = pageQS('input[name="reference"]'); if (r) setVal(r, data.reference); }
    const narration = data.description || data.notes;
    if (narration) { const d = pageQS('[name="description"]'); if (d) setVal(d, narration); }

    if (!data.debitAccount || !data.creditAccount || !data.amount) {
        reply('info', null,
            `A journal voucher needs both sides to balance. Tell me it like ` +
            `<i>"journal voucher debit Rent 5000 credit Cash 5000"</i> — I have ` +
            `${[data.debitAccount && 'the debit account', data.creditAccount && 'the credit account',
                data.amount && 'the amount'].filter(Boolean).join(', ') || 'nothing yet'}.`);
        return;
    }

    let err = await fillLine(rowAt(0), data.debitAccount, data.amount, 'debit');
    if (err === 'asked') return;
    if (err) { reply('error', null, `Journal voucher: ${err}.`); return; }

    // Second line only exists after "Add line".
    if (!rowAt(1)) {
        const addBtn = [...pageQSA('button')].find(b => b.offsetParent && /^add line$/i.test((b.innerText||'').trim()));
        if (!addBtn) { reply('error', null, 'Journal voucher: the "Add line" button was not found, so I can\'t add the credit side.'); return; }
        addBtn.click();
        await waitForEl(() => rowAt(1), 4000);
        await sleep(400);
    }
    err = await fillLine(rowAt(1), data.creditAccount, data.creditAmount || data.amount, 'credit');
    if (err === 'asked') return;
    if (err) { reply('error', null, `Journal voucher: ${err}.`); return; }

    // The page keeps a running Difference — never post an unbalanced voucher.
    await sleep(700);
    const diffM = pageText().match(/Difference\s*([\d,]+\.?\d*)/i);
    const diff = diffM ? parseFloat(diffM[1].replace(/,/g, '')) : 0;
    if (diff > 0.009) {
        reply('info', null,
            `The voucher is filled in but it doesn't balance — <b>Difference ${diffM[1]}</b>. ` +
            `<small>Nothing was saved. Check the two amounts and tell me the correction.</small>`);
        return;
    }
    watchResult('Journal Voucher Created', ['/journalvoucher/'],
        `Debit ${data.debitAccount} / Credit ${data.creditAccount} — ${data.amount}.`);
    // the generic summary can't read react-select pickers — say what is posted
    const amt = data.debitAmount || data.amount, camt = data.creditAmount || data.amount;
    if (!clickSaveBtn(document, { note: `<b>Debit</b> ${data.debitAccount} ₹${amt} · <b>Credit</b> ${data.creditAccount} ₹${camt}. This posts to your books, so I never save it without your OK.` }))
        reply('error', null, 'Save button not found on Journal Voucher form.');
}

async function createMaterialCreation(data) {
    await settle(2500);
    if (isRebuiltProductionPage()) {
        if (!data.finishedItemName) { reply('info', null, 'Which finished item are you making?'); return; }
        if (!data.rawItemName) {
            reply('info', null, `What goes into <b>${data.finishedItemName}</b>? Say e.g. <i>"create material creation for ${data.finishedItemName} ${data.finishedQty || 1} from &lt;raw material&gt; &lt;qty&gt;"</i>.`);
            return;
        }
        const rawQty = data.rawQty || data.qty || 1, finQty = data.finishedQty || 1;
        const retry = `create material creation for ${data.finishedItemName} ${finQty} from ${data.rawItemName} ${rawQty}`;
        const a = await productionAddLine(0, data.rawItemName, rawQty);
        if (a.ask) { askWhichProduct(data.rawItemName, a.ask, retry); return; }
        if (a.err) { reply('error', null, `Material taken: ${a.err}. <b>Nothing was saved.</b>`); return; }
        const b = await productionAddLine(1, data.finishedItemName, finQty);
        if (b.ask) { askWhichProduct(data.finishedItemName, b.ask, retry); return; }
        if (b.err) { reply('error', null, `Goods received: ${b.err}. <b>Nothing was saved.</b>`); return; }
        const note = document.getElementById('mc-note');
        if (note && data.notes) typeLikeUser(note, data.notes);
        await sleep(500);
        watchResult('Goods Created', ['/materialcreation'], `Used <b>${a.qty}</b> × <b>${a.ok}</b> to make <b>${b.qty}</b> × <b>${b.ok}</b>.`);
        if (!clickSaveBtn(document, { note: `This takes ${a.qty} × ${a.ok} out of stock and adds ${b.qty} × ${b.ok}, so I never post it without your OK.` }))
            reply('error', null, 'The "Post & create goods" button was not found.');
        return;
    }
    // ── legacy (pre-9.13.0) layout ──────────────────────────────────────────
    if (!data.rawItemName) { reply('error', null, 'Which raw material are you converting?'); return; }
    if (!await addLineOrExplain({ ...data, itemName: data.rawItemName }, data.rawItemName, 'purchase',
        `create ${data.finishedItemName || 'finished goods'} from ${data.rawItemName}`)) return;
    if (data.date) setVal(document.getElementById('creationDate'), data.date);
    watchResult('Material Creation Recorded', ['/materialcreation/'], 'Finished goods added to stock.');
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on the Material Creation form.');
}


// ── POS batch picker ────────────────────────────────────────────────────────
// These two were called by the POS flow but never defined, so EVERY POS sale
// crashed ("_findBatchModal is not defined") right after its first item went
// into the cart. The batch dialog only exists while VasyERP is asking, so find
// it by what it says, not by a fixed id.
function _findBatchModal() {
    const cands = [...pageQSA('.modal.show, .modal.in, .modal[style*="display: block"], .swal2-popup, [role="dialog"]')]
        .filter(m => m.getClientRects().length && !isChromeEl(m)
                  && !/announcement|callback|support|important notice|upgrade your hardware|free quote/i.test(m.innerText || ''));
    return cands.find(m => /\bbatch/i.test((m.id || '') + ' ' + (m.className || '') + ' ' + (m.innerText || '').slice(0, 500))) || null;
}
function _batchChoices(modal) {
    const sels = [...modal.querySelectorAll('select')].filter(x => x.getClientRects().length && x.options.length > 1);
    const sel = sels.find(x => /batch/i.test((x.id || '') + ' ' + (x.name || '') + ' ' + labelNear(x))) || sels[0];
    if (sel) {
        const items = [...sel.options].filter(o => o.value && !/^\s*(select|choose)\b/i.test(o.text))
            .map(o => ({ label: o.text.replace(/\s+/g, ' ').trim().slice(0, 90), value: o.value }));
        return { kind: 'select', el: sel, items };
    }
    const rows = [...modal.querySelectorAll('tbody tr, .batch-row, li')]
        .filter(r => r.getClientRects().length && /\d/.test(r.innerText || '') && !r.querySelector('th'));
    return { kind: 'rows', el: null, items: rows.map(r => ({ label: r.innerText.replace(/\s+/g, ' ').trim().slice(0, 90), row: r })) };
}

async function _applyBatchChoice(choices, idx) {
    const it = choices && choices.items && choices.items[idx];
    if (!it) return false;
    if (choices.kind === 'select') {
        // No jQuery in the isolated world — the ERP's Save handler reads the
        // underlying <select>, so a native set + change is enough.
        setVal(choices.el, it.value);
        choices.el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
        const radio = it.row.querySelector('input[type="radio"]');
        if (radio && !radio.checked) { radio.click(); await sleep(200); }
        const rowBtn = [...it.row.querySelectorAll('button')].find(b =>
            b.offsetParent && /select|choose|add|pick/i.test(b.innerText || ''));
        if (rowBtn) { rowBtn.click(); await sleep(400); }
    }
    await sleep(300);
    return true;
}

// Scan an item code / barcode into the POS box the way a scanner does. The page
// adds it on a keyup Enter (getProductByBarcode); the MAIN-world bridge calls
// that directly, with a keyCode-13 event as the fallback when the bridge is absent.
async function _scanPOSCode(inp, code) {
    const cartRows = () => [...pageQSA('tbody tr')].filter(r => r.offsetParent && r.querySelector('input')).length;
    const before = cartRows();
    const ds = document.documentElement.dataset;
    ds.vasyScanResult = '';
    ds.vasyScanCode = code;
    document.dispatchEvent(new CustomEvent('vasy:pos-scan'));
    let bridged = '';
    const bEnd = Date.now() + 1500;
    while (Date.now() < bEnd && !(bridged = ds.vasyScanResult || '')) await sleep(100);
    if (!/^(called|keyup)$/.test(bridged)) {
        inp.focus();
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, code);
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        for (const type of ['keydown', 'keyup'])   // keyCode in the init dict is visible to the page's world
            inp.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    }
    const oldToasts = new Set(pageQSA('.toast-message, .toast'));
    const notAvailable = () => [...pageQSA('.toast-message, .toast')].some(t =>
        !oldToasts.has(t) && t.getClientRects().length && /not available|no products? found/i.test(t.textContent || ''));
    const end = Date.now() + 10000;
    while (Date.now() < end) {
        if (cartRows() > before || _findBatchModal()) return true;
        if (notAvailable()) break;
        await sleep(250);
    }
    // an unknown code opens the "create this product" dialog — don't leave it up
    const direct = document.getElementById('product_model_for_direct');
    if (direct && direct.getClientRects().length) {
        const x = direct.querySelector('[data-dismiss="modal"], [data-bs-dismiss="modal"], .close, .btn-close');
        if (x) x.click();
        await sleep(400);
    }
    return cartRows() > before;
}

async function _addPOSItem(itemName, qty, discount) {
    const inp = pageQS(
        '#searchBarcode, #searchItemBarcode, ' +
        'input[placeholder*="Scan Barcode" i], input[placeholder*="Product Name" i], input[placeholder*="item" i]'
    );
    if (!inp) return false;

    // Fuzzy Bloodhound search + typeahead select via the MAIN-world bridge —
    // the same proven mechanism as PO/SO (POS datum uses .value, POS event is
    // typeahead:selected; both handled by the bridge). No qty here: the POS
    // cart row is filled below, not via itemcode inputs.
    const term = String(itemName).trim();
    // The POS product box searches NAMES. Item codes and barcodes are meant to be
    // SCANNED (value + Enter), so "sell 1 PP10955" found nothing by name. A
    // code-shaped term is scanned first — exact and fast — then tried as a name.
    const looksLikeCode = /^[A-Za-z0-9][A-Za-z0-9\-_.\/]{2,}$/.test(term) && /\d/.test(term);
    let found = looksLikeCode && await _scanPOSCode(inp, term) ? 'found' : '';
    if (found !== 'found') found = await searchAndSelectItem(term, { inputId: inp.id || 'searchBarcode' });
    // A question ("which one?") has already been asked — don't follow it with a
    // second "not found" reply that lands while the user is answering.
    if (found === 'asked') return 'asked';
    if (found !== 'found' && !looksLikeCode) {
        // a fast "no" on a cold terminal is usually the catalogue still loading
        await sleep(3000);
        found = await searchAndSelectItem(term, { inputId: inp.id || 'searchBarcode' });
        if (found === 'asked') return 'asked';
    }
    if (found !== 'found') return false;
    await sleep(300);

    // ── Batch Modal Handling ───────────────────────────────────────────────
    let batchModal = _findBatchModal();
    if (!batchModal) batchModal = await waitForEl(_findBatchModal, 3000);

    if (batchModal) {
        const choices = _batchChoices(batchModal);

        if (choices.items.length > 1) {
            // Multiple batches — ask user to choose instead of auto-selecting
            const batchList = choices.items.map((c, i) => `${i + 1}. ${c.label}`).join('<br>');
            // Store pending state for handleSelectBatch to resume
            window.__vasyBatchPending = {
                modal: batchModal, choices,
                currentItemName: itemName, currentQty: qty, currentDiscount: discount,
                remainingItems: [], posData: null,
            };
            reply('batch_needed', null,
                `<b>${choices.items.length} batches available</b> for "<b>${itemName}</b>":<br>` +
                `<code style="font-size:11px;white-space:pre-wrap">${batchList}</code><br>` +
                `Tap one, or reply with its number — e.g. <b>"batch 1"</b>`,
                { choices: choices.items.slice(0, 6).map((c, i) => ({ label: `${i + 1}. ${c.label}`.slice(0, 70), value: `batch ${i + 1}` })) }
            );
            return 'batch_pending';
        }

        // Single batch — auto-select
        if (choices.items.length === 1) await _applyBatchChoice(choices, 0);

        const modalBtn = [...batchModal.querySelectorAll('button')].find(b =>
            b.offsetParent &&
            /^(save|select|ok|confirm|apply|add|done|submit|proceed)$/i.test((b.innerText||'').trim())
        ) || batchModal.querySelector('.btn-primary, .btn-success, button[type="submit"]');
        if (modalBtn) { modalBtn.click(); await sleep(300); }
        await waitForEl(() => !_findBatchModal(), 4000);
        await sleep(500);
    }

    // ── Set qty and discount on the new cart row ───────────────────────────
    await waitForEl(() => {
        const rows = [...pageQSA('tbody tr')].filter(r => r.offsetParent && r.querySelector('input'));
        return rows.length ? rows[rows.length - 1] : null;
    }, 3000);
    await sleep(200);

    const rows = [...pageQSA('tbody tr')].filter(r => r.offsetParent && r.querySelector('input'));
    const newRow = rows[rows.length - 1];
    if (!newRow) return true;

    const rowInputs = [...newRow.querySelectorAll('input[type="text"],input[type="number"],input:not([type])')].filter(i => i.offsetParent);
    if (qty && Number(qty) !== 1 && rowInputs[0]) { setVal(rowInputs[0], String(qty)); await sleep(200); }
    if (discount && Number(discount) > 0 && rowInputs[2]) { setVal(rowInputs[2], String(discount)); await sleep(200); }
    return true;
}

// Complete the payment step of a POS sale (shared by createPOSSale and handleSelectBatch)
async function _completePOSSale(data) {
    const cartRows = [...pageQSA('tbody tr')].filter(r => r.offsetParent && r.querySelector('input'));
    if (!cartRows.length) { reply('error', null, 'POS cart is empty — cannot complete sale.'); return; }

    if (data.flatDiscount && Number(data.flatDiscount) > 0) {
        const flatEl = [...pageQSA('.pos-footer input,.bill-footer input,input')]
            .find(i => (i.closest('td,div')?.previousElementSibling?.innerText||i.placeholder||'').toLowerCase().includes('flat'));
        if (flatEl) { setVal(flatEl, String(data.flatDiscount)); await sleep(200); }
    }

    const mode = (data.paymentMode || 'cash').toLowerCase();
    const allBtns = [...pageQSA('button')];
    const findPayBtn = re => allBtns.find(b => re.test((b.innerText||'').replace(/\s+/g,' ')));
    let payBtn = mode === 'upi'  ? findPayBtn(/upi\s*\(f5\)/i)
               : mode === 'card' ? findPayBtn(/card\s*\(f3\)/i)
               :                   findPayBtn(/cash\s*\(f4\)/i);
    if (!payBtn) payBtn = allBtns.find(b => new RegExp(mode, 'i').test(b.innerText||'') && b.offsetParent);
    if (!payBtn) { reply('error', null, 'Payment button not found. Ensure POS page is active and cart is not empty.'); return; }

    payBtn.click();
    await sleep(700);
    const submitBtn = await waitForEl(() =>
        [...pageQSA('button')].find(b => (b.innerText||'').trim().toLowerCase() === 'submit' && b.offsetParent)
    , 2000);
    if (submitBtn) { submitBtn.click(); await settle(1200); }

    // A POS sale posts money and moves stock, so "Sale completed" must be earned:
    // a bill number is the page's own proof. Verified 06/09/2026: after payment POS
    // flashes a thermal receipt (/pos/htmlpdf/<id>) and RELOADS to an empty cart, so
    // anything read off the old page is gone. What survives is the hidden Last Bill
    // modal — #lastBillModalNo / #lastBillModalAmount.
    const billNoEl = await waitForEl(() => {
        const el = document.getElementById('lastBillModalNo')
                || pageQS('[class*="lastBill"],.last-bill-no');
        return el && (el.textContent || '').trim() ? el : null;
    }, 12000);
    const billNo = billNoEl ? billNoEl.textContent.replace(/\s+/g, ' ').trim() : '';
    const billAmt = (document.getElementById('lastBillModalAmount') || {}).textContent;
    const err = visibleErrorText();
    if (err) { reply('error', null, `The sale didn't go through — VasyERP said: <b>${err}</b>`); return; }
    if (billNo) {
        reply('success', 'POS Sale Created',
            `Bill No: <b>${billNo}</b>` + (billAmt ? ` — <b>₹${String(billAmt).trim()}</b>` : ''));
        return;
    }
    reply('info', null,
        `I sent the payment (${mode}), but no bill number appeared, so I can't confirm the sale posted.` +
        `<br><small>Check the POS screen — if the bill printed, it went through.</small>`);
}

// Handle user's batch selection reply — resumes a paused POS sale
async function handleSelectBatch(data) {
    const pending = window.__vasyBatchPending;
    if (!pending) {
        reply('info', null, 'No pending batch selection. Please start the POS sale again.');
        return;
    }

    const count = (pending.choices && pending.choices.items || []).length;
    const raw = String(data.batchChoice || data.choice || '1').trim();
    const choice = parseInt(raw) - 1;
    if (isNaN(choice) || choice < 0 || choice >= count) {
        reply('error', null, `Invalid batch number. Please choose 1–${count}.`);
        return;
    }

    await _applyBatchChoice(pending.choices, choice);

    const modal = pending.modal;
    const confirmBtn = [...modal.querySelectorAll('button')].find(b =>
        b.offsetParent && /^(save|select|ok|confirm|apply|add|done|submit|proceed)$/i.test((b.innerText||'').trim())
    ) || modal.querySelector('.btn-primary, .btn-success');
    if (confirmBtn) { confirmBtn.click(); await sleep(300); }
    await waitForEl(() => !_findBatchModal(), 4000);
    await sleep(500);

    // Set qty/discount on the new cart row
    const cartRows = [...pageQSA('tbody tr')].filter(r => r.offsetParent && r.querySelector('input'));
    const newRow = cartRows[cartRows.length - 1];
    if (newRow) {
        const inputs = [...newRow.querySelectorAll('input[type="text"],input[type="number"],input:not([type])')].filter(i => i.offsetParent);
        if (pending.currentQty && Number(pending.currentQty) !== 1 && inputs[0]) { setVal(inputs[0], String(pending.currentQty)); await sleep(200); }
        if (pending.currentDiscount && Number(pending.currentDiscount) > 0 && inputs[2]) { setVal(inputs[2], String(pending.currentDiscount)); await sleep(200); }
    }

    // Process any remaining items that were queued after the batch-pending item
    for (const item of (pending.remainingItems || [])) {
        if (!item.name && !item.productName) continue;
        const added = await _addPOSItem(item.name || item.productName, item.qty || 1, item.discount || 0);
        if (added === 'asked') return;          // a "which one?" is already on screen
        if (added === 'batch_pending') {
            // Another multi-batch item — chain the pending data
            window.__vasyBatchPending.remainingItems = (pending.remainingItems || []).slice(1);
            window.__vasyBatchPending.posData = pending.posData;
            return;
        }
        if (!added) { reply('error', null, `Product "<b>${item.name||item.productName}</b>" not found.`); return; }
    }

    delete window.__vasyBatchPending;
    await _completePOSSale(pending.posData || {});
}

async function createPOSSale(data) {
    await settle(1000);

    // ── PRE-FLIGHT 0: is the till even open? ─────────────────────────────────
    // The POS terminal will not reveal itself until a sales register (the
    // cashier's shift) is open: the page sits behind its preloader with
    // .wrapper still m--hide, no error, no console output, no failed request. An
    // agent that starts typing into it just waits forever, and the user is told
    // nothing at all. Whether the register is open, and whether THIS role may
    // open one, are both decided by the ERP and mirrored onto the DOM for us.
    const posLoading = !!pageQS('.wrapper.m--hide') ||
                       !!(pageQS('.preloader') || {}).offsetParent;
    const regOpen = erpFlag('vasyPosRegisterOpen');
    if (regOpen !== null && !erpFlagTrue('vasyPosRegisterOpen')) {
        const mayOpen = erpFlagTrue('vasyPosRegisterPerm');
        reply('info', 'The till is closed',
            `POS can't take a sale because <b>no sales register is open</b> for this outlet, so the ` +
            `terminal never finishes loading. <b>Nothing was sold.</b><br>` +
            (mayOpen
                ? `<small>Open the register first (Sales Register → open / start shift), then say ` +
                  `<i>"sell ${data.itemName || '<product>'} ${data.qty || 1} ${(data.paymentMode || 'cash').toLowerCase()}"</i> again.</small>`
                : `<small>Your role also can't open one — VasyERP reports no sales-register permission for this ` +
                  `login. Ask a cashier or manager to open the till, then try again.</small>`));
        return;
    }
    if (posLoading) {
        // Flags absent (helper blocked?) but the terminal is plainly still stuck.
        await waitForEl(() => pageQS('.wrapper:not(.m--hide)') ? true : null, 12000);
        if (pageQS('.wrapper.m--hide')) {
            reply('error', null,
                `The POS terminal is still on its loading screen, so there is nothing to bill into. ` +
                `<b>Nothing was sold.</b><br><small>That usually means the sales register for this outlet ` +
                `isn't open yet.</small>`);
            return;
        }
    }

    // ── PRE-FLIGHT 3: "Pay Later" needs a customer ────────────────────────────
    // POS setting "Customer details mandatory" and the Pay Later tender itself
    // both require a named customer — a walk-in credit sale can't be settled
    // later. Catch it before we add items, not after the save is rejected.
    const payMode = String(data.paymentMode || '');
    const isPayLater = /pay\s*later|credit\b|udhaar|udhar/i.test(payMode);
    if (isPayLater && !data.customerName) {
        reply('error', null,
            `<b>Pay Later</b> is a credit sale, so VasyERP needs a named customer — a Walk-in can't be billed later.<br>` +
            `<small>Tell me who it's for, e.g. <i>"sell to Ramesh Yadav shinchan mouse pad blue 2 pay later"</i>. ` +
            `Note: if <b>OTP verification on pay later</b> is on, the customer will also have to confirm an OTP on screen.</small>`);
        return;
    }
    if (!isPayLater && !data.customerName) {
        // "Customer details mandatory" may be on for this outlet — detect a
        // required customer field rather than assuming Walk-in will be accepted.
        const custReq = [...pageQSA('input,select')].some(el =>
            el.offsetParent && el.required && /customer|mobile/i.test(labelNear(el) + ' ' + (el.placeholder || '')));
        if (custReq) {
            reply('error', null,
                `This register has <b>Customer details mandatory</b> switched on, so I need a customer name before billing.<br>` +
                `<small>e.g. <i>"sell to Ramesh Yadav …"</i> — or turn it off with <i>"disable customer details mandatory"</i>.</small>`);
            return;
        }
    }

    if (data.customerName && !/^walk[\s-]*in(\s+customer)?$/i.test(String(data.customerName).trim())) {
        const custSel = [...pageQSA('select')].find(el => {
            const aj = window.jQuery?.(el).data('select2')?.options?.options?.ajax;
            return aj && (aj.url||'').includes('contact');
        });
        const ok = await fillSelect2(custSel?.id || 'contactVo', data.customerName);
        // A named customer is never quietly swapped for Walk-in — the bill would
        // miss their ledger and loyalty. And 'asked' is a question on screen, not a yes.
        if (ok === 'asked') return;
        if (!ok) { await partyNotFound(data.customerName, 'customer'); return; }
    }

    // A discount is never dropped: this would otherwise sell at full price. The
    // ERP mirrors the role's POS discount permission onto the page.
    if (data.discount) {
        const allowed = erpFlag('vasyPosDiscountPerm') === null || erpFlagTrue('vasyPosDiscountPerm');
        reply('info', 'Discount not applied',
            (allowed ? `I don't apply POS discounts myself yet, so I haven't sold anything.`
                     : `Your VasyERP role isn't allowed to give discounts at the POS, so I haven't sold anything.`) +
            `<br><small>Ring it up on the till with the discount, or send the sale without it (or with the final price).</small>`);
        return;
    }
    const items = Array.isArray(data.items)
        ? data.items
        : [{ name: data.itemName || data.productName, qty: data.qty || 1, discount: 0 }];

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.name && !item.productName) continue;
        try { document.documentElement.dataset.vasyAgentStep = 'pos:item:' + String(item.name || item.productName).slice(0, 50) + '@' + Date.now(); } catch (e) {}
        const added = await _addPOSItem(item.name || item.productName, item.qty || 1, item.discount || 0);
        try { document.documentElement.dataset.vasyAgentStep = 'pos:added:' + added + '@' + Date.now(); } catch (e) {}
        if (added === 'asked') return;          // a "which one?" is already on screen
        if (added === 'batch_pending') {
            // User must select a batch — store remaining items and posData for resumption
            window.__vasyBatchPending.remainingItems = items.slice(i + 1);
            window.__vasyBatchPending.posData = data;
            return;
        }
        if (!added) {
            // "sell 2 notebook1 to Ramesh cash": the whole phrase isn't a product,
            // so try "<item> to <customer>" — the catalogue already said no to the
            // phrase, so a real "ready to eat noodles" never gets here.
            const sp = !data.customerName && items.length === 1 &&
                       String(item.name || item.productName).match(/^(.+?)\s+to\s+([A-Za-z][A-Za-z .']{1,40})$/i);
            if (sp) {
                const custSel = [...pageQSA('select')].find(el => {
                    const aj = window.jQuery?.(el).data('select2')?.options?.options?.ajax;
                    return aj && (aj.url || '').includes('contact');
                });
                const c = await fillSelect2(custSel?.id || 'contactVo', sp[2].trim());
                if (c === 'asked') return;
                if (!c) { await partyNotFound(sp[2].trim(), 'customer'); return; }
                const again = await _addPOSItem(sp[1].trim(), item.qty || 1, item.discount || 0);
                if (again === 'asked') return;
                if (again === 'batch_pending') { window.__vasyBatchPending.remainingItems = []; window.__vasyBatchPending.posData = data; return; }
                if (again) continue;
            }
            reply('error', null, `Product "<b>${item.name||item.productName}</b>" not found or out of stock.`); return;
        }
    }

    await _completePOSSale(data);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRM / BRANCH / CATEGORY / BRAND HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

async function createCoupon(data) {
    setVal(document.getElementById('couponName'), data.couponName || data.name);
    if (data.couponPrice || data.price) setVal(document.getElementById('couponPrice'), data.couponPrice || data.price);

    const typeMap = {
        'amount':'redeemamount','redeemamount':'redeemamount',
        'percentage':'redeempercentage','percent':'redeempercentage','redeempercentage':'redeempercentage',
        'entirebill':'entirebill','entire':'entirebill','bill':'entirebill'
    };
    const radioId = typeMap[(data.couponType||'').toLowerCase()] || 'redeemamount';
    const typeRadio = document.getElementById(radioId);
    if (typeRadio) { typeRadio.click(); await sleep(300); }

    // Redeem value — fill whichever field the chosen type reveals (ID or label-based)
    const redeemVal = data.redeemAmount || data.redeemPercentage || data.price;
    if (redeemVal) {
        const byLabel = (re) => [...pageQSA('input')].filter(i => i.offsetParent).find(i => {
            const grp = i.closest('div');
            const lbl = grp?.querySelector('label') || grp?.parentElement?.querySelector('label');
            return lbl && re.test(lbl.innerText || '');
        });
        const redeemEl = document.getElementById('redeemAmount')
                      || document.getElementById('redeemPercentage')
                      || byLabel(/redeem\s*(amount|percentage|value)/i);
        if (redeemEl && redeemEl.offsetParent) setVal(redeemEl, redeemVal);
    }

    if (data.startDate) {
        document.getElementById('couponStartDateYes')?.click();
        await sleep(150);
        setVal(document.getElementById('startDate'), data.startDate);
    }
    if (data.endDate) {
        document.getElementById('couponEndDateYes')?.click();
        await sleep(150);
        setVal(document.getElementById('endDate'), data.endDate);
    }
    if (data.expiryDays) {
        document.getElementById('expiryDaysYes')?.click();
        await sleep(150);
        setVal(document.getElementById('numberOfExpiryDays'), data.expiryDays);
    }

    watchResult('Coupon Created', ['/coupon']);
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on Coupon form.');
}

async function createMembership(data) {
    const newBtn = [...pageQSA('a,button')].find(e => e.offsetParent && /new\s*member/i.test(e.innerText));
    if (!newBtn) { reply('error', null, 'New Membership button not found. Navigate to the Membership page first.'); return; }
    newBtn.click();
    await sleep(600);

    // React modal uses placeholders, legacy uses IDs — support both
    const byPh = re => [...pageQSA('input')].find(i => i.offsetParent && re.test(i.placeholder || ''));
    setVal(document.getElementById('paymentTermName')   || byPh(/membership\s*name/i),   data.membershipName || data.name);
    if (data.membershipDays || data.days)
        setVal(document.getElementById('paymentTermDay')    || byPh(/membership\s*day/i),    data.membershipDays || data.days);
    if (data.membershipAmount || data.amount || data.price)
        setVal(document.getElementById('paymentTermamount') || byPh(/membership\s*amount/i), data.membershipAmount || data.amount || data.price);

    // Watch for toast (modal save doesn't change URL)
    watchResult('Membership Created', ['/membershipmaster']);
    const modalSave = [...pageQSA('.modal button,.modal-footer button')]
        .find(b => b.offsetParent && /save|submit|add|create/i.test(b.innerText||b.value||''));
    if (modalSave) modalSave.click();
    else if (!clickSaveBtn()) reply('error', null, 'Membership save button not found.');
}

async function createDiscount(data) {
    setVal(document.getElementById('title'), data.title || data.discountCode || data.name);

    const appId = (data.discountApplicable||'').toLowerCase().includes('product') ? 'productwise' : 'entirebill';
    document.getElementById(appId)?.click();
    await sleep(200);

    if (data.discountType) setSelect2Text('discount_type', data.discountType);
    if (data.discount || data.value || data.discountValue) {
        const discEl = pageQS('input[name="discount"]');
        if (discEl) setVal(discEl, data.discount || data.value || data.discountValue);
    }
    if (data.startDate || data.startsDate) setVal(document.getElementById('startsDate'), data.startDate || data.startsDate);
    if (data.endDate || data.endsDate) {
        const endCheck = document.getElementById('set_end_date');
        if (endCheck && !endCheck.checked) { endCheck.click(); await sleep(200); }
        setVal(document.getElementById('endsDate'), data.endDate || data.endsDate);
    }

    watchResult('Discount Created', ['/discount']);
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on Discount form.');
}

async function createBranch(data) {
    await settle(1200);
    // Recon (expo "New Outlet"): mandatory = Outlet Type*, Name*, Display Name*,
    // Mobile No.*, User Name*, Password*, Year Interval*, GST Type*, Address*,
    // Country*/State*/City*/Timezone*. Country/State/City/Timezone/Year/GST come
    // pre-defaulted, so we only fill what the user gave + the always-required ones.
    const nm = data.branchName || data.name;
    if (data.outletType) setSelect2Text('outlettype', data.outletType);
    if (!setVal(document.getElementById('name'), nm)) smartSet(nm, { label:/^name/i });
    // Display Name* is mandatory — mirror the name when not supplied
    if (!setVal(document.getElementById('displayName'), data.displayName || nm))
        smartSet(data.displayName || nm, { label:/display\s*name/i });
    if (data.mobile || data.phone) {
        if (!setVal(document.getElementById('mobNo'), data.mobile || data.phone))
            smartSet(data.mobile || data.phone, { label:/mobile\s*no/i });
    }
    // User Name* + Password* are mandatory (this outlet's login)
    const uname = data.userName || data.username;
    if (uname && !setVal(document.getElementById('userName'), uname)) smartSet(uname, { label:/user\s*name/i });
    const pwd = data.password;
    if (pwd) {
        const pEl = document.getElementById('password') || [...pageQSA('input[type="password"]')].find(i => i.offsetParent);
        if (pEl) setVal(pEl, pwd);
    }
    if (data.gstin) setVal(document.getElementById('gstin'), data.gstin);
    if (data.address && !setVal(document.getElementById('address'), data.address))
        smartSet(data.address, { label:/^address/i });
    if (data.state) setSelect2Text('stateCode', data.state);
    if (data.city) setSelect2Text('cityCode', data.city);
    // Integrity: never save an outlet without its mandatory login
    if (!uname || !pwd) {
        reply('info', 'Outlet Form Filled',
            `I filled in what you gave me for <b>${nm}</b>, but a new outlet also needs a <b>User Name</b> and <b>Password</b> (its login) plus Year Interval / GST Type. ` +
            `Add those and press Save — I didn't save a half-filled outlet.<br><small>Next time, say it in one go: "create branch ${nm} username ${nm.toLowerCase().replace(/\s+/g,'')} password &lt;your password&gt;".</small>`);
        return;
    }
    watchResult('Branch Created', ['/branch']);
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on Branch form.');
}

async function createCategory(data) {
    // Everything here is scoped to the dialog and verified after it is set.
    // The previous version reached in by bare id, assumed a 600 ms fade was long
    // enough, and reported a 45-second timeout when in fact nothing had been
    // typed at all — so the failure looked like a slow network instead of a form
    // that was never filled.
    const MODAL = 'category_new_model';
    const opener = [...pageQSA(`[data-target="#${MODAL}"],[data-bs-target="#${MODAL}"]`)]
        .find(e => e.getClientRects().length > 0);
    if (!opener) { reply('error', null, 'The "Create New" category button is not on this page — open Settings › Category/Brand first.'); return; }
    opener.click();
    const modal = await waitForModal(MODAL);
    if (!modal || !modal.getClientRects().length) {
        reply('error', null, 'The new-category dialog did not open.'); return;
    }

    const catName = (data.categoryName || data.name || '').trim();
    if (!catName) { reply('error', null, 'What should the category be called?'); return; }

    // Department* is mandatory — VasyERP silently refuses to save without it.
    const deptSel = modal.querySelector('#departmentId, select[name*="department" i]');
    if (deptSel) {
        const opts = [...deptSel.options].filter(o => o.value);
        const want = (data.department || data.departmentName || '').trim();
        let chosen = null;
        if (want) {
            const nw = vasyNorm(want);
            chosen = opts.find(o => vasyNorm(o.text) === nw)
                  || opts.find(o => vasyNorm(o.text).startsWith(nw))
                  || vasyBest(want, opts, o => o.text, 0.6);
        }
        if (!chosen && opts.length === 1) chosen = opts[0];
        if (!chosen) {
            reply('info', null,
                `A category needs a <b>Department</b> — VasyERP will not save one without it` +
                (want ? `, and nothing here matches "<b>${want}</b>"` : '') + `.<br>` +
                `Say <i>"create category ${catName} in department ${(opts[0] && opts[0].text.trim()) || 'X'}"</i>.<br>` +
                `<small>Departments: ${opts.slice(0, 8).map(o => o.text.trim()).join(', ')}` +
                `${opts.length > 8 ? ` … (${opts.length} total)` : ''}</small>`);
            return;
        }
        for (let i = 0; i < 4 && deptSel.value !== chosen.value; i++) {
            deptSel.value = chosen.value;
            deptSel.dispatchEvent(new Event('change', { bubbles: true }));
            if (window.jQuery) { try { window.jQuery(deptSel).trigger('change'); } catch (e) {} }
            await sleep(180);
        }
    }

    const nameEl = modal.querySelector('#categoryName, input[name*="categoryname" i]');
    if (!nameEl) { reply('error', null, 'The category name field is missing from the dialog.'); return; }
    await setValFirm(nameEl, catName);
    const codeEl = modal.querySelector('#categoryCode');
    if (data.categoryCode && codeEl) await setValFirm(codeEl, data.categoryCode);
    if (data.parentCategory) setSelect2Text('maincategory', data.parentCategory);

    // Verify before saving: an empty field here is the whole bug we are fixing.
    await sleep(150);
    if (!nameEl.value) { reply('error', null, `Couldn't type the category name into the dialog.`); return; }
    if (deptSel && !deptSel.value) { reply('error', null, `Couldn't select the department in the dialog.`); return; }

    watchResult('Category Created', [], `Filed under ${deptSel ? (deptSel.selectedOptions[0] || {}).text || '' : ''}`.trim());
    if (!clickModalSave(modal)) reply('error', null, 'The Save button in the category dialog was not found.');
}

async function createBrand(data) {
    const btn = pageQS('[data-target="#m_modal_6"],[data-bs-target="#m_modal_6"]');
    if (!btn) { reply('error', null, 'Brand button not found. Navigate to Category/Brand page first.'); return; }
    btn.click();
    await waitForModal('m_modal_6');

    await setValFirm(document.getElementById('brandname'), data.brandName || data.name);
    if (data.brandCode) await setValFirm(document.getElementById('brandcode'), data.brandCode);
    if (data.parentBrand) setSelect2Text('mainbrand', data.parentBrand);

    watchResult('Brand Created', ['/categorybrand']);
    if (!clickModalSave(document.getElementById('m_modal_6')) && !clickSaveBtn())
        reply('error', null, 'Brand save button not found.');
}

// ── Opening Stock ─────────────────────────────────────────────────────────────
// ── Stock IN / OUT ──────────────────────────────────────────────────────────
// v9.13.0 has ONE screen for opening stock and for adjustments: /product/
// opening-stock → pick the product → "Stock IN/OUT" dialog (#addProductModal):
// IN/OUT switch (a bootstrap-switch checkbox, checked = IN), batch, Purchase
// Price, MRP, In Qty, Out Qty, Add (#save_openingstock). Its entries are what the
// Stock Adjustment Report lists as type "stockadjustment".
async function stockInOut(data, dir) {
    await settle(1500);
    const item = data.productName || data.itemName;
    const qty = parseFloat(data.qty);
    if (!item) { reply('error', null, 'Which product?'); return; }
    if (!isFinite(qty) || qty <= 0) { reply('info', null, `How many units of <b>${item}</b>?`); return; }
    // Patience: the first search on a cold page often answers "no" (measured:
    // the same product failed once after 48s, then was found in 15s).
    let st = await searchAndSelectItem(item, { inputId: 'productId' });
    for (const gap of [3000, 6000]) {
        if (st !== false) break;
        await sleep(gap);
        st = await searchAndSelectItem(item, { inputId: 'productId' });
    }
    if (st === 'asked') return;
    if (st !== 'found' && st !== 'norow') {
        reply('error', null, `<b>${item}</b> isn't in the catalogue. <b>Nothing was changed.</b>`); return;
    }
    const modal = await waitForEl(() => { const m = document.getElementById('addProductModal'); return m && m.getClientRects().length ? m : null; }, 9000);
    if (!modal) { reply('error', null, `I picked <b>${item}</b>, but VasyERP's Stock IN/OUT dialog didn't open. <b>Nothing was changed.</b>`); return; }
    await sleep(700);
    // direction
    const sw = modal.querySelector('#typeswitch') || modal.querySelector('input[name="types"]');
    const wantIn = dir !== 'OUT';
    if (sw && sw.checked !== wantIn) {
        (modal.querySelector('.bootstrap-switch-label') || sw.closest('.bootstrap-switch') || sw).click();
        await sleep(400);
        if (sw.checked !== wantIn) { sw.checked = wantIn; sw.dispatchEvent(new Event('change', { bubbles: true })); await sleep(300); }
    }
    if (sw && sw.checked !== wantIn) {
        reply('error', null, `I couldn't switch the dialog to <b>${wantIn ? 'IN' : 'OUT'}</b>. <b>Nothing was changed.</b>`); return;
    }
    const qEl = modal.querySelector(wantIn ? '#modalInQty0' : '#modalQty0');
    if (!qEl) { reply('error', null, `The ${wantIn ? 'In' : 'Out'} Qty box is missing from the dialog. <b>Nothing was changed.</b>`); return; }
    setVal(qEl, String(qty));
    if (data.purchasePrice || (wantIn && data.price)) setVal(modal.querySelector('#modalPrice0'), data.purchasePrice || data.price);
    if (data.mrp) setVal(modal.querySelector('#modalMRP0'), data.mrp);
    await sleep(300);
    if (parseFloat(qEl.value) !== qty) { reply('error', null, `The quantity didn't stick in the dialog. <b>Nothing was changed.</b>`); return; }
    const batch = modal.querySelector('#batchId0');
    const bTxt = batch && batch.selectedIndex >= 0 ? (batch.options[batch.selectedIndex].text || '').trim() : '';
    watchResult(wantIn ? 'Stock Added' : 'Stock Removed', [],
        `${wantIn ? 'Added' : 'Removed'} <b>${qty}</b> × <b>${item}</b>${bTxt ? ` (batch ${bTxt.slice(0, 50)})` : ''}.`);
    if (!clickSaveBtn(modal, { note: `This ${wantIn ? 'adds' : 'removes'} ${qty} × ${item} ${wantIn ? 'to' : 'from'} stock on hand${bTxt ? ` — batch ${bTxt.slice(0, 50)}` : ''}, so I never save it without your OK.` }))
        reply('error', null, 'The Add button was not found in the Stock IN/OUT dialog.');
}

async function createOpeningStock(data) {
    if (/\/product\/opening-stock/.test(location.pathname)) return stockInOut(data, 'IN');
    await sleep(800);
    if (data.productName) {
        const inp = pageQS('input[placeholder*="Product" i],input[placeholder*="barcode" i],input[id*="product" i]');
        if (inp) {
            setVal(inp, data.productName);
            ['input','keyup'].forEach(ev => inp.dispatchEvent(new Event(ev, {bubbles:true})));
            const opts = await waitForSuggestions(4000);
            if (opts.length) {
                const match = opts.find(o => o.innerText.toLowerCase().includes(data.productName.toLowerCase())) || opts[0];
                match.click();
                await sleep(600);
            }
        }
    }
    const row = getLastItemRow();
    if (row.qty && data.qty) setVal(row.qty, data.qty);
    if (data.price || data.purchasePrice) {
        const pEl = pageQS('input[id^="price"]:not([id*="{"]),input[id^="purchasePrice"]:not([id*="{"])');
        if (pEl) setVal(pEl, data.price || data.purchasePrice);
    }
    if (data.mrp) {
        const mEl = pageQS('input[id^="mrp"]:not([id*="{"])');
        if (mEl) setVal(mEl, data.mrp);
    }
    if (data.batchDate) {
        const bdEl = pageQS('input[id*="batch" i][id*="date" i],input[placeholder*="batch date" i]');
        if (bdEl) setVal(bdEl, data.batchDate);
    }
    if (data.expiryDate) {
        const exEl = pageQS('input[id*="expiry" i],input[placeholder*="expiry" i]');
        if (exEl) setVal(exEl, data.expiryDate);
    }
    watchResult('Opening Stock Saved', ['/product/setup-opening-stock']);
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on Opening Stock form.');
}

// ── POS return: look a bill up before returning it (READ ONLY) ────────────────
// Recon 06/09/2026. The POS return flow is NOT the scan box alone:
//   lookup  POST /pos/barcodedetailsforposReturn  with **salesNo=<bill no>**
//           → [{ itemDataDTOs:[{name, varient_name, qty, return_qty, selling_price,
//                batch_no, totalAvailableQty…}], returnSalesDataDTO:{order_no,
//                total, paid_amount, channelType, receiptPaymentType} }]
//   page fns getProductInfoBySalesReturnBillNo() → fetchDataAndProcess(URL, barcode)
//           → SetProductInfoBySalesReturnBillNo(...) fills the cart
//   commit  #returnbtn → saveSalesReturn()   |  refund #refundbtn → setRefundModal()
//   credits getProductInfoByCreditnote() / applyCreditModel() / checkCreditnote()
// The lookup is rate-limited server-side ({rateLimit:true}), and if the cart is
// not empty the ERP first asks to DISCARD it ("You won't be able to revert this!").
// Filling and committing the return is deliberately left to the cashier; we read.
async function posReturnLookup(data) {
    const bill = (data.billNumber || data.invoiceNumber || '').trim();
    if (!bill) { reply('error', null, 'Which POS bill number should I look up?'); return; }
    const tok  = pageQS('meta[name="_csrf"]')?.content || '';
    const hdrN = pageQS('meta[name="_csrf_header"]')?.content || 'X-CSRF-TOKEN';
    let rows = null;
    try {
        const res = await fetch('/pos/barcodedetailsforposReturn', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded',
                       'X-Requested-With': 'XMLHttpRequest', ...(tok ? { [hdrN]: tok } : {}) },
            body: 'salesNo=' + encodeURIComponent(bill) + (tok ? '&_csrf=' + encodeURIComponent(tok) : '')
        });
        rows = await res.json();
    } catch (e) { rows = null; }
    if (!Array.isArray(rows) || !rows.length) {
        reply('error', null, `I couldn't find a POS bill <b>${bill}</b> to return. <small>Check the bill number on the receipt.</small>`);
        return;
    }
    if (rows[0] && rows[0].rateLimit) {
        reply('info', null, `VasyERP is rate-limiting return look-ups right now. <small>Try again in a minute.</small>`);
        return;
    }
    const head  = rows[0].returnSalesDataDTO || {};
    const items = rows[0].itemDataDTOs || [];
    const line  = it => `&nbsp;• ${it.name || it.displayName}${it.varient_name ? ' ' + it.varient_name : ''} — ` +
        `qty <b>${it.qty}</b>${Number(it.return_qty) ? ` <small>(${it.return_qty} already returned)</small>` : ''} @ ₹${it.selling_price}`;
    reply('success', `Bill ${head.order_no || bill}`,
        `${head.channelType || 'POS'} bill, paid <b>₹${head.paid_amount}</b> by ${head.receiptPaymentType || '—'} on ${head.sales_date || ''}.<br>` +
        items.slice(0, 8).map(line).join('<br>') +
        `<br><small>To return it: put the bill in <b>Scan Sales Invoice</b> on the POS screen, adjust the quantities, then press <b>Sales Return</b> ` +
        `(or <b>Refund</b> to give the money back). I don't post returns myself — the counted quantity is the cashier's call.</small>`);
}

// ── Logs (/logs) — READ ONLY ──────────────────────────────────────────────────
// Recon 06/09/2026: five tabs — SMS Log · User Activity Log · System Activity Log
// · Loyalty Log · Settings Logs — plus a date range, Filter and Export. This is
// the audit trail, so the agent only ever READS it; nothing here gets cleared or
// masked. "Settings Logs" is the trail for switch changes we ourselves can make.
const LOG_TABS = [
    [/setting|switch|config/i,                    'Settings Logs'],
    [/user\s*activity|who\s+(logged|did)|login|staff/i, 'User Activity Log'],
    [/system|error|background/i,                  'System Activity Log'],
    [/loyalty|points?/i,                          'Loyalty Log'],
    [/sms|message|text/i,                         'SMS Log'],
];
async function openLogs(data) {
    await settle(1500);
    const want = (LOG_TABS.find(([re]) => re.test(data.logType || data.question || '')) || [])[1] || null;
    if (want) {
        const tab = await waitForEl(() => [...pageQSA('[role=tab],button,a')]
            .find(e => e.offsetParent && new RegExp(`^${want}$`, 'i').test((e.innerText || '').trim())), 8000);
        if (tab) { tab.click(); await settle(2600); }
    }
    const tbl = await waitForEl(() => [...pageQSA('table')].find(t => t.offsetParent && t.querySelector('tbody tr')), 8000);
    if (!tbl) { reply('info', null, `Logs are open${want ? ` on <b>${want}</b>` : ''}, but nothing has loaded yet.`); return; }
    const heads = [...tbl.querySelectorAll('thead th')].map(t => t.innerText.replace(/\s+/g, ' ').trim());
    const rows  = [...tbl.querySelectorAll('tbody tr')].slice(0, 8)
        .map(tr => [...tr.querySelectorAll('td')].map(td => td.innerText.replace(/\s+/g, ' ').trim()));
    if (!rows.length || /no records/i.test(rows[0][0] || '')) {
        reply('info', null, `<b>${want || 'Logs'}</b> has no entries for the selected date range. ` +
            `<small>Widen the range with the date picker at the top.</small>`);
        return;
    }
    // Drop the row-number column so the answer reads cleanly.
    const skip = /^#$/.test(heads[0] || '') ? 1 : 0;
    const body = rows.map(c => '&nbsp;• ' + c.slice(skip, skip + 4).filter(Boolean).join(' — ')).join('<br>');
    reply('success', want || 'Logs',
        `${rows.length === 8 ? 'Latest 8' : `${rows.length}`} entr${rows.length === 1 ? 'y' : 'ies'}` +
        `${heads.length ? ` <small>(${heads.slice(skip, skip + 4).join(' · ')})</small>` : ''}:<br>${body}`);
}

// ── Tally export (/tally) ─────────────────────────────────────────────────────
// Recon 06/09/2026: a Tally-version picker plus 14 "Download XML" buttons, each
// beside its dataset name — Masters (Account Groups, Ledgers, Units, Stock Items)
// and Transactions (Sales, Purchase, Credit/Debit Note, Payment, Receipt,
// Material Creation, Journal Voucher, Expense, Stock Journal).
async function exportToTally(data) {
    await settle(1600);
    const btns = await waitForEl(() => {
        const b = [...pageQSA('button,a')].filter(x => x.offsetParent && /download\s*xml/i.test(x.innerText || ''));
        return b.length ? b : null;
    }, 9000);
    if (!btns) { reply('error', null, 'The Tally page didn\'t load its export list — your role may not have Tally access.'); return; }

    const labelOfRow = (b) => { let n = b, hops = 0;
        while (n && hops++ < 5) { n = n.parentElement; if (!n) break;
            const t = String(n.innerText || '').replace(/\s+/g, ' ').replace(/download xml/ig, '').trim();
            if (t && t.length < 40) return t; }
        return ''; };
    const rows = btns.map(b => ({ b, label: labelOfRow(b) }));

    if (!data.dataset) {
        reply('info', null,
            `Tally export is ready — which data set?<br><small>${rows.map(r => r.label).filter(Boolean).join(' · ')}</small>`);
        return;
    }
    const hit = vasyBest(data.dataset, rows, r => r.label, 0.5);
    if (!hit) {
        reply('error', null,
            `"<b>${data.dataset}</b>" isn't one of the Tally exports. Available: ` +
            `<small>${rows.map(r => r.label).filter(Boolean).join(' · ')}</small>`);
        return;
    }
    // Masters must land in Tally before transactions will import cleanly.
    const isTxn = /sales|purchase|note|payment|receipt|voucher|expense|journal|material/i.test(hit.item.label);
    hit.item.b.click();
    await settle(1200);
    reply('success', 'Tally Export Started',
        `Downloading <b>${hit.item.label}</b> as Tally XML.` +
        (isTxn ? `<br><small>Import your masters (Account Groups, Ledgers, Units, Stock Items) into Tally first, or the vouchers won't map.</small>` : '') +
        `<br><small>If nothing downloads, check the Tally version selector on the page and your browser's download permission.</small>`);
}

// ── Barcode / Label printing (/barcodeutility) ────────────────────────────────
// Recon 06/09/2026. Mandatory: GENERATE BARCODE FROM*, PRINT TYPE*, DATE FORMAT*,
// CHOOSE TEMPLATE*. Source options: Product | Purchase | Stock Transfer |
// Material Creation | Bill Of Materials. Print types: 1/2/3/4/6 UPS, A4, A5.
// The product goes in via #searchBarcodeInput; a live preview counts queued labels.
async function printBarcodes(data) {
    await settle(1500);
    const scan = await waitForEl('#searchBarcodeInput', 8000);
    if (!scan) { reply('error', null, 'The Barcode / Labels page didn\'t finish loading (no scan box found).'); return; }

    // Source list — defaults to Product, which is what "print barcodes for X" means.
    const src = await fillReactSelect(/generate\s*barcode\s*from/i, data.source || 'Product', 2500, 'the barcode source');
    if (src === 'asked') return;

    if (data.itemName) {
        const added = await searchAndSelectItem(data.itemName, { inputId: 'searchBarcodeInput', qty: data.qty });
        if (!added || added === 'add_product') {
            reply('error', null, `I couldn't find "<b>${data.itemName}</b>" to queue labels for. Check the product name.`);
            return;
        }
        await sleep(900);
    }

    if (data.printType) {
        const ok = await fillReactSelect(/print\s*type/i, data.printType, 2500, 'the print type');
        if (ok === 'asked') return;
        if (!ok) { reply('error', null,
            `Print type "<b>${data.printType}</b>" isn't offered. This page has <b>1 UPS, 2 UPS, 3 UPS, 4 UPS, 6 UPS, A4, A5</b>.`); return; }
    }
    if (data.template) {
        const ok = await fillReactSelect(/choose\s*template/i, data.template, 2500, 'the label template');
        if (ok === 'asked') return;
    }

    // Print type and template are mandatory and tenant-specific — never guess a
    // label layout, that is paper and ink.
    const queued = (pageText().match(/(\d+)\s+labels?\s+ready/i) || [])[1];
    if (!data.printType || !data.template) {
        reply('info', null,
            `${data.itemName ? `Queued <b>${data.itemName}</b>` : 'The page is ready'}` +
            `${queued ? ` (<b>${queued}</b> label${queued==='1'?'':'s'} ready)` : ''}. ` +
            `I still need ${[!data.printType && '<b>print type</b> (1/2/3/4/6 UPS, A4, A5)', !data.template && '<b>template</b>'].filter(Boolean).join(' and ')} ` +
            `before printing — say e.g. <i>"print type A4"</i>.`);
        return;
    }
    const genBtn = [...pageQSA('button')].find(b =>
        b.offsetParent && /^generate\s*barcode$/i.test((b.innerText || '').trim()));
    if (!genBtn) { reply('error', null, 'The "Generate Barcode" button wasn\'t found.'); return; }
    watchResult('Barcodes Generated', [], `Labels sent to ${data.printType}${data.template ? ` / ${data.template}` : ''}.`);
    genBtn.click();
}

// ── Loyalty Points Adjust / Assign Membership ─────────────────────────────────
async function adjustLoyaltyPoints(data) {
    await sleep(600);

    // The Loyalty page is a Campaign list + a "Point Setup" tab holding the earn
    // rate (Amount* = Point*). There is NO per-customer points table, so the old
    // advice — "search the customer by mobile and click Adjust Points" — pointed
    // at controls that do not exist on this build.
    const openPointSetup = async () => {
        if (document.getElementById('earnPoint')) return true;
        const tab = [...pageQSA('[role=tab],button,a')].find(e =>
            e.offsetParent && /^point\s*setup$/i.test((e.innerText || '').trim()));
        if (!tab) return false;
        tab.click();
        return !!await waitForEl('#earnPoint', 5000);
    };

    if (data.action === 'earnrate') {
        if (!await openPointSetup()) {
            reply('error', null, 'I couldn\'t open the <b>Point Setup</b> tab on the Loyalty page.'); return;
        }
        const amtEl = document.getElementById('earnAmount'), ptEl = document.getElementById('earnPoint');
        if (!amtEl || !ptEl) { reply('error', null, 'The earn-rate fields weren\'t found on Point Setup.'); return; }
        if (data.earnAmount) setVal(amtEl, data.earnAmount);
        if (data.earnPoint)  setVal(ptEl,  data.earnPoint);
        await sleep(300);
        watchResult('Loyalty Earn Rate Updated', [],
            `Customers now earn <b>${ptEl.value}</b> point(s) per ₹<b>${amtEl.value}</b> spent.`);
        if (!clickSaveBtn()) reply('error', null, 'Save button not found on Point Setup.');
        return;
    }

    // Points are earned/redeemed through billing, not edited per customer here.
    if (data.action === 'check' || data.action === 'adjust' || data.points != null) {
        const rate = document.getElementById('earnPoint')
            ? ` (currently ${document.getElementById('earnPoint').value} point(s) per ₹${document.getElementById('earnAmount')?.value}).`
            : '.';
        reply('info', null,
            `This VasyERP build has no screen for editing one customer's points${rate}<br>` +
            `<small>Loyalty here is <b>Campaigns</b> + <b>Point Setup</b> (the earn rate). Points move when you bill: ` +
            `POS has <b>Redeem loyalty</b> on the payment row. I can change the rate — say ` +
            `<i>"set loyalty earn rate 10 points per ₹100"</i>.</small>`);
        return;
    }

    // Search customer by mobile number or name
    const searchInput = pageQS(
        'input[placeholder*="mobile" i], input[placeholder*="search" i]:not(#global_search_web), ' +
        'input[placeholder*="customer" i], #datatableCustomSearchInput'
    );
    const searchTerm = data.customerMobile || data.searchQuery || data.customerName || '';
    if (searchInput && searchTerm) {
        setVal(searchInput, searchTerm);
        ['input','keyup'].forEach(ev => searchInput.dispatchEvent(new Event(ev, {bubbles:true})));
        await settle(1800);
    }

    // Handle membership assignment
    if (data.action === 'assign' && data.membershipName) {
        const assignBtn = await waitForEl(() =>
            [...pageQSA('button,a')].find(b =>
                b.offsetParent && /assign.*member|member.*assign|membership/i.test(b.innerText || b.title || '')
            ), 3000
        );
        if (assignBtn) {
            assignBtn.click();
            const modal = await waitForEl('.modal.show,.modal[style*="display: block"]', 2000);
            if (modal) {
                await fillSelect2('membershipId', data.membershipName) || setSelect2Text('membershipId', data.membershipName);
                if (data.startDate) setVal(modal.querySelector('input[id*="date" i]'), data.startDate);
                const saveBtn = [...modal.querySelectorAll('button')].find(b => b.offsetParent && /save|assign|submit|ok/i.test(b.innerText || ''));
                if (saveBtn) {
                    watchResult('Membership Assigned', [], `Membership <b>${data.membershipName}</b> assigned.`);
                    saveBtn.click();
                    return;
                }
            }
        }
        // Don't send people to controls this build doesn't have — verified 06/09/2026
        // that /loyalty is Campaigns + Point Setup, with no customer rows at all.
        reply('info', null,
            `I couldn't find an <b>Assign Membership</b> control here. On this build the Loyalty page is ` +
            `<b>Campaigns</b> + <b>Point Setup</b>, with no per-customer rows.<br>` +
            `<small>Memberships are sold/attached at billing time — check the POS customer panel.</small>`);
        return;
    }

    // Anything else that lands here (a bare "loyalty" command) must still get an
    // answer — falling off the end leaves the bubble waiting until it times out.
    const pt = document.getElementById('earnPoint'), amt = document.getElementById('earnAmount');
    reply('info', null,
        `Loyalty on this build is <b>Campaigns</b> + <b>Point Setup</b>` +
        (pt && amt ? ` — customers currently earn <b>${pt.value}</b> point(s) per ₹<b>${amt.value}</b>.` : '.') +
        `<br><small>I can change the rate: <i>"set loyalty earn rate 10 points per ₹100"</i>.</small>`);
}

// ── Bank Reconciliation ───────────────────────────────────────────────────────
// Recon 06/09/2026: this page is a LIST of bank accounts — Bank Account,
// Account Branch, Status, Last Reconciled By, Bank Balance, Ledger Balance — with
// only "Filter" and "Import Statement". There is no account select, no date range
// and no Auto Reconcile button, so the old handler hunted for all three, found
// none, and still reported SUCCESS while telling the user to press a button that
// does not exist. Reconciling proper needs a statement FILE, which we never upload.
async function openBankReconciliation(data) {
    await settle(1400);
    const tbl = await waitForEl(() => [...pageQSA('table')].find(t => t.offsetParent
                    && /bank\s*balance|ledger\s*balance/i.test(t.innerText || '')), 9000);
    if (!tbl) {
        reply('info', null, 'Bank Reconciliation is open, but the account list hasn\'t loaded — your role may not have access.');
        return;
    }
    const num = s => parseFloat(String(s || '').replace(/[^\d.\-]/g, '')) || 0;
    const rows = [...tbl.querySelectorAll('tbody tr')].map(tr => {
        const c = [...tr.querySelectorAll('td')].map(td => td.innerText.replace(/\s+/g, ' ').trim());
        return { name: c[1] || '', branch: c[2] || '', status: c[3] || '', by: c[4] || '',
                 bank: num(c[5]), ledger: num(c[6]), diff: num(c[6]) - num(c[5]) };
    }).filter(r => r.name);
    if (!rows.length) { reply('info', null, 'No bank accounts are listed for reconciliation on this outlet.'); return; }

    const wanted = data.bankAccount || data.bank || data.accountName;
    const pick   = wanted ? vasyBest(wanted, rows, r => r.name, 0.45) : null;
    if (wanted && !pick) {
        reply('error', null, `I couldn't find a bank account matching "<b>${wanted}</b>". Listed: ` +
            `<small>${rows.slice(0, 8).map(r => r.name).join(' · ')}</small>`);
        return;
    }
    const fmt = n => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (pick) {
        const r = pick.item;
        reply('success', 'Bank Reconciliation',
            `<b>${r.name}</b> — status <b>${r.status}</b>${r.by && r.by !== '-' ? `, last reconciled by ${r.by}` : ', never reconciled'}.<br>` +
            `Bank ₹${fmt(r.bank)} · Ledger ₹${fmt(r.ledger)} · <b>Difference ₹${fmt(r.diff)}</b><br>` +
            `<small>To reconcile, press <b>Import Statement</b> and upload the bank statement — I can't attach files for you.</small>`);
        return;
    }
    const gaps = rows.filter(r => Math.abs(r.diff) > 0.009).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    reply('success', 'Bank Reconciliation',
        `<b>${rows.length}</b> bank account${rows.length === 1 ? '' : 's'}, ` +
        `<b>${rows.filter(r => /open/i.test(r.status)).length}</b> still open.<br>` +
        (gaps.length
            ? `Biggest bank-vs-ledger gaps:<br>` + gaps.slice(0, 5).map(r =>
                `&nbsp;• ${r.name} — <b>₹${fmt(r.diff)}</b> <small>(bank ₹${fmt(r.bank)} / ledger ₹${fmt(r.ledger)})</small>`).join('<br>')
            : `Every listed account matches its ledger.`) +
        `<br><small>Reconciling needs <b>Import Statement</b> (a bank statement file) — that upload has to be yours.</small>`);
}

// ── E-Invoice / E-Way Bill trigger ────────────────────────────────────────────
async function triggerEInvoiceOrEWayBill(data, type) {
    await sleep(500);
    // Look for the generate button on the current page
    const pattern = type === 'EInvoice'
        ? /generate.*e.?invoice|e.?invoice.*generate/i
        : /generate.*e.?way|e.?way.*generate|eway.*bill/i;
    const btn = await waitForEl(() =>
        [...pageQSA('button,a,.btn')].find(b => b.offsetParent && pattern.test(b.innerText || b.title || ''))
    , 3000);
    if (!btn) {
        reply('info', null,
            `${type === 'EInvoice' ? 'E-Invoice' : 'E-Way Bill'} button not found. ` +
            `Open the Invoice/Delivery Challan first, then try again.`
        );
        return;
    }
    btn.click();
    watchResult(`${type === 'EInvoice' ? 'E-Invoice' : 'E-Way Bill'} Generated`, []);
}

// ── Department create ─────────────────────────────────────────────────────────
async function createDepartment(data) {
    const newBtn = [...pageQSA('a,button')].find(e => e.offsetParent && /new\s*dep|create\s*dep/i.test(e.innerText));
    if (newBtn) { newBtn.click(); await sleep(500); }
    const nameEl = pageQS('input[name*="department" i],input[id*="department" i],input[name="name"],input[id="name"]');
    if (nameEl) setVal(nameEl, data.departmentName || data.name);
    if (data.departmentCode) {
        const codeEl = pageQS('input[name*="code" i],input[id*="code" i]');
        if (codeEl) setVal(codeEl, data.departmentCode);
    }
    watchResult('Department Created', ['/department']);
    const openModal = [...pageQSA('.modal')].find(m => m.getClientRects().length > 0)
                   || pageQS('.modal');
    const modalSave = { click: () => clickModalSave(openModal) };
    if (modalSave) modalSave.click();
    else if (!clickSaveBtn()) reply('error', null, 'Save button not found on Department form.');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH / EDIT / DELETE
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// LOOKUPS — a party's balance, stock of an item, open/print a document by number
// ═══════════════════════════════════════════════════════════════════════════════
// The redesigned (React) pages — the dashboard among them — carry NO _csrf meta, so a
// POST from there is answered "403 access denied". Borrow the token from a classic
// page once (a GET, nothing changes) and reuse it for the session.
let _csrfCache = null;
async function _csrf() {
    const tok = pageQS('meta[name="_csrf"]')?.content;
    if (tok) return { tok, hdr: pageQS('meta[name="_csrf_header"]')?.content || 'X-CSRF-TOKEN' };
    if (_csrfCache) return _csrfCache;
    try {
        const html = await (await fetch('/contact/', { credentials: 'include' })).text();
        const d = new DOMParser().parseFromString(html, 'text/html');
        const t = d.querySelector('meta[name="_csrf"]')?.content;
        if (t) _csrfCache = { tok: t, hdr: d.querySelector('meta[name="_csrf_header"]')?.content || 'X-CSRF-TOKEN' };
    } catch (e) {}
    return _csrfCache || { tok: '', hdr: 'X-CSRF-TOKEN' };
}
async function _postHeaders() {
    const { tok, hdr } = await _csrf();
    return { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', ...(tok ? { [hdr]: tok } : {}) };
}
// Recon 06/10/2026: POST /contact/{customers|suppliers}/find/select/json with
// contactname → items {id, text:"First Last Company 98…", mobNo}. The id opens
// /contact/<type>/<id>, whose detail table carries "Due Payment".
async function _findContacts(q, type) {
    try {
        const r = await fetch(`/contact/${type}/find/select/json`, { method: 'POST', credentials: 'include', headers: await _postHeaders(),
            body: new URLSearchParams({ contactname: q, page: 1 }).toString() });
        const j = await r.json();
        return (j.items || []).filter(i => i && i.id).map(i => ({ ...i, type }));
    } catch (e) { return []; }
}
function _contactName(c) {
    let t = String(c.text || '').replace(/\s+/g, ' ').trim();
    if (c.mobNo) t = t.replace(new RegExp('\\s*' + c.mobNo + '\\s*$'), '').trim();
    const w = t.split(' '), h = w.length / 2;              // "Gupta Stores Gupta Stores" → "Gupta Stores"
    if (w.length % 2 === 0 && w.slice(0, h).join(' ').toLowerCase() === w.slice(h).join(' ').toLowerCase()) t = w.slice(0, h).join(' ');
    return t;
}
const _rupees = v => '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
async function partyBalance(data) {
    let q = String(data.partyName || '').trim();
    if (!q) { reply('error', null, 'Whose balance should I check? Give me the customer or supplier name.'); return; }
    // a tapped answer is pinned: "<name> #c18350085" (c = customer, s = supplier)
    const pin = q.match(/^(.*?)\s*#([cs])(\d{3,})\s*$/i);
    let cands = [];
    if (pin) q = pin[1].trim();
    const k = vasyNorm(q);
    const exact = list => list.filter(c => vasyNorm(_contactName(c)) === k || (c.mobNo && vasyNorm(c.mobNo) === k));
    // which contact this name resolved to last time (the shared 6 h lookup cache)
    const known = !pin && !data._fresh && ((await lookupCacheGet('party|' + k)) || [])[0];
    if (pin) {
        cands = [{ id: pin[3], type: pin[2].toLowerCase() === 'c' ? 'customers' : 'suppliers', text: q, mobNo: '' }];
    } else if (known) {
        cands = [known];
    } else {
        // Both lists are searched server-side, and on a big account the customer search
        // alone took 15–50 s while the supplier answer was back in half a second. Once one
        // side has an exact match, the other gets a short grace period, not the full wait.
        const pc = _findContacts(q, 'customers'), ps = _findContacts(q, 'suppliers');
        const [side, list] = await Promise.race([pc.then(v => ['c', v]), ps.then(v => ['s', v])]);
        let other = [];
        if (exact(list).length) other = (await Promise.race([side === 'c' ? ps : pc, sleep(2500).then(() => null)])) || [];
        else other = await (side === 'c' ? ps : pc);
        cands.push(...list, ...other);
    }
    let hits = (pin || known) ? cands : exact(cands);
    if (!hits.length) hits = cands.filter(c => vasyNorm(_contactName(c)).includes(k) || vasyNorm(c.text).includes(k));
    if (!hits.length) {
        reply('error', null, `There's no customer or supplier called "<b>${q}</b>". Check the spelling, or give me their mobile number.`);
        return;
    }
    if (hits.length > 1) {
        askChoice('Which one?', `<b>${hits.length}</b> contacts match "<b>${q}</b>".<br><small>Tap the one you mean:</small>`, q,
            hits.slice(0, 6).map(h => ({ label: `${_contactName(h)} · ${h.type === 'customers' ? 'customer' : 'supplier'}${h.mobNo ? ' · ' + h.mobNo : ''}`,
                                         value: `${_contactName(h)} #${h.type === 'customers' ? 'c' : 's'}${h.id}` })), 'partyName');
        return;
    }
    const h = hits[0], name = _contactName(h), isCust = h.type === 'customers';
    const url = `${location.origin}/contact/${h.type}/${h.id}`;
    let due = null, pending = [];
    try {
        const doc = new DOMParser().parseFromString(await (await fetch(url, { credentials: 'include' })).text(), 'text/html');
        const lab = [...doc.querySelectorAll('td,th')].find(c => /^\s*due\s+payment\s*$/i.test(c.textContent));
        const val = lab && lab.nextElementSibling ? lab.nextElementSibling.textContent : '';
        const num = parseFloat(String(val).replace(/[^\d.\-]/g, ''));
        if (isFinite(num)) due = num;
        // documents with something still due, when the page lists them
        for (const tb of doc.querySelectorAll('table')) {
            const heads = [...tb.querySelectorAll('thead th')].map(x => x.textContent.replace(/\s+/g, ' ').trim());
            const di = heads.findIndex(x => /due\s*amount/i.test(x)); if (di < 0) continue;
            const ni = heads.findIndex(x => /(invoice|bill|order|voucher)\s*(no|number|#)|^no\.?$|^#$/i.test(x));
            for (const tr of tb.querySelectorAll('tbody tr')) {
                const c = [...tr.cells].map(x => x.textContent.replace(/\s+/g, ' ').trim());
                const d = parseFloat(String(c[di] || '').replace(/[^\d.\-]/g, ''));
                if (isFinite(d) && d > 0 && c[ni >= 0 ? ni : 0]) pending.push(`${c[ni >= 0 ? ni : 0]} · ${_rupees(d)}`);
            }
        }
    } catch (e) {}
    if (due == null) {
        if (known) { lookupCacheForget(q); return partyBalance({ ...data, _fresh: true }); }   // stale — search afresh
        reply('info', name, `I found <b>${name}</b> but couldn't read their balance. <a href="${url}" target="_blank">Open the contact</a> to see it.`);
        return;
    }
    if (!pin && !known) lookupCacheSet('party|' + k, [h]);
    const amt = _rupees(Math.abs(due));
    const line = due === 0 ? `<b>${name}</b> has nothing due — the account is settled.`
               : isCust ? `<b>${name}</b> owes you <b>${amt}</b>.`
               : `You owe <b>${name}</b> <b>${amt}</b>.`;
    const next = due > 0
        ? (isCust ? `<br><small>To record it: <i>"collect ${Math.round(due)} from ${name} cash"</i></small>`
                  : `<br><small>To pay it: <i>"pay ${Math.round(due)} to ${name} cash"</i></small>`) : '';
    reply('info', isCust ? 'Customer balance' : 'Supplier balance',
        line + (pending.length ? `<br><small>Still due: ${pending.slice(0, 5).join(' · ')}</small>` : '') + next +
        `<br><small><a href="${url}" target="_blank">Open ${name}</a></small>`);
}

// Recon 06/10/2026 (/product): the list's own header names the columns —
// … Item Code · Category · Brand · Name · MRP · Selling Price · HSN · Qty · Status …
async function stockQuery(data) {
    const q = String(data.itemName || '').trim();
    if (!q) { reply('error', null, 'Stock of which product?'); return; }
    await settle(1200);
    await searchInTable(q);
    const rows = _listRows();
    const table = rows[0] && rows[0].closest('table');
    if (!table) { reply('error', null, `No product matches "<b>${q}</b>".`); return; }
    const heads = [...(table.tHead ? table.tHead.rows[0].cells : [])].map(c => (c.innerText || '').replace(/\s+/g, ' ').trim());
    const col = re => heads.findIndex(x => re.test(x));
    const iName = col(/^(product\s*)?name$/i), iQty = col(/^(qty|stock|quantity|available)/i),
          iCode = col(/item\s*code/i), iMrp = col(/^mrp$/i), iSp = col(/selling/i);
    if (iName < 0 || iQty < 0) { reply('info', null, `I opened the product list for "<b>${q}</b>" but couldn't find its Qty column — check the list on screen.`); return; }
    const cell = (r, i) => (i >= 0 && r.cells[i] ? r.cells[i].innerText.replace(/\s+/g, ' ').trim() : '');
    const k = vasyNorm(q);
    let hit = rows.filter(r => vasyNorm(cell(r, iName)) === k || vasyNorm(cell(r, iCode)) === k);
    if (!hit.length) hit = rows.filter(r => vasyNorm(cell(r, iName)).includes(k) || vasyNorm(cell(r, iCode)).includes(k));
    if (!hit.length) { reply('error', null, `No product called "<b>${q}</b>". Check the spelling, or give me its item code.`); return; }
    const lines = hit.slice(0, 6).map(r => {
        const qty = parseFloat(cell(r, iQty).replace(/[^\d.\-]/g, ''));
        // some products here carry the literal name "null" — show the code instead
        const rawNm = cell(r, iName), code = cell(r, iCode);
        const nm = rawNm && !/^(null|undefined|-)$/i.test(rawNm) ? rawNm : '';
        const tag = !isFinite(qty) ? cell(r, iQty) : qty <= 0 ? `<b style="color:#b3202a">${qty}</b> — out of stock` : `<b>${qty}</b> in stock`;
        return `${nm || code || '(no name)'}${nm && code ? ` <small>(${code})</small>` : ''}: ${tag}` +
               (iSp >= 0 && cell(r, iSp) ? ` <small>· sells at ₹${parseFloat(cell(r, iSp)) || cell(r, iSp)}</small>` : '');
    });
    reply('info', hit.length === 1 ? 'Stock' : `Stock — ${hit.length} products match`,
        lines.join('<br>') + (hit.length > 6 ? `<br><small>+${hit.length - 6} more on the list</small>` : ''));
}

// Open (or print) one document by its number. The list is searched first; the
// number's own link carries the record id, so no row-clicking guesswork.
async function openDocument(data) {
    const ref = String(data.docNumber || '').trim();
    if (!ref) { reply('error', null, 'Which document number?'); return; }
    await settle(1200);
    await searchInTable(ref);
    const k = vasyNorm(ref);
    let a = [...pageQSA('table tbody a[href]')].find(x => x.offsetParent && vasyNorm(x.innerText) === k);
    if (!a) {
        const row = _listRows().find(r => [...r.cells].some(c => vasyNorm(c.innerText) === k));
        a = row && [...row.querySelectorAll('a[href]')].find(x => /\/\d+(?:[\/?#]|$)/.test(x.getAttribute('href') || ''));
    }
    if (!a) {
        reply('error', null, `<b>${ref}</b> isn't on this list. Check the number — and the financial year selected at the top, which limits the list.`);
        return;
    }
    if (data.print) {
        // The document's own page is read in the background — the list stays put
        let t = null;
        try {
            const html = await (await fetch(a.href, { credentials: 'include' })).text();
            t = printTargets(new DOMParser().parseFromString(html, 'text/html'), a.href);
        } catch (e) {}
        if (t && (t.print || t.pdf)) { await openPrintView(ref, t, data.pdf); return; }
        chrome.runtime.sendMessage({ action: 'inject_on_navigate', url: a.href, script: 'content_agent.js',
            message: { action: 'print_document', data: { docNumber: ref, pdf: data.pdf } } });
        return;
    }
    reply('success', `Opened ${ref}`, `Here it is. <small>Ask me about it, or say <i>"print ${ref}"</i>.</small>`);
    setTimeout(() => { location.href = a.href; }, 300);
}

// Recon 14/10/2026 — every document page has two icon-only controls, labelled in
// Bootstrap's data-original-title (the tooltip empties title=""):
//   Print  <a onclick="printSalesReport()"><i class="fa fa-print">  — sales: window.open('…/htmlpdf/<id>')
//                                                                    purchase: iframe src '…/<id>/pdf'
//   PDF    <a href="…/<id>/pdf"><i class="fa fa-file-pdf">          — receipt / stock transfer: PDF only
// Clicking Print from a script fails both ways: Chrome's popup blocker stops the
// window.open (no user gesture after a page load), and the purchase iframe is
// printed before the PDF inside it has loaded. So the URL is read out of the print
// function and the extension opens it itself. "Cheque Printing" (fa-print, on
// payments) and "Acknowledgment PDF" share the icons and are not the document.
function printTargets(doc, base) {
    const label = e => [e.textContent, e.getAttribute('title'), e.getAttribute('data-original-title'), e.getAttribute('aria-label')]
        .map(x => String(x || '').replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ');
    const abs = u => { try { return new URL(u, base || location.href).href; } catch (e) { return ''; } };
    const href = e => { const h = (e.getAttribute('href') || '').trim(); return h && !/^(#|javascript:)/i.test(h) ? abs(h) : ''; };
    const icon = (e, re) => [...e.querySelectorAll('i')].some(i => re.test(i.className));
    const ctrls = [...doc.querySelectorAll('a,button')].filter(e => !isOurs(e) && !e.closest('[class*="helpSidebar"]')
        && !/cheque|acknowledg|barcode|label|excel|e-?way|e-?invoice/i.test(label(e)));
    const src = [...doc.scripts].map(s => s.textContent).join('\n');
    let print = '';
    for (const e of ctrls.filter(e => /^print\b/i.test(label(e)) || icon(e, /\bfa-print\b/))) {
        const fn = ((e.getAttribute('onclick') || '').match(/^\s*(\w+)\s*\(/) || [])[1];
        const at = fn ? src.indexOf('function ' + fn) : -1;
        const body = at >= 0 ? src.slice(at, at + 1500) : '';
        const win = (body.match(/window\.open\(\s*["'`]([^"'`]+)/) || [])[1];
        const frame = (body.match(/attr\(\s*['"]src['"]\s*,\s*["'`]([^"'`]+)/) || [])[1];
        // printSalesReport() branches on the account's print setting: if("html"=="html")
        const mode = (body.match(/if\s*\(\s*["'](\w*)["']\s*===?\s*["']html["']/) || [])[1];
        const u = mode === undefined || mode === 'html' ? (win || frame) : (frame || win);
        print = u ? abs(u) : href(e);
        if (print) break;
    }
    const pdfEl = ctrls.find(e => (/^(pdf|download\s*pdf)$/i.test(label(e)) || icon(e, /\bfa-file-pdf\b/)) && href(e));
    return { print, pdf: pdfEl ? href(pdfEl) : '' };
}
async function openPrintView(ref, t, wantPdf) {
    const url = wantPdf ? (t.pdf || t.print) : (t.print || t.pdf);
    const asPdf = url === t.pdf;
    let r = null;
    try { r = await chrome.runtime.sendMessage({ action: 'open_print', url, print: !wantPdf }); } catch (e) {}
    if (!r || !r.ok) {
        reply('info', ref, `Here's ${ref}: <a href="${url}" target="_blank">${asPdf ? 'PDF' : 'print view'}</a>.`);
        return;
    }
    // purchase documents print their PDF itself — then there is no "other"
    const other = !t.print || !t.pdf || t.print === t.pdf ? ''
        : asPdf ? `<a href="${t.print}" target="_blank">print view</a>` : `<a href="${t.pdf}" target="_blank">PDF</a>`;
    reply('success', wantPdf ? `PDF of ${ref}` : `Printing ${ref}`,
        (wantPdf ? `Opened the PDF in a new tab.`
                 : r.printed ? `Opened VasyERP's ${asPdf ? 'PDF' : 'print view'} in a new tab — choose the printer there.`
                             : `Opened it in a new tab — press <b>Ctrl+P</b> there to print.`) +
        (other ? ` <small>Or the ${other}.</small>` : ''));
}
async function printDocument(data) {
    await settle(data.here ? 300 : 2000);
    // a document page's title is "INV/1356 | Invoice"
    const head = (document.title || '').split('|')[0].trim();
    const ref = data.docNumber || (/\d/.test(head) && head.length <= 30 ? head : 'this document');
    const t = printTargets(document);
    if (!t.print && !t.pdf) {
        reply('info', `Opened ${ref}`, `I don't see a Print button on this page — use the browser's print (<b>Ctrl+P</b>).`);
        return;
    }
    await openPrintView(ref, t, data.pdf);
}

async function searchRecords(query, opts = {}) {
    if (opts.contactType) await _contactTab(opts.contactType);
    const onTab = opts.tab ? await _itemMasterTab(opts.tab) : false;
    // a note from the parser (e.g. the V9.14.0 category-merge explanation) rides on every outcome
    const tail = opts.note && opts.note !== 'close' ? `<br><small>${opts.note}</small>` : '';
    if (!query) {
        // a plain "open the register / show the list" — the page itself is the answer
        reply('info', null, opts.note === 'close'
            ? `The sales register is open. Closing the till needs your <b>cash count</b> — enter it here and confirm; I don't close it for you.`
            : (onTab ? `Opened the <b>${opts.tab}</b> tab of Item Masters.` : `Opened the list.`) + tail);
        return;
    }
    await searchInTable(query);
    // the table next to the search box — not the nav menu, a help panel or a hidden tab's table
    const tbody = _resultTbody();
    if (!tbody) { reply('info', null, 'No data table found on this page.' + tail); return; }
    const rows = [...tbody.querySelectorAll('tr')].filter(r => r.offsetParent && r.cells && r.cells.length > 1);
    if (!rows.length) { reply('info', null, `No records found for "<b>${query}</b>".` + tail); return; }
    // lead with the cell that matched (the product list's Name column sits past the first four)
    const qk = vasyNorm(query);
    const preview = rows.slice(0,8).map(r => {
        const cells = [...r.cells].map(c => c.innerText.replace(/\s+/g, ' ').trim());
        const hit = cells.findIndex((c, i) => i > 0 && c.length < 80 && qk && vasyNorm(c).includes(qk));
        const rest = cells.slice(1, 5).filter((c, i) => c && i + 1 !== hit);
        return (hit > 0 ? `<b>${cells[hit]}</b> | ` : '') + rest.join(' | ');
    }).join('<br>');
    const more = rows.length > 8 ? `<br><i>+${rows.length-8} more results</i>` : '';
    reply('info', null, `<b>${rows.length}</b> result(s) for "<b>${query}</b>":<br>${preview}${more}` + tail);
}

async function editRecord(entity, data) {
    await settle(1200);
    const found = await findRecordRow(entity, data, 'edit');
    if (!found) return;
    const { row, q } = found;
    // the search term named the record; it is not a value to type into the form
    data = { ...data }; delete data.searchQuery;
    if (entity === 'Contact') { delete data.contactType; }
    const nav = (url) => chrome.runtime.sendMessage({ action:'inject_on_navigate', url, script:'content_agent.js', message:{action:'fill_edit_form',entity,data} });

    // 1. Direct /edit link
    const directEdit = [...row.querySelectorAll('a')].find(a => a.pathname.includes('/edit'));
    if (directEdit) { nav(directEdit.href); return; }
    // 1b. onclick="editProduct(37363291)" → /product/<id>/edit (recon 05/10/2026)
    const onEdit = [...row.querySelectorAll('a,button')].map(a => (a.getAttribute('onclick') || '').match(/edit(\w*)\((\d+)/i)).find(Boolean);
    if (onEdit && /^product$/i.test(onEdit[1])) { nav(`${location.origin}/product/${onEdit[2]}/edit`); return; }

    // 2. Bootstrap dropdown
    const dropToggle = row.querySelector('button[data-toggle="dropdown"],a[data-toggle="dropdown"]');
    if (dropToggle) {
        dropToggle.click(); await sleep(500);
        const editItem = [...pageQSA('.dropdown-item')].find(el =>
            (el.innerText||el.title||'').toLowerCase().includes('edit') && el.offsetParent
        );
        if (editItem?.pathname?.includes('/edit')) { nav(editItem.href); return; }
    }

    // 3. MUI icon button
    const muiBtn = row.querySelector('button[class*="MuiIconButton"]');
    if (muiBtn) {
        muiBtn.click(); await sleep(500);
        const editItem = [...pageQSA('li[role="menuitem"]')].find(el =>
            el.innerText.trim().toLowerCase() === 'edit' && el.offsetParent
        );
        if (editItem) { editItem.click(); await settle(2500); await fillEditForm(entity, data); return; }
    }

    // 4. Button with title="Edit" — derive URL from detail link
    const editBtn = row.querySelector('button[title="Edit"],button[title="edit"]');
    const detailA  = [...row.querySelectorAll('a')].find(a => /\/\d+$/.test(a.pathname));
    if ((editBtn || row.querySelector('a[onclick*="edit"]')) && detailA) {
        nav(detailA.href.replace(/\/?$/, '/edit')); return;
    }

    // 5. Fallback: construct /edit from any detail link
    if (detailA) { nav(detailA.href.replace(/\/?$/, '/edit')); return; }

    reply('error', null, `Could not find edit path for "<b>${q}</b>". Please open the record manually.`);
}

async function fillEditForm(entity, data) {
    await sleep(600);
    const { searchQuery, ...fields } = data;
    switch (entity) {
        case 'Contact':  await _editContact(fields);  break;
        case 'Employee': await _editEmployee(fields); break;
        case 'Product':  await _editProduct(fields);  break;
        default:         await _editGeneric(fields);
    }
    watchResult(`${entity} Updated`, []);
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on edit form.');
}

async function _editContact(d) {
    if (d.contactType) {
        const typeMap = {customer:'customers',supplier:'suppliers',transport:'transport'};
        const val = typeMap[d.contactType.toLowerCase()] || 'customers';
        pageQS(`input[name="typeOfContactEdit"][value="${val}"],input[name="typeOfContact"][value="${val}"]`)?.click();
    }
    if (d.businessType) pageQS(`input[name="contact_type"][value="${d.businessType.toLowerCase()}"]`)?.click();
    if (d.firstName)   setVal(document.getElementById('firstName'),          d.firstName);
    if (d.lastName)    setVal(document.getElementById('lastName'),           d.lastName);
    if (d.mobile) {
        const wa = document.getElementById('whatsappNo'), mob = document.getElementById('mobNo');
        // WhatsApp mirrors the mobile when it was the same number — keep them together
        if (wa && mob && wa.value === mob.value) setVal(wa, d.mobile);
        setVal(mob, d.mobile);
    }
    if (d.email)       setVal(pageQS('input[name="email"]'), d.email);
    if (d.companyName) setVal(document.getElementById('companyName'),        d.companyName);
    if (d.pan)         setVal(document.getElementById('panNo'),              d.pan);
    if (d.gstin) {
        const gt = document.getElementById('gst_type0');
        if (gt) {
            const reg = [...gt.options].find(o => /^registered/i.test((o.text || o.value || '').trim()));
            if (reg && gt.value !== reg.value) { gt.value = reg.value; gt.dispatchEvent(new Event('change', { bubbles: true })); await sleep(300); }
        }
        setVal(document.getElementById('gstin0'), d.gstin);
    }
    if (d.address) setVal(document.getElementById('addressLine10'), d.address);
    if (d.pinCode) setVal(document.getElementById('pinCode0'), d.pinCode);
}

async function _editEmployee(d) {
    if (d.firstName || d.lastName)
        setVal(document.getElementById('employeeName'), [d.firstName, d.lastName].filter(Boolean).join(' '));
    if (d.mobile)   setVal(pageQS('input[name="mobNo"]'), d.mobile);
    if (d.email)    setVal(document.getElementById('employeeEmail'),      d.email);
    if (d.username) setVal(document.getElementById('username'),           d.username);
    if (d.password) setVal(document.getElementById('password'),           d.password);
    if (d.role)     await fillReactSelect('role', d.role);
}

async function _editProduct(d) {
    if (d.productName) setVal(document.getElementById('name'),             d.productName);
    // MRP first: the selling price is derived from it on this form
    if (d.mrp)         { setVal(document.getElementById('mrp-1'),          d.mrp); await sleep(300); }
    if (d.price)       setVal(document.getElementById('sellingPrice-1'),   d.price);
    if (d.purchasePrice) setVal(document.getElementById('purchasePrice-1'), d.purchasePrice);
    if (d.category)    setSelect2Text('category_id',                       d.category);
    if (d.brand)       setSelect2Text('brand',                             d.brand);
    if (d.unit)        setSelect2Text('uom',                               d.unit);
    if (d.hsn)         setVal(document.getElementById('hsnCode'),          d.hsn);
    if (d.taxRate)     setSelect2Text('sales_tax',                         String(d.taxRate));
}

async function _editGeneric(d) {
    for (const [key, value] of Object.entries(d)) {
        if (!value) continue;
        const el = pageQS(`[name="${key}"],[id="${key}"]`);
        if (el) setVal(el, value);
    }
}

async function deleteRecord(data, actionText = 'delete') {
    await settle(1200);
    const found = await findRecordRow(data.entity || (/\/contact/.test(location.pathname) ? 'Contact' : ''), data, actionText);
    if (!found) return;
    const row = found.row;
    const summary = _rowSummary(row);
    // Deleting can't be undone and the ERP's own "are you sure?" is answered by
    // us — so the user says yes first, to the exact record we found.
    window.__vasyPendingRowAction = { row, actionText, summary };
    try { chrome.runtime.sendMessage({ action: 'pending_save', task: actionText === 'deactivate' ? 'Deactivate' : 'Delete', url: location.href }); } catch (e) {}
    reply('info', actionText === 'deactivate' ? 'Deactivate this record?' : 'Delete this record?',
        `<b>${summary.replace(/</g, '&lt;')}</b><br>` +
        (actionText === 'deactivate' ? `It will be hidden from lists and pickers.` : `This can't be undone.`) +
        ` <b>Nothing has been changed yet.</b> Reply <b>yes</b> to ${actionText} it, or <b>cancel</b>. (yes/cancel)`);
}

async function _doRowAction(row, actionText, summary) {
    if (!row || !row.isConnected) {
        reply('error', null, `The list changed before I could ${actionText} "<b>${summary}</b>". <b>Nothing was changed</b> — please ask again.`);
        return;
    }

    // Match the action EXACTLY. Products label it "Deactive", so "deactivate" used
    // to miss every label and fall through to the first onclick containing
    // "delete" — a deactivate request deleted the product.
    const wantDeact = /deactiv/i.test(actionText);
    const isIt = t => wantDeact ? /deactiv/i.test(t) : (/\b(delete|remove)\b/i.test(t) && !/deactiv/i.test(t));
    const go = async el => { el.click(); await sleep(600); await _confirmDialog(actionText); await _verifyRowAction(row, actionText, summary); };

    const dropToggle = row.querySelector('button[data-toggle="dropdown"],a[data-toggle="dropdown"]');
    if (dropToggle) {
        dropToggle.click(); await sleep(500);
        const menu = dropToggle.parentElement && dropToggle.parentElement.querySelector('.dropdown-menu');
        const items = [...(menu ? menu.querySelectorAll('a,button,.dropdown-item') : pageQSA('.dropdown-item'))].filter(el => el.offsetParent);
        const target = items.find(el => isIt((el.innerText || '') + ' ' + (el.title || '')));
        if (target) { await go(target); return; }
    }

    const muiBtn = row.querySelector('button[class*="MuiIconButton"]');
    if (muiBtn) {
        muiBtn.click(); await sleep(500);
        const target = [...pageQSA('li[role="menuitem"]')].find(el => el.offsetParent && isIt(el.innerText || ''));
        if (target) { await go(target); return; }
    }

    const btn = [...row.querySelectorAll('button,a')].find(b =>
        isIt((b.innerText || '') + ' ' + (b.title || '') + ' ' + (b.getAttribute('onclick') || '').replace(/\(.*$/, '')));
    if (btn) { await go(btn); return; }

    reply('error', null, `Could not find ${actionText} option for "<b>${summary}</b>".`);
}

// Deleting is irreversible, so "Record deleted" has to be earned: the ERP may
// refuse (stock exists, linked documents) and the confirm dialog may never have
// appeared. Check what the page says, and that the row actually went away.
async function _verifyRowAction(row, actionText, summary) {
    await sleep(900);
    const err = visibleErrorText();
    if (err) {
        reply('error', null, `Couldn't ${actionText} "<b>${summary}</b>" — VasyERP said: <b>${err}</b>`);
        return;
    }
    if (/delete|remove/i.test(actionText)) {
        const stillThere = row && row.isConnected && row.offsetParent;
        if (stillThere) {
            reply('info', null,
                `I clicked <b>${actionText}</b> for "<b>${summary}</b>", but the row is still in the list — ` +
                `<b>I can't confirm it was removed</b>.<br><small>There may have been a confirmation I couldn't see. ` +
                `Refresh the list and check before trying again.</small>`);
            return;
        }
    }
    lookupCacheForget(String(summary).split(' | ')[0].split(' - ')[0]);
    reply('success', `Record ${actionText}d`, summary);
}

async function _confirmDialog(actionText) {
    // The ERP's own "Are you sure?" — "Yes, delete it!" on products. The user
    // already said yes to this exact record, so answer it; prefer the dialog's
    // own confirm button over any loose "OK" on the page.
    const dlg = await waitForEl(() => pageQS('.swal2-popup .swal2-confirm, .sweet-alert button.confirm, .modal.show .btn-danger, .modal.show .btn-primary'), 2500);
    const btn = (dlg && dlg.offsetParent) ? dlg : [...pageQSA('.swal2-popup button,.modal.show button,.bootbox button')].find(b => {
        const t = (b.innerText || '').trim().toLowerCase();
        return b.offsetParent && /^(yes|confirm|ok|delete|deactivate|proceed|sure)\b/.test(t);
    });
    if (btn) { btn.click(); await sleep(500); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

const REPORT_URLS = {
    // ── Sales ──
    'sales report':                    '/accountreport/salesregister/invoice',
    'sales register':                  '/accountreport/salesregister/invoice',
    'invoice list':                    '/sales/invoice/report',
    'invoice report':                  '/sales/invoice/report',
    'sales summary':                   '/report/salessummary',
    'sales tax summary':               '/accountreport/taxsummary/invoice',
    'tax wise sales':                  '/accountreport/taxsummary/invoice',
    'tax summary':                     '/accountreport/taxsummary/invoice',
    'credit note register':            '/accountreport/salesregister/creditnote',
    'credit note report':              '/accountreport/salesregister/creditnote',
    'customer outstanding':            '/accountreport/ledgeroutstanding/customers',
    'customer ledger outstanding':     '/accountreport/ledgeroutstanding/customers',
    'customer invoice outstanding':    '/accountreport/voucheroutstanding/customers',
    'sales item register':             '/accountreport/salesitemregister/invoice',
    'item wise sales':                 '/accountreport/salesitemregister/invoice',
    'day wise sales':                  '/report/dailysalessummary',
    'daily sales':                     '/report/dailysalessummary',
    'daily sales summary':             '/report/dailysalessummary',
    'date wise sales summary':         '/report/date-wise-sales',
    'date wise sales':                 '/report/date-wise-sales',
    'department wise sales':           '/report/departmentwisesalessummary',
    'category wise sales':             '/report/categorywisesalessummary',
    'brand wise sales':                '/report/brandwisesalessummary',
    'product wise sales':              '/report/itemwisesalessummary',
    'item wise sales summary':         '/report/itemwisesalessummary',
    // V9.14.0: the Employee Performance Report replaced the Salesman Report —
    // /report/salesman now answers "You have no rights for this Menu."
    'employee performance report':     '/report/employeeperformance',
    'employee performance':            '/report/employeeperformance',
    'staff performance':               '/report/employeeperformance',
    'salesman performance':            '/report/employeeperformance',
    'salesman report':                 '/report/employeeperformance',
    'salesman summary':                '/report/employeeperformance',
    'sales person report':             '/report/employeeperformance',
    'employee wise sales':             '/report/employeeperformance',
    'best selling':                    '/report/bestandleastsellingproduct',
    'least selling':                   '/report/bestandleastsellingproduct',
    'best and least selling':          '/report/bestandleastsellingproduct',
    'best least selling':              '/report/bestandleastsellingproduct',
    'pending sales order':             '/report/pendingsalesorderreport',
    'pending orders':                  '/report/pendingsalesorderreport',
    'kpi report':                      '/report/kpireport',
    'kpi':                             '/report/kpireport',
    // 'pay later summary' had no report of its own on the live hub (that URL 404s)
    // — dropped so the request falls through to the hub's fuzzy link search
    // instead of landing the user on an error page.
    'all outlet sales':                '/report/outletsalessummary',
    'all outlet sales summary':        '/report/outletsalessummary',
    'outlet wise sales':               '/report/outletsalessummary',
    'category summary':                '/report/other/category-summery',
    // NEW in v9.10.0 — Sales Order Summary Report
    'sales order summary':             '/report/salesordersummaryreport',
    'sales order summary report':      '/report/salesordersummaryreport',
    'order summary':                   '/report/salesordersummaryreport',
    // ── Purchase ──
    'purchase report':                 '/accountreport/purchaseregister/bill',
    'purchase register':               '/accountreport/purchaseregister/bill',
    'purchase tax summary':            '/accountreport/taxsummary/bill',
    'supplier outstanding':            '/accountreport/ledgeroutstanding/suppliers',
    'supplier ledger outstanding':     '/accountreport/ledgeroutstanding/suppliers',
    'supplier bill outstanding':       '/accountreport/voucheroutstanding/suppliers',
    'debit note register':             '/accountreport/purchaseregister/debitnote',
    'debit note report':               '/accountreport/purchaseregister/debitnote',
    // NEW in v9.9.2
    'debit note item register':        '/accountreport/purchaseitemregister/debitnote',
    'debit note item report':          '/accountreport/purchaseitemregister/debitnote',
    'purchase item register':          '/accountreport/purchaseitemregister/bill',
    'purchase item report':            '/accountreport/purchaseitemregister/bill',
    // ── Inventory / Stock ──
    'stock report':                    '/accountreport/stockregister',
    'stock register':                  '/accountreport/stockregister',
    'stock summary':                   '/report/stock/stocksummary',
    'stock ledger':                    '/report/stockledgerwithfilter',
    'stock movement':                  '/report/stockmovement',
    'low stock':                       '/report/lowstock',
    'low stock alert':                 '/report/lowstock',
    'low stock report':                '/report/lowstock',
    'stock adjustment report':         '/report/stock/stockadjustmentreport',
    'stock adjustment':                '/report/stock/stockadjustmentreport',
    'material consumption report':     '/report/materialconsumptionreport',
    'consumption report':              '/report/materialconsumptionreport',
    'consumption production report':   '/report/consumption-production-report',
    'production report':               '/report/consumption-production-report',
    'stock transfer report':           '/report/stocktransferitemsummary',
    'stock transfer summary':          '/report/stocktransferitemsummary',
    'transfer report':                 '/report/stocktransferitemsummary',
    'price change':                    '/report/productlog',
    'price change report':             '/report/productlog',
    'product price log':               '/report/productlog',
    'abc analysis':                    '/report/abcanalysisreport',
    'abc report':                      '/report/abcanalysisreport',
    'stock ageing':                    '/report/productageingReport',
    'stock aging':                     '/report/productageingReport',
    'ageing report':                   '/report/productageingReport',
    'price master':                    '/report/stockmasterprice',
    'price master report':             '/report/stockmasterprice',
    'inventory report':                '/report/inventoryReport/excel',
    'stock verification report':       '/report/stock-verification-report',
    'verification report':             '/report/stock-verification-report',
    'batch report':                    '/report/inventoryReport/excel',
    // ── Accounting / Finance ──
    'general ledger':                  '/report/general-ledger',
    'account ledger':                  '/report/general-ledger',
    'customer ledger':                 '/report/general-ledger',
    'supplier ledger':                 '/report/general-ledger',
    'trial balance':                   '/report/trialbalance',
    'trial sheet':                     '/report/trialbalance',
    'day book':                        '/report/daybook',
    'daybook':                         '/report/daybook',
    'cash book':                       '/report/cash-book',
    'cashbook':                        '/report/cash-book',
    'bank book':                       '/report/bank-book',
    'bankbook':                        '/report/bank-book',
    'journal book':                    '/report/journalvoucher',
    'journal voucher report':          '/report/journalvoucher',
    'balance sheet':                   '/report/balancesheet',
    'profit loss':                     '/report/profitandloss',
    'profit and loss':                 '/report/profitandloss',
    'p&l':                             '/report/profitandloss',
    'pl report':                       '/report/profitandloss',
    'expense register':                '/report/expense-register',
    'expense report':                  '/report/expense-register',
    'tds report':                      '/accountreport/statutory/tdsreport',
    'tcs report':                      '/accountreport/statutory/tcsreport',
    'ewb einv report':                 '/report/other/ewb-einv',
    'einvoice report':                 '/report/other/ewb-einv',
    'eway bill report':                '/report/other/ewb-einv',
    'e-invoice report':                '/report/other/ewb-einv',
    // NEW in v9.10.0 — Bank Reconciliation Statement
    'bank reconciliation':             '/bank-reconciliation',
    'reconciliation report':           '/bank-reconciliation',
    'bank statement':                  '/bank-reconciliation',
    'reconciliation statement':        '/bank-reconciliation',
    // ── Branch / Multi-outlet ──
    'branch wise summary':             '/report/branch/summary',
    'branch summary':                  '/report/branch/summary',
    'outlet summary':                  '/report/branch/summary',
    // ── GST ──
    'gst report':                      '/report/gstr_1',
    'gst':                             '/report/gstr_1',
    'gstr1':                           '/report/gstr_1',
    'gstr 1':                          '/report/gstr_1',
    'gstr2':                           '/report/gstr_2',
    'gstr 2':                          '/report/gstr_2',
    'gstr3':                           '/report/gstr_3',
    'gstr 3':                          '/report/gstr_3',
    'gst summary':                     '/report/gstr_1',
    // ── POS ──
    'pos report':                      '/report/pos',
    'pos order list':                  '/report/pos',
    'pos list':                        '/report/pos',
    'pos sales':                       '/report/pos',
    'point of sale report':            '/report/pos',
    // ── CRM ──
    'loyalty report':                  '/loyalty',
    'points report':                   '/loyalty',
    'membership report':               '/loyalty',
    'feedback report':                 '/crm/feedback',
    'customer feedback':               '/crm/feedback',

    // ── Added 06/09/2026 from the live /report hub (92 links read off the page).
    // These existed in the ERP but had no direct mapping, so they only resolved
    // via the slower fuzzy hub search — and only if the wording happened to match.
    'all registers':                   '/salesregister',
    'register report':                 '/salesregister',
    'amount wise sales':               '/report/amountwisesales',
    'time wise sales':                 '/report/timewisesales',
    'sales by product':                '/report/salesbyproduct',
    'sales register new':              '/report/salesreg',
    'customer type wise':              '/report/customer',
    'salesman wise summary':           '/report/salesmanwisesummaryreport',
    'tax wise sales summary':          '/report/taxwisesalessummary',
    'tax wise report':                 '/report/taxwiseereport',
    'sales and sales return item register': '/report/salesandsalesreturnitemregister',
    // aliases people actually say that the table was missing
    'product ageing': '/report/productageingReport',
    'product aging': '/report/productageingReport',
    'cheque report': '/report/cheque',
    'outlet sales summary': '/report/outletsalessummary',
    'stock ledger report': '/report/stockledgerwithfilter',
    // New in VasyERP v9.13.0 — the purchase-side twin of the line above.
    'purchase and purchase return item register': '/report/purchaseandpurchasereturnitemregister',
    'purchase return item register':              '/report/purchaseandpurchasereturnitemregister',
    'purchase item register':                     '/report/purchaseandpurchasereturnitemregister',
    'credit note tax summary':         '/accountreport/taxsummary/creditnote',
    'credit note item register':       '/accountreport/salesitemregister/creditnote',
    'debit note tax summary':          '/accountreport/taxsummary/debitnote',
    'supplier wise purchase':          '/report/purchasereport/supplier',
    'qty wise purchase':               '/report/purchasereport/qty',
    'bill wise discount':              '/report/purchasereport/discount',
    'category name wise purchase':     '/report/purchasereport/category',
    'brand name wise purchase':        '/report/purchasereport/brand',
    'product name wise purchase':      '/report/purchasereport/product',
    'purchase price wise':             '/report/purchasereport/mrp',
    'pending purchase order':          '/report/pending-purchase-order-report',
    'partially received purchase order': '/report/pending-purchase-order-report',
    'supplier wise product':           '/report/supplierwiseproduct',
    'least selling product':           '/report/leastproduct',
    'suspended product':               '/report/suspendproduct',
    'loss qty report':                 '/report/stockverification',
    'cheque print':                    '/report/cheque',
    'vat report':                      '/report/vatreport',
};

async function fillReport(data) {
    await sleep(500);
    const reportName = (data.reportType || '').toLowerCase().trim();

    const matchedKey = Object.keys(REPORT_URLS).find(k =>
        reportName === k || reportName.includes(k) || k.includes(reportName)
    );
    const directUrl = REPORT_URLS[reportName] || (matchedKey ? REPORT_URLS[matchedKey] : null);

    // Setting location.href kills this script mid-function: the date range, the
    // account (General Ledger, Cash Book) and the product (Stock Ledger) were
    // never applied, and no "Report Opened" reply ever came back. Hand the whole
    // request across the navigation instead and finish it on the report page.
    if (directUrl) {
        const want = directUrl.split('?')[0].replace(/\/+$/, '');
        const here = location.pathname.replace(/\/+$/, '');
        if (here !== want && !data._arrived) {
            try {
                chrome.runtime.sendMessage({ action: 'inject_on_navigate', url: location.origin + directUrl,
                    script: 'content_agent.js', message: { action: 'fill_report', data: { ...data, _arrived: true } } });
            } catch (e) { window.location.href = location.origin + directUrl; }
            return;
        }
        await settle(2500);
    }
    const reportNotes = [];

    // Account selector (General Ledger, Cash Book)
    if (data.account || data.accountName) {
        const a = await fillSelect2('accountCustomVo', data.account || data.accountName);
        if (a === 'asked') return;
        if (!a) reportNotes.push(`couldn't pick the account "${data.account || data.accountName}"`);
    }

    // Product filter (Stock Ledger)
    if (data.product || data.productName) {
        const p = await fillSelect2('productList', data.product || data.productName);
        if (p === 'asked') return;
        if (!p) reportNotes.push(`couldn't pick the product "${data.product || data.productName}"`);
    }

    // Date filters — try multiple ID patterns
    const setDate = (value, primary, ...extras) => {
        const el = document.getElementById(primary) ||
                   extras.reduce((found, s) => found || pageQS(s), null);
        if (el && value) {
            setVal(el, value);
            window.jQuery?.(el).trigger('changeDate').trigger('change');
        }
    };
    // v9.12.0 added a separate "Creation Date" column + filter to the Debit Note
    // Register, Purchase Register and Purchase Item Register. Default to the
    // TRANSACTION date; only use the creation-date filter when asked for it.
    const wantsCreated = /\bcreat(?:ed|ion)\b/i.test(data.reportType || '') || !!data.byCreationDate;
    const dateInputs = () => [...pageQSA('input')].filter(i => i.offsetParent &&
        /date/i.test((i.id || '') + ' ' + (i.name || '') + ' ' + labelNear(i) + ' ' + (i.placeholder || '')));
    const isCreationField = (i) => /creat/i.test((i.id || '') + ' ' + (i.name || '') + ' ' + labelNear(i) + ' ' + (i.placeholder || ''));
    const preferredDateField = (which) => {
        const cands = dateInputs().filter(i => new RegExp(which, 'i').test((i.id || '') + ' ' + (i.name || '') + ' ' + labelNear(i)));
        return cands.find(i => wantsCreated ? isCreationField(i) : !isCreationField(i)) || cands[0] || null;
    };
    if (data.fromDate) {
        const el = preferredDateField('from|start');
        if (el) { setVal(el, data.fromDate); window.jQuery?.(el).trigger('changeDate').trigger('change'); }
        else setDate(data.fromDate, 'fromDate', 'input[id*="fromDate"]', 'input[name="fromDate"]');
    }
    if (data.toDate) {
        const el = preferredDateField('to\\b|end');
        if (el) { setVal(el, data.toDate); window.jQuery?.(el).trigger('changeDate').trigger('change'); }
        else setDate(data.toDate, 'toDate', 'input[id*="toDate"]', 'input[name="toDate"]');
    }

    if (!directUrl) {
        // The hub lists ~90 reports by name (Stock Ageing Report, GSTR 1, Trial
        // Balance, Day Book...). Fuzzy-match the whole name instead of guessing
        // URLs — that covers every report the tenant actually has.
        const cands = [...pageQSA('a,button,.card-body,li')]
            .filter(l => l.offsetParent && l.children.length <= 2)
            .map(l => ({ el: l, txt: (l.innerText || '').replace(/\s+/g, ' ').trim() }))
            .filter(c => c.txt.length > 2 && c.txt.length < 60);
        const scored = cands.map(c => ({ ...c, sc: vasyFuzzy(reportName, c.txt) })).sort((a, b) => b.sc - a.sc);
        const best = scored[0];
        if (!best || best.sc < 0.5) {
            reply('error', null, `I couldn't find a report called "<b>${data.reportType}</b>" on this hub.` +
                (scored.length ? ` Closest: ${scored.slice(0, 3).map(s => s.txt.slice(0, 34)).join(' / ')}` : ''));
            return;
        }
        if (scored[1] && best.sc - scored[1].sc < 0.06 && best.sc < 0.97) {
            reply('error', null, `Which report did you mean? (${scored.slice(0, 3).map(s => s.txt.slice(0, 34)).join('/')})`);
            return;
        }
        best.el.click();
        await settle(1800);
    }

    // Filters only take effect when the report's own Search/Go button is pressed.
    // Reading a report is harmless, so press it rather than leave stale figures.
    const filtered = !!(data.fromDate || data.toDate || data.account || data.accountName || data.product || data.productName);
    if (filtered) {
        const go = [...pageQSA('button,input[type=button],input[type=submit],a.btn')]
            .filter(b => b.offsetParent && !isChromeEl(b) && b.id !== 'vasy-fab')
            .find(b => /^(?:search|go|apply|show|view|filter|get\s+report|show\s+report|generate(?:\s+report)?)$/i
                        .test((b.innerText || b.value || '').replace(/\s+/g, ' ').trim()));
        // Most VasyERP reports have no Search button at all — they reload on
        // change (measured: Sales Register, General Ledger). So don't complain
        // about a missing button; check the filter actually holds instead.
        if (go) go.click();
        await settle(2000);
        const holds = (want, re) => !want || dateInputs().some(i => re.test((i.id || '') + ' ' + (i.name || '')) && i.value === want);
        if (!holds(data.fromDate, /from|start/i) || !holds(data.toDate, /todate|to_date|enddate|\bto\b/i))
            reportNotes.push(`couldn't confirm the date range ${data.fromDate || ''} – ${data.toDate || ''} took effect — check the dates at the top`);
    }
    reply(reportNotes.length ? 'info' : 'success', 'Report Opened',
        `<b>${data.reportType}</b>${data.fromDate ? ` · ${data.fromDate} to ${data.toDate||'today'}` : ''}` +
        (reportNotes.length ? `<br><small>Note: I ${reportNotes.join('; ')}.</small>` : '') +
        `<br><small style="color:#888">Ask me a question about it — e.g. "total" or "top 5 rows" — and I'll read the answer off the page.</small>`
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS CONTROL — flips any MUI/checkbox switch on the React settings pages
// by fuzzy label match; hops across /setting/* pages until the switch is found.
// ═══════════════════════════════════════════════════════════════════════════════
// V9.14.0 "Stock Selection Method" (Items settings → Stock & Movement): two MUI
// tiles, FIFO | LIFO, with no input behind them. The chosen tile is tinted
// (blue border, light-blue fill); the other is white. Read it and click it like a person.
async function chooseSettingTile(data) {
    const name = data.settingName || '';
    const cap = await waitForEl(() => [...pageQSA('p,span,label,h6,div')].find(e => !e.children.length &&
        e.getClientRects().length && vasyNorm((e.innerText || '').trim()) === vasyNorm(name)), 8000);
    if (!cap) {
        const pages = Array.isArray(data.pages) ? data.pages.slice() : [];
        if (pages.length) {
            const next = pages.shift();
            chrome.runtime.sendMessage({ action: 'inject_on_navigate', url: location.origin + next,
                message: { action: 'toggle_setting', data: { ...data, pages } } });
            return;
        }
        reply('error', null, `I couldn't find <b>${name}</b> on the settings pages.`);
        return;
    }
    const leaves = b => [...b.querySelectorAll('p,span')].filter(e => !e.children.length && e.getClientRects().length
        && e !== cap && (e.innerText || '').trim().length && (e.innerText || '').trim().length <= 24);
    let box = cap;
    for (let i = 0; i < 6 && box.parentElement && leaves(box).length < 2; i++) box = box.parentElement;
    const tiles = leaves(box).map(p => ({ el: p.parentElement, t: (p.innerText || '').trim() }));
    if (tiles.length < 2) { reply('error', null, `I found <b>${name}</b> but not its options.`); return; }
    // Selected = the coloured BORDER (rgb(0,129,182) vs grey rgb(219,225,230)). The fill
    // alone is not proof: a mouse resting over the other tile tints it the same way
    // (live, the reader once said LIFO while FIFO was set). Fill is only a fallback.
    const chroma = c => { const m = String(c || '').match(/\d+(\.\d+)?/g); if (!m || m.length < 3) return 0; const [r, g, b] = m.slice(0, 3).map(Number); return Math.max(r, g, b) - Math.min(r, g, b); };
    const byBorder = x => chroma(getComputedStyle(x.el).borderTopColor) > 60;
    const byFill = x => { const bg = getComputedStyle(x.el).backgroundColor; return bg && !/^rgba?\(255,\s*255,\s*255|^rgba\(0,\s*0,\s*0,\s*0\)|^transparent$/.test(bg); };
    const isOn = x => tiles.some(byBorder) ? byBorder(x) : byFill(x);
    const cur = tiles.find(isOn);
    const opts = tiles.map(x => x.t).join(' / ');
    if (data.desired === 'check' || !data.settingValue) {
        reply('success', null, `<b>${name}</b> is <b>${cur ? cur.t : 'not chosen'}</b>.<br><small>Options: ${opts}</small>`);
        return;
    }
    const want = tiles.find(x => vasyNorm(x.t) === vasyNorm(data.settingValue));
    if (!want) { reply('error', null, `<b>${name}</b> takes ${opts} — not "<b>${data.settingValue}</b>". Nothing was changed.`); return; }
    if (cur === want) { reply('success', null, `<b>${name}</b> is already <b>${want.t}</b> — nothing to change.`); return; }
    want.el.click();
    await settle(1300);
    const saveBtn = [...pageQSA('button')].find(b => b.offsetParent && /^(save|update)$/i.test((b.innerText || '').trim()));
    if (saveBtn) { saveBtn.click(); await sleep(800); }
    if (isOn(want)) reply('success', 'Setting Updated', `<b>${name}</b>: ${cur ? cur.t : '—'} → <b>${want.t}</b> ✅`);
    else reply('error', null, `I clicked <b>${want.t}</b> for ${name} but it didn't take — your user role may not have permission for this setting.`);
}

async function toggleSetting(data) {
    await settle(2500);   // React settings sections render lazily
    if (data.kind === 'c') return chooseSettingTile(data);
    const wantValue = data.desired === 'set';
    const labelOf = (t) => {
        let lbl = '';
        const l1 = t.closest('label'); if (l1) lbl = (l1.innerText || '').trim();
        if (!lbl && t.labels && t.labels[0]) lbl = (t.labels[0].innerText || '').trim();          // native <label for>
        if (!lbl) lbl = (t.getAttribute('aria-label') || '').trim();                              // MUI aria
        if (!lbl) {
            const prev = t.previousElementSibling || t.parentElement?.previousElementSibling;     // label-above layouts
            const pt = prev ? (prev.innerText || '').trim().split('\n')[0] : '';
            if (pt && pt.length > 3 && pt.length < 70) lbl = pt;
        }
        if (!lbl) {
            let p = t.parentElement;
            for (let i = 0; i < 4 && p; i++) {
                const tx = (p.innerText || '').trim().split('\n')[0];
                if (tx && tx.length > 3 && tx.length < 70) { lbl = tx; break; }
                p = p.parentElement;
            }
        }
        return lbl;
    };
    // GEOMETRIC FALLBACK. The redesigned settings pages lay each row out as two
    // independent columns — the caption in one, the switch in another — so the
    // caption is nowhere in the switch's ancestry and every DOM-walk above comes
    // back empty. That made toggleSetting trudge through every settings page and
    // report "not found" for switches plainly on screen. Pair them the way a
    // person does: the caption is the nearest text to the LEFT on the same row.
    // (Two columns per page, so the second column's switch is far to the right —
    // taking the smallest positive gap is what keeps them apart.)
    const captionNodes = () => [...pageQSA('p,span,div,label,h6')]
        .filter(e => e.children.length === 0 && e.getClientRects().length && !isChromeEl(e))
        .map(e => ({ t: (e.innerText || '').replace(/\s+/g, ' ').trim(), r: e.getBoundingClientRect() }))
        .filter(x => x.t.length > 3 && x.t.length < 70);
    const labelByRow = (el, caps) => {
        const rect = el.getBoundingClientRect();
        if (!rect.width && !rect.height) return '';
        const mid = rect.top + rect.height / 2;
        let best = '', bestGap = 1e9;
        for (const c of caps) {
            if (Math.abs((c.r.top + c.r.height / 2) - mid) > 26) continue;   // same row
            const gap = rect.left - c.r.right;                               // caption on the left
            if (gap < 0 || gap > 760) continue;
            if (gap < bestGap) { bestGap = gap; best = c.t; }
        }
        return best;
    };
    const collect = () => {
        // Value settings live in selects/number/text inputs; toggles in checkboxes.
        const sel = wantValue
            ? 'select,input[type="number"],input[type="text"],input:not([type])'
            : 'input[type="checkbox"],[role="switch"]';
        const cands = [...pageQSA(sel)]
            .filter(e => e.offsetParent || e.closest('label,[class*="MuiSwitch"]')?.offsetParent);
        const caps = captionNodes();
        // Keep BOTH readings and let the scorer decide. labelOf()'s last resort
        // walks up four ancestors and takes the first text it finds, which on the
        // redesigned pages is a section heading — non-empty, plausible, and wrong.
        // Because it was truthy it short-circuited the row-geometry reading that
        // actually identifies the switch, so the correct label was never scored.
        return cands.map(t => ({ t, lbls: [labelOf(t), labelByRow(t, caps)].filter(Boolean) }))
                    .filter(x => x.lbls.length);
    };
    let switches = collect();
    const end = Date.now() + 6000;
    while (switches.length < 3 && Date.now() < end) { await sleep(700); switches = collect(); }

    const name = data.settingName || '';
    const scored = switches.map(s => {
        let sc = 0, lbl = s.lbls[0];
        for (const cand of s.lbls) { const v = vasyFuzzy(name, cand); if (v > sc) { sc = v; lbl = cand; } }
        return { ...s, sc, lbl };
    }).sort((a, b) => b.sc - a.sc);
    const best = scored[0];

    if (!best || best.sc < 0.5) {
        // Not on this page — hop to the next candidate settings page
        const pages = Array.isArray(data.pages) ? data.pages.slice() : [];
        if (pages.length) {
            const next = pages.shift();
            chrome.runtime.sendMessage({ action: 'inject_on_navigate', url: location.origin + next,
                message: { action: 'toggle_setting', data: { ...data, pages } } });
            return;
        }
        reply('error', null, `Setting "<b>${name}</b>" not found on any settings page I know (POS / Items / Purchase / Sales / General). It may live in a sub-section — open Settings and tell me the exact switch name.`);
        return;
    }
    if (scored[1] && best.sc - scored[1].sc < 0.08 && best.sc < 0.97) {
        askChoice('Which setting?', `Multiple settings match "<b>${name}</b>" — which one did you mean?`, name,
            scored.slice(0, 4).map(x => ({ label: x.lbl.slice(0, 60), value: x.lbl.slice(0, 60) })));
        return;
    }

    // ── Value settings: "set no. of previous bill to 5" ──────────────────────
    if (wantValue) {
        const el = best.t, val = String(data.settingValue || '').trim();
        const before = el.tagName === 'SELECT'
            ? (el.options[el.selectedIndex]?.text || '').trim()
            : el.value;
        if (el.tagName === 'SELECT') {
            const opt = vasyBest(val, [...el.options], o => (o.text || '').trim(), 0.4);
            if (!opt) {
                reply('error', null, `<b>${best.lbl}</b> has no option like "<b>${val}</b>". Available: ${[...el.options].map(o => (o.text || '').trim()).filter(Boolean).slice(0, 6).join(' / ')}`);
                return;
            }
            el.value = opt.item.value;
            el.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            // React text/number input — use the native setter so React sees it
            const setter = Object.getOwnPropertyDescriptor(
                el.type === 'number' ? HTMLInputElement.prototype : Object.getPrototypeOf(el).constructor.prototype, 'value')?.set
                || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            el.focus();
            if (setter) setter.call(el, val); else el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.blur();
        }
        await sleep(900);
        const after = el.tagName === 'SELECT'
            ? (el.options[el.selectedIndex]?.text || '').trim()
            : el.value;
        const saveBtn = [...pageQSA('button')].find(b => b.offsetParent && /^(save|update)$/i.test((b.innerText || '').trim()));
        if (saveBtn) { saveBtn.click(); await sleep(800); }
        if (vasyFuzzy(val, after) >= 0.5 || after === val) {
            reply('success', 'Setting Updated', `<b>${best.lbl}</b>: ${before || '(empty)'} → <b>${after}</b> ✅`);
        } else {
            reply('error', null, `I set <b>${best.lbl}</b> to "<b>${val}</b>" but it reads back as "<b>${after}</b>" — your role may not have permission, or this field needs a specific format.`);
        }
        return;
    }

    const cur = !!best.t.checked;
    if (data.desired === 'check') {
        reply('success', null, `<b>${best.lbl}</b> is currently <b>${cur ? 'ON ✅' : 'OFF ⭕'}</b>.`);
        return;
    }
    const want = data.desired === 'on' ? true : data.desired === 'off' ? false : !cur;
    if (cur === want) {
        reply('success', null, `<b>${best.lbl}</b> is already <b>${want ? 'ON ✅' : 'OFF ⭕'}</b> — nothing to change.`);
        return;
    }
    best.t.click();
    await settle(1300);
    const now = !!best.t.checked;
    if (now === want) {
        // Some sections carry an explicit Save/Update
        const saveBtn = [...pageQSA('button')].find(b => b.offsetParent && /^(save|update)$/i.test((b.innerText || '').trim()));
        if (saveBtn) { saveBtn.click(); await sleep(800); }
        reply('success', 'Setting Updated', `<b>${best.lbl}</b>: ${cur ? 'ON' : 'OFF'} → <b>${now ? 'ON ✅' : 'OFF ⭕'}</b>`);
    } else {
        reply('error', null, `I clicked <b>${best.lbl}</b> but the state didn't change — your user role may not have permission for this setting.`);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE RECEIPT — sales-side mirror: invoice list → id → /receipt/new?salesId
// ═══════════════════════════════════════════════════════════════════════════════
async function collectInvoice(data) {
    const invNo = (data.invoiceNumber || '').trim();
    if (!invNo) { reply('error', null, 'Which invoice number should I collect against?'); return; }
    await settle(1200);
    await searchInTable(invNo);
    await settle(2200);
    // The invoice link's href carries the internal id — no fragile clicking needed.
    const link = [...pageQSA('a[href*="/sales/invoice/"]')].find(a =>
        a.offsetParent && (a.innerText || '').trim().toUpperCase() === invNo.toUpperCase());
    if (!link) {
        reply('error', null, `Invoice "<b>${invNo}</b>" not found in the Invoice list. Check the number (and the FY selector) and try again.`);
        return;
    }
    const idM = (link.getAttribute('href') || '').match(/\/sales\/invoice\/(\d+)/);
    if (!idM) { reply('error', null, `Couldn't read the internal id for <b>${invNo}</b> — open the invoice and use Receive Payment manually.`); return; }
    chrome.runtime.sendMessage({
        action: 'inject_on_navigate',
        url: location.origin + '/receipt/new?salesId=' + idM[1],
        message: { action: 'complete_invoice_receipt', data: { amount: data.amount || '', paymentMode: data.paymentMode || 'Cash', invoiceNumber: invNo } }
    });
}

async function completeInvoiceReceipt(data) {
    await settle(2000);
    // Bank mode? flip the radio and pick the first real bank
    if (/bank|neft|rtgs|imps|upi|card/i.test(data.paymentMode || '')) {
        const bankRadio = pageQS('input[name="receiptMode"][value="bank"]');
        if (bankRadio && !bankRadio.checked) { bankRadio.click(); await sleep(500); }
        const bankSel = document.getElementById('bankVo');
        if (bankSel && bankSel.options.length > 1) { bankSel.value = bankSel.options[1].value; bankSel.dispatchEvent(new Event('change', { bubbles: true })); }
    } else {
        // Cash type — pick "Cash (Cash in Hand)" (or the first cash account)
        const cashSel = document.getElementById('cashdropdown');
        if (cashSel) {
            const opt = [...cashSel.options].find(o => /^cash\s*\(/i.test((o.text || '').trim())) || cashSel.options[1];
            if (opt) { cashSel.value = opt.value; cashSel.dispatchEvent(new Event('change', { bubbles: true })); await sleep(400); }
        }
    }
    // Custom partial amount (default: the prefilled full due)
    if (data.amount && data.amount !== 'FULL') {
        smartSet(data.amount, { label: /^receipt\s*amount|^payment\s*amount|^amount\b/i });
    }
    // Sanity: the invoice row must be prefilled (fully-collected invoices come up empty)
    if (data.invoiceNumber && !new RegExp(data.invoiceNumber, 'i').test(pageText())) {
        reply('info', null, `Receipt form opened, but <b>${data.invoiceNumber}</b> isn't in the pending list — it may already be fully collected. Check the invoice's Due Amount.`);
        return;
    }
    watchResult('Receipt Recorded', ['/receipt/'], 'Receipt saved — the invoice status will update to Paid.');
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on the Receipt form.');
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERIC SETUP-MASTER CREATOR — one handler for every "New → name → Save" page
// (UOM, Tax, Prefix, Payment Terms, Charges, Account Group, Bank, Department…).
// The spec (title / new-button text / name-field text / extra-field text) is
// supplied by background.js, so adding a master costs one config line there.
// ═══════════════════════════════════════════════════════════════════════════════
async function createSimpleMaster(entity, data, spec) {
    spec = spec || {};
    const title  = spec.title || entity;
    const nameRe = new RegExp(spec.nameRe || 'name', 'i');
    const newRe  = new RegExp(`^(?:\\+\\s*)?(?:${spec.newRe || 'new|add'})\\b`, 'i');
    if (!data.name) { reply('error', null, `What should the new ${title.toLowerCase()} be called?`); return; }
    await settle(1800);

    // 1. Open the create form — many of these pages use a modal, some a route.
    //    These panels are React and can take several seconds, so POLL instead of
    //    a fixed sleep (a fixed 1.4s wait was missing the Customer Category form).
    const DIALOG_SEL = '.modal,[role="dialog"],[class*="Dialog"],[class*="drawer"],[class*="Drawer"],[class*="offcanvas"]';
    const fieldsIn = (sc) => [...sc.querySelectorAll('input,textarea')].filter(i =>
        i.offsetParent && !['checkbox','radio','hidden','search','file','submit','button'].includes(i.type)
        && !/search/i.test(i.placeholder || ''));
    // Taking the FIRST match was wrong twice over: the page wrapper itself can
    // match this selector, and MUI renders its dialog in a portal OUTSIDE that
    // wrapper — so the "dialog" scope contained none of the dialog's fields and
    // the name went into the pagination control. Take the most specific visible
    // container that actually holds an editable field, and never one that still
    // has the page chrome inside it.
    const scopeNow = () => {
        const cands = [...pageQSA(DIALOG_SEL)].filter(m =>
            m.offsetParent && fieldsIn(m).length &&
            !m.querySelector('nav,#sidebar-menu,.m-aside,.m-header'));
        if (!cands.length) return document;
        return cands.sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0];
    };
    const findName = () => {
        const sc = scopeNow();
        const f  = fieldsIn(sc);
        // MUI floats its labels, so labelNear() often reads back a zero-width
        // space — the name/id attribute (customerCategoryName) is the stable hook.
        return f.find(i => nameRe.test((i.placeholder || '') + ' ' + (i.name || '') + ' ' + (i.id || '') + ' ' + labelNear(i)))
            || (sc !== document ? f[0] : null);   // inside a dialog, the first real input is the name
    };
    // Some masters sit on a TAB of a shared page (v9.13.0: customer categories
    // are the "Customer Categories" tab of Price-mapping). Open the tab first.
    if (spec.tab) {
        const tabRe = new RegExp('^' + spec.tab, 'i');
        const tab = [...pageQSA('button,[role=tab],a')].find(b => b.offsetParent && tabRe.test((b.innerText || '').trim()));
        if (tab) { tab.click(); await settle(1500); }
    }
    // UOM: Unit Code* and No of Decimal Places* are compulsory. A count unit
    // (box, pack, piece) has no decimals, and the code is conventionally the name
    // in capitals — default both and say so, rather than fail on the Save.
    if (entity === 'UnitOfMeasurement') {
        if (!data.code) { data.code = String(data.name).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10); data._defaulted = (data._defaulted || []).concat(`unit code ${data.code}`); }
        if (data.decimals == null || data.decimals === '') { data.decimals = '0'; data._defaulted = (data._defaulted || []).concat('0 decimal places'); }
    }
    let nameInp = findName();
    if (!nameInp) {
        const btn = [...pageQSA('button,a')].find(b =>
            b.offsetParent && newRe.test((b.innerText || '').trim()) && (b.innerText || '').trim().length < 30);
        if (!btn) {
            // No create button at all — this page only lists (e.g. Account Group
            // here offers Export and nothing else). Say that plainly instead of
            // typing the name into whatever box is left.
            reply('info', null,
                `The <b>${title}</b> page on this account only lists records — there's no New/Add button, so I can't create one here. ` +
                `<b>Nothing was saved.</b><br><small>Your role may lack create rights for it, or VasyERP creates it from another screen.</small>`);
            return;
        }
        if (btn) {
            btn.click();
            const end = Date.now() + 7000;
            while (Date.now() < end && !(nameInp = findName())) await sleep(400);
        }
    }
    // Last resort on a plain page: the first non-search text input
    if (!nameInp) nameInp = fieldsIn(document)[0];
    const scope  = scopeNow();
    const fields = fieldsIn(scope);
    if (!nameInp) {
        reply('info', `${title} Page Opened`,
            `The ${title.toLowerCase()} form is open but I couldn't identify its name field. Type "<b>${data.name}</b>" in and press Save — then tell me the exact field label and I'll automate it.`);
        return;
    }
    nameInp.focus();
    setVal(nameInp, data.name);
    await sleep(300);
    if (nameInp.value !== data.name) {
        reply('error', null, `I couldn't type into the ${title.toLowerCase()} name field (it read back as "${nameInp.value}"). Your role may not allow creating this master.`);
        return;
    }

    // 3. Optional value (tax %, term days, charge amount, opening balance…)
    if (data.value && spec.extra) {
        const extraRe = new RegExp(spec.extra, 'i');
        const valInp = fields.find(i => i !== nameInp &&
                            extraRe.test((i.placeholder || '') + ' ' + (i.name || '') + ' ' + (i.id || '') + ' ' + labelNear(i)))
                    || fields.find(i => i !== nameInp && (i.type === 'number' || /^\d*\.?\d*$/.test(i.value || '')));
        if (valInp) setVal(valInp, data.value);
        else { reply('info', null, `<b>${data.name}</b> is filled in, but I couldn't place the value <b>${data.value}</b> — add it and press Save.`); return; }
        await sleep(250);
    }

    // 3b. Extra labelled fields declared by the spec (real labels from recon):
    //     e.g. UOM's "Unit Code" / "No of Decimal Places", Bank's "Account no.".
    if (Array.isArray(spec.fields)) {
        for (const f of spec.fields) {
            const v = data[f.key];
            if (v == null || v === '') continue;
            const re = new RegExp(f.re, 'i');
            const sel = [...scope.querySelectorAll('select')].find(s => s.offsetParent && re.test(labelNear(s)));
            if (sel) {
                const opt = vasyBest(String(v), [...sel.options], o => (o.text || '').trim(), 0.4);
                if (opt) { sel.value = opt.item.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
                continue;
            }
            // These dialogs use react-select, which renders NO native <select> —
            // UOM's UQC Code and Bank's Account Group would silently stay empty.
            if (findReactSelectInput(re)) { await fillReactSelect(re, String(v), 2000, f.key); continue; }
            // Match on name/id too: MUI floats its labels, so labelNear() reads
            // back a zero-width space and "unit code" only matches id="unitCode".
            const inp = fields.find(i => i !== nameInp &&
                re.test((i.placeholder || '') + ' ' + (i.name || '') + ' ' + (i.id || '') + ' ' + labelNear(i)));
            if (inp) { setVal(inp, v); await sleep(150); }
        }
    }

    // UOM also needs a UQC Code* — the GST unit code (BOX-BOX, BAG-BAGS…) in a
    // react-select. Take it from "uqc …" if the user said it, else from the
    // unit's own word when that is unambiguous; otherwise ASK, never guess.
    if (entity === 'UnitOfMeasurement') {
        const rsInputs = [...pageQSA('input[id^="react-select-"]')].filter(i => i.getClientRects().length);
        // the DIALOG's select first: the list behind it has a "UQC CODE" column
        // header next to its own page-size react-select, which matched before
        const uqcInp = rsInputs.find(i => i.closest('[role=dialog],.MuiDialog-root,.modal')) || rsInputs.find(i => /uqc/i.test((i.closest('[class*="col"],.MuiFormControl-root,.MuiGrid-item') || i.parentElement?.parentElement?.parentElement || {}).innerText || ''))
                    || (scope !== document ? scope.querySelector('input[id^="react-select-"]') : null);
        if (uqcInp) {
            const word = String(data.uqc || (String(data.name).match(/[A-Za-z]{2,}/) || [data.name])[0]);
            const r = await chooseReactSelectInput(uqcInp, word);
            if (!String(r).startsWith('ok:')) {
                reply('info', 'Which UQC code?',
                    `VasyERP needs a <b>UQC Code</b> (the GST unit code) for <b>${data.name}</b>, and I can't tell which one it is. <b>Nothing was saved.</b>` +
                    `<br><small>${String(r).startsWith('nooption:') && r.length > 9 ? 'Closest: ' + r.slice(9) + '. ' : ''}` +
                    `Say e.g. <i>"create uom ${data.name} uqc OTH"</i> (OTH-OTHERS fits anything unusual).</small>`);
                return;
            }
            if (!data.uqc) data._defaulted = (data._defaulted || []).concat(`UQC ${r.slice(3)}`);
        }
    }
    watchResult(`${title} Created`, [], `${title} “${data.name}” saved.` +
        (data._defaulted && data._defaulted.length ? ` I used ${data._defaulted.join(' and ')} — change them on the ${title.toLowerCase()} if needed.` : ''));
    if (!clickSaveBtn(scope) && !clickSaveBtn()) reply('error', null, `Save button not found on the ${title.toLowerCase()} form.`);
}

// Editable fields that belong to the PAGE's own form — never the surrounding
// chrome. The support widget's "Search shortcuts…" box, the list search box and
// the "20 / Page" pager are on every screen, so any heuristic that counts raw
// inputs to decide "is there a form here?" silently breaks when the ERP adds
// another piece of furniture.
function pageFormFields(scope) {
    return [...(scope || document).querySelectorAll('input:not([type=hidden]),textarea')].filter(el => {
        if (!el.offsetParent || el.id === 'global_search_web') return false;
        if (['checkbox','radio','search','file','submit','button','image','reset'].includes(el.type)) return false;
        if (/search|jump to anywhere/i.test(el.placeholder || '')) return false;
        if (isChromeEl(el)) return false;
        // the "20 / Page" pager is a react-select, not a form field
        if (/^react-select-\d+-input$/.test(el.id || '') && /\/\s*page/i.test(labelNear(el) || '')) return false;
        return true;
    });
}

// ── Shared success/error vocabulary ───────────────────────────────────────────
// These used to live INSIDE watchResult, which meant any handler that finished
// its own way (POS payment, modal saves) had no way to ask "did the page just
// complain?" — so it asserted success instead. Module scope so every path can check.
// 'inserted' is VasyERP's own wording on modal saves ("Record Inserted....").
// Leaving it out made every successful category and brand save look like a
// 45-second timeout — a false NEGATIVE, which erodes trust as fast as a
// false success does.
const VASY_SUCCESS = ['success','saved','created','added','updated','submitted','generated','recorded','inserted','done'];
// A QUESTION is never a result: "A Tax Invoice will be generated. Do you want to
// continue?" contains "generated" and was reported as a saved invoice while the
// invoice sat unsaved behind the dialog. Any SweetAlert carrying buttons counts —
// even mid-render, before its text has landed.
function isQuestionNode(node, text) {
    const t = String(text || (node && node.innerText) || '');
    const swal = node && node.nodeType === 1 && (node.closest?.('.swal2-popup,.swal2-container') || node.querySelector?.('.swal2-popup'));
    if (swal && swal.querySelector('.swal2-confirm, .swal2-cancel')) {
        const whole = (swal.innerText || '') + ' ' + t;
        if (/\?|do you want|are you sure|\bconfirm/i.test(whole) || (swal.querySelector('.swal2-cancel') || {}).offsetParent) return true;
    }
    return /\?\s*$|\bdo you want\b|\bare you sure\b|^\s*confirm\b/i.test(t);
}
const VASY_ERRORS  = ['already exist','already registered','required field','mobile.*already','invalid','failed','duplicate','not allowed','error occurred','please enter','please select','please fill','cannot be','is required','are required','must be a valid','greater than 0','already used','already in use'];
// UI hints that LOOK like errors but never are — select2 shows "Please enter
// 1 or more characters" in every dropdown; matching it killed live flows.
const VASY_IGNORE  = ['please enter 1 or more character','no results found','searching…','searching...','please wait','loading'];
const VASY_ERR_SELECTORS = '.text-danger,.invalid-feedback,.error,.is-invalid,.help-block.error,.field-validation-error,.swal2-validation-message,[class*="error" i],[class*="danger" i]';

// Page furniture that sits on EVERY screen and must never be mistaken for the
// page's own content: nav, header, and the Help/Support sidebars (which carry
// their own tables of keyboard shortcuts, downloads and sessions).
const VASY_CHROME_SEL = 'nav,header,.navbar,#sidebar-menu,.m-aside,.m-header,' +
    '.supportSidebar__panel,[class*="supportSidebar" i],[class*="helpSidebar" i],[class*="pagination" i]';
function isChromeEl(el) {
    try { return !!(el && el.closest && el.closest(VASY_CHROME_SEL)); } catch (e) { return false; }
}

// A SweetAlert-style confirmation the ERP itself raises in place of saving.
// Returns {text, confirm, cancel} or null. Kept separate from our own
// confirm-before-save gate: this one is VasyERP asking, in its own words.
// ERP questions that only name the document type a save will produce.
const SAFE_ERP_CONFIRM = /\b(?:tax\s+invoice|bill\s+of\s+supply|invoice)\s+will\s+be\s+generated\b|^confirm\s+document\s+generation\b/i;
function erpConfirmDialog() {
    const pop = [...pageQSA('.swal2-popup, .swal2-modal')].find(p => p.offsetParent);
    if (!pop) return null;
    const confirm = pop.querySelector('.swal2-confirm');
    const cancel  = pop.querySelector('.swal2-cancel');
    if (!confirm || !confirm.offsetParent) return null;   // plain alert, not a question
    const text = (pop.innerText || '').replace(/\s+/g, ' ')
        .replace(/\s*(yes|no|ok|cancel|confirm)\s*$/ig, '').replace(/^!\s*/, '').trim();
    return { text: text.slice(0, 240), confirm, cancel, pop };
}

// The visible blocking error on the page right now, or '' if there is none.
function visibleErrorText() {
    for (const n of pageQSA(VASY_ERR_SELECTORS)) {
        if (!n.offsetParent) continue;
        const text = (n.innerText || n.textContent || '').replace(/\s+/g, ' ').trim();
        if (text.length < 3 || text.length > 300) continue;
        if (VASY_IGNORE.some(w => text.toLowerCase().includes(w))) continue;
        if (VASY_ERRORS.some(w => new RegExp(w, 'i').test(text))) return text;
    }
    return '';
}

// Nearest human-readable text for an input — label, aria, or preceding cell.
function labelNear(el) {
    try {
        if (el.labels && el.labels[0]) return el.labels[0].innerText || '';
        const l = el.closest('label'); if (l) return l.innerText || '';
        if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
        const prev = el.previousElementSibling || el.parentElement?.previousElementSibling;
        return prev ? (prev.innerText || '').split('\n')[0] : '';
    } catch (e) { return ''; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VINA AI — the advisory chatbot. Our agent DOES things; Vina ANALYSES. When the
// user asks an advisory question we hand it to Vina, then offer to turn Vina's
// product suggestions into a real Purchase Order.
// ═══════════════════════════════════════════════════════════════════════════════
async function askVina(data) {
    await settle(2500);
    const q = (data.question || '').trim();
    // Recon 06/09/2026 on expo: the composer is a bare <textarea> with NO
    // placeholder at all (the old "Ask vina about your business…" text is gone),
    // and the page footer says "Enter to send, Shift+Enter for newline". Match the
    // textarea directly, ignoring the Help/Support widget that sits on every page.
    const box = await waitForEl(() =>
        [...pageQSA('textarea')].find(i => i.offsetParent && !isChromeEl(i))
        || [...pageQSA('textarea,input[type="text"]')].find(i => i.offsetParent && !isChromeEl(i) &&
            /ask\s*vina|about\s*your\s*business|ask|message|question|chat/i.test((i.placeholder || '') + ' ' + labelNear(i)))
    , 8000);
    if (!box) {
        reply('info', 'VinaAI Opened',
            q ? `Vina is open — paste your question there:<br><i>${q}</i><br><small>Once Vina lists products, say <b>"create purchase order from vina"</b> and I'll turn them into a PO.</small>`
              : 'VinaAI is open — ask it anything about your data.');
        return;
    }
    if (!q) { reply('success', 'VinaAI Opened', 'Ask Vina anything about your data — then say <b>"create purchase order from vina"</b> to act on its answer.'); return; }
    vinaSnapshot();   // remember the page BEFORE asking, so we can diff the answer
    box.focus();
    setVal(box, q);
    await sleep(400);
    // Submit — Enter first (most chat UIs), then an explicit send button
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    await sleep(600);
    if (box.value === q) {
        const send = [...pageQSA('button')].find(b => b.offsetParent &&
            (/send|ask|submit/i.test((b.innerText || '') + ' ' + (b.title || '') + ' ' + (b.getAttribute('aria-label') || ''))
             || b.querySelector('svg')) && !/cancel|close|clear|new\s*chat|history|help/i.test(b.innerText || ''));
        if (send) send.click();
        // Vina's own footer: "Enter to send, Shift+Enter for newline" — use that
        // if no send button matched (the button is an icon on some builds).
        else {
            box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            box.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        }
    }
    await settle(1200);
    // Wait for Vina's answer, then bring it INTO our chat so the user never has
    // to switch panes. Stability check: same text twice = streaming finished.
    // Preferred path: snapshot-diff reader (robust to card/bullet layouts)
    const __fresh = await waitForVinaAnswer(q, 45000);
    if (__fresh) { showVinaAnswer(q, __fresh); return; }
    const baseline = pageText().length;
    let prev = '', stable = 0, answer = '';
    const end = Date.now() + 45000;
    while (Date.now() < end) {
        await settle(1500);
        const txt = pageText();
        if (txt.length <= baseline + 40) continue;         // nothing new yet
        const idx = txt.lastIndexOf(q);
        const after = (idx >= 0 ? txt.slice(idx + q.length) : '')
            .split('\n').map(s => s.trim())
            .filter(s => s && !/^(ask vina|new chat|history|help\/faq|send|stop|copy|regenerate)$/i.test(s))
            .join('\n').trim();
        if (!after) continue;
        if (after === prev) { stable++; if (stable >= 2) { answer = after; break; } }
        else { prev = after; stable = 0; }
    }
    if (!answer) {
        reply('info', 'Asked Vina', `I sent your question to Vina:<br><i>${q}</i><br><small>The answer is still coming. Once it lists products, say <b>"create purchase order from vina"</b> and I'll build the PO from it.</small>`);
        return;
    }
    const shown = answer.length > 1400 ? answer.slice(0, 1400) + '…' : answer;
    const looksLikeProducts = /^(?:[-•*]|\d+[.)])\s+/m.test(answer);
    reply('success', 'Vina says',
        `<i>${q}</i><br><br>${shown.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>')}` +
        (looksLikeProducts ? `<br><br><small style="color:#888">Want to act on this? Say <b>"create purchase order from vina"</b> and I'll turn those products into a PO.</small>` : ''));
}

// Read Vina's answer by DIFFING against a pre-send snapshot. Slicing "text after
// the echoed question" was fragile — Vina renders answers as cards/bullets that
// don't always follow the question in DOM order, which produced a blank reply.
let __vinaBaselineLines = null;
function vinaSnapshot() {
    __vinaBaselineLines = new Set(pageText().split('\n').map(s => s.trim()).filter(Boolean));
}
const VINA_CHROME_RE = /^(ask vina.*|vina|new chat|history|help\/?faq|send|stop|copy|regenerate|good (morning|afternoon|evening).*|for you.*|your vasyerp assistant.*|connected to live data|best performing outlet|payments to suppliers|today vs yesterday|collection efficiency)$/i;
function vinaAnswerNow(q) {
    const lines = pageText().split('\n').map(s => s.trim()).filter(Boolean);
    return lines.filter(l =>
        (!__vinaBaselineLines || !__vinaBaselineLines.has(l)) &&
        !VINA_CHROME_RE.test(l) &&
        vasyNorm(l) !== vasyNorm(q) &&
        l.replace(/[^A-Za-z0-9]/g, '').length > 1
    ).join('\n').trim();
}
async function waitForVinaAnswer(q, ms = 45000) {
    let prev = '', stable = 0;
    const end = Date.now() + ms;
    while (Date.now() < end) {
        await settle(1500);
        const cur = vinaAnswerNow(q);
        if (!cur) continue;
        if (cur === prev) { stable++; if (stable >= 2) return cur; }
        else { prev = cur; stable = 0; }
    }
    return prev || '';
}
function showVinaAnswer(q, answer) {
    const shown = answer.length > 1600 ? answer.slice(0, 1600) + '…' : answer;
    const listy = /^(?:[-•*]|\d+[.)])\s+/m.test(answer) || (answer.match(/\n/g) || []).length >= 2;
    reply('success', 'Vina says',
        (q ? `<i>${q.replace(/</g, '&lt;')}</i><br><br>` : '') +
        shown.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>') +
        (listy ? `<br><br><small style="color:#888">Want to act on this? Say <b>"create purchase order from vina"</b> and I'll turn those products into a PO.</small>` : ''));
}
// Follow-up: "it answered, check now" / "read vina's answer"
async function readVinaAnswer(data) {
    await sleep(400);
    if (!/\/vina/i.test(location.pathname)) {
        reply('info', null, `I'm not on the Vina page any more. Say <b>"ask vina &lt;question&gt;"</b> and I'll ask it and read the answer back.`);
        return;
    }
    const q = data.question || '';
    let answer = vinaAnswerNow(q) || await waitForVinaAnswer(q, 12000);
    if (!answer) {
        // Fresh page load (no baseline) — take the biggest readable text block
        answer = [...pageQSA('div,p,li,td')]
            .filter(e => e.offsetParent && e.children.length <= 3)
            .map(e => (e.innerText || '').trim())
            .filter(s => s.length > 60 && !VINA_CHROME_RE.test(s))
            .sort((a, b) => b.length - a.length)[0] || '';
    }
    if (!answer) { reply('info', null, `I can't see an answer on the Vina page yet — give it a moment, then ask me again.`); return; }
    showVinaAnswer(q, answer);
}

// Scrape product-looking lines out of Vina's answer and offer them for a PO.
async function poFromVina(data) {
    await settle(1200);
    const bodyTxt = pageText();
    // Vina answers list products as bullets / numbered lines — collect candidates
    const lines = bodyTxt.split('\n').map(s => s.trim())
        .filter(s => s.length > 2 && s.length < 80)
        .filter(s => /^(?:[-•*]|\d+[.)])\s+/.test(s))
        .map(s => s.replace(/^(?:[-•*]|\d+[.)])\s+/, '').replace(/[—–-]\s*(qty|₹|rs).*$/i, '').trim())
        .filter(s => s && !/^(step|note|summary|total|conclusion)/i.test(s));
    const uniq = [...new Set(lines)].slice(0, 10);
    if (!uniq.length) {
        reply('info', null, `I couldn't spot a product list in Vina's answer. Tell me the products directly — e.g. <i>"create purchase order from ACME for shinchan t-shirt qty 50"</i>.`);
        return;
    }
    reply('info', 'Vina Suggested These',
        uniq.map((p, i) => `${i + 1}. ${p}`).join('<br>') +
        `<br><br>Which supplier should I order from? Reply like:<br><i>create purchase order from &lt;supplier&gt; for ${uniq[0]} qty 10</i>`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIRMED SAVE — the user said "yes" to a held-back risky action
// ═══════════════════════════════════════════════════════════════════════════════
async function confirmSave(data) {
    __vasyConfirmed = true;
    __vasyTask = data.task || __vasyTask;
    await sleep(300);
    const act = window.__vasyPendingRowAction;
    if (act && /^(delete|deactivate)$/i.test(String(data.task || act.actionText))) {
        delete window.__vasyPendingRowAction;
        await _doRowAction(act.row, act.actionText, act.summary);
        return;
    }
    // If the ERP's own confirmation is what's waiting, answer THAT — clicking
    // Save again would just re-open it.
    const pending = window.__vasyErpConfirm && window.__vasyErpConfirm.confirm
                 && window.__vasyErpConfirm.confirm.offsetParent
                    ? window.__vasyErpConfirm : erpConfirmDialog();
    if (pending) {
        delete window.__vasyErpConfirm;
        watchResult(`${__vasyTask || 'Record'} Saved`, [], 'Confirmed on VasyERP\'s prompt.');
        pending.confirm.click();
        return;
    }
    watchResult(`${__vasyTask || 'Record'} Saved`, [], 'Saved with your confirmation.');
    if (!clickSaveBtn(document, { force: true })) {
        reply('error', null, `I couldn't find the Save button any more — the page may have reloaded. Please re-run the command.`);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK TRANSFER APPROVE / REJECT — /stocktransferrequest
// Recon (expo): list has a Status filter (Open / Approved / Rejected) + Actions
// column; the detail page carries the action icons. Only the RECEIVING branch
// sees them, so we fail honestly when they're absent instead of pretending.
// ═══════════════════════════════════════════════════════════════════════════════
async function approveTransfer(data) {
    const ref = (data.transferNo || '').trim();
    const wantReject = /reject/i.test(data.decision || '');
    if (!ref) { reply('error', null, 'Which transfer number should I ' + (wantReject ? 'reject' : 'approve') + '? e.g. STFREQ107'); return; }
    await settle(1500);

    // If we're already on the detail page for this ref, act here.
    const onDetail = new RegExp(ref.replace(/\s+/g, '\\s*'), 'i').testpageText()
                  && /\/stocktransferrequest\/\d+/.test(location.pathname);
    if (!onDetail) {
        await searchInTable(ref);
        await settle(2000);
        const link = [...pageQSA('a[href*="/stocktransferrequest/"]')].find(a =>
            a.offsetParent && vasyNorm(a.innerText) === vasyNorm(ref));
        if (!link) {
            reply('error', null, `Transfer "<b>${ref}</b>" not found in the Stock Transfer Request list. Check the number, and note the list is scoped by the date range / financial year shown above the table.`);
            return;
        }
        chrome.runtime.sendMessage({ action: 'inject_on_navigate',
            url: location.origin + link.getAttribute('href'),
            message: { action: 'approve_transfer', data: { ...data, transferNo: ref } } });
        return;
    }

    // Current status — approving an already-approved request is a no-op
    const bodyTxt = pageText();
    if (/\bAPPROVED\b/.test(bodyTxt) && !wantReject) {
        reply('success', null, `<b>${ref}</b> is already <b>APPROVED</b> — nothing to do.`);
        return;
    }
    if (/\bREJECTED\b/.test(bodyTxt)) {
        reply('info', null, `<b>${ref}</b> is already <b>REJECTED</b>, so it can't be actioned again.`);
        return;
    }

    const wantRe = wantReject ? /reject|decline/i : /approve|accept/i;
    const ctrl = [...pageQSA('button,a,[onclick]')].find(e => {
        if (!e.offsetParent) return false;
        const hay = (e.innerText || '') + ' ' + (e.title || '') + ' ' + (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('onclick') || '');
        return wantRe.test(hay) || (!wantReject && /approveStockTransfer/i.test(e.getAttribute('onclick') || ''));
    });
    if (!ctrl) {
        // Read the two branches off the detail table to name the right approver
        const to = (bodyTxt.match(/To Branch\s*\n?\s*([^\n]{2,60})/i) || [])[1];
        reply('info', null,
            `I opened <b>${ref}</b> but there's no ${wantReject ? 'Reject' : 'Approve'} control visible for your login.<br>` +
            `Stock-transfer approval belongs to the <b>receiving</b> branch${to ? ` — <b>${to.trim()}</b>` : ''}, and the ERP also blocks approvals dated in a previous financial year.<br>` +
            `<small>Sign in as a user of that branch (with Stock Transfer edit rights) and I'll do it from there.</small>`);
        return;
    }
    // Approval changes stock on hand → held by the confirm-before-save gate
    if (!__vasyConfirmed) {
        try { chrome.runtime.sendMessage({ action: 'pending_save', task: 'TransferApproval', url: location.href }); } catch (e) {}
        reply('info', `${wantReject ? 'Reject' : 'Approve'} ${ref}?`,
            `I'm on <b>${ref}</b> and ready to <b>${wantReject ? 'REJECT' : 'APPROVE'}</b> it.` +
            `<br><small style="color:#888">Approving moves stock between branches, so I won't do it without your OK.</small><br>(yes/cancel)`);
        return;
    }
    watchResult(`Transfer ${wantReject ? 'Rejected' : 'Approved'}`, [], `${ref} updated — the list Status will show ${wantReject ? 'REJECTED' : 'APPROVED'}.`);
    ctrl.click();
}

// ═══════════════════════════════════════════════════════════════════════════════
// BANK TRANSACTION — /banktransaction, "Create New" -> modal
// Recon labels: From Account:* | To Account:* | Amount:* | Date:* | Description
// Cash is itself an account, so deposit/withdraw are just From/To choices.
// ═══════════════════════════════════════════════════════════════════════════════
async function createBankTransaction(data) {
    await settle(1500);
    const openForm = () => [...pageQSA('select,input')].some(e =>
        e.offsetParent && /from\s*account/i.test(labelNear(e)));
    if (!openForm()) {
        const btn = [...pageQSA('button,a')].find(b => b.offsetParent &&
            /^(create\s*new|new\s*transaction|add|new)$/i.test((b.innerText || '').trim()));
        if (btn) { btn.click(); await settle(1500); }
    }
    const scope = [...pageQSA('.modal,[role="dialog"]')].find(m => m.offsetParent) || document;
    // Both accounts are select2-style pickers; "Cash" is a normal option.
    const pick = async (labelRe, value, what) => {
        if (!value) return true;
        const sel = [...scope.querySelectorAll('select')].find(s => labelRe.test(labelNear(s)) || labelRe.test(s.id || ''));
        if (sel) {
            const ok = setSelect2Text(sel.id, value);
            if (!ok) {
                const opt = vasyBest(value, [...sel.options], o => (o.text || '').trim(), 0.45);
                if (!opt) { reply('error', null, `${what} "<b>${value}</b>" not found. Available: ${[...sel.options].slice(1,7).map(o => (o.text||'').trim()).join(' / ')}`); return false; }
                sel.value = opt.item.value; sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
            await sleep(500);
            return true;
        }
        if (!smartSet(value, { label: labelRe, scope })) {
            reply('error', null, `Couldn't find the ${what} field on the Bank Transaction form.`); return false;
        }
        return true;
    };
    if (!await pick(/from\s*account/i, data.fromAccount, 'From Account')) return;
    if (!await pick(/to\s*account/i,   data.toAccount,   'To Account'))   return;
    if (data.amount) smartSet(data.amount, { label: /^amount/i, scope });
    if (data.date)   smartSet(data.date,   { label: /^date/i,   scope });
    if (data.notes || data.description) smartSet(data.notes || data.description, { label: /description/i, scope });
    watchResult('Bank Transaction Saved', ['/banktransaction'], 'Both account balances will update.');
    if (!clickSaveBtn(scope) && !clickSaveBtn()) reply('error', null, 'Save button not found on the Bank Transaction form.');
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY-WISE VARIANTS — /category-wise-variants
// Recon labels: Category * | Option Name * (eg Size/Color) | Option Value *
// ═══════════════════════════════════════════════════════════════════════════════
async function createCategoryVariant(data) {
    await settle(1500);
    const isOpen = () => [...pageQSA('input')].some(i => i.offsetParent && /option\s*name/i.test((i.placeholder||'') + ' ' + labelNear(i)));
    if (!isOpen()) {
        const btn = [...pageQSA('button,a')].find(b => b.offsetParent &&
            /add\s*new|new\s*pre.?define|add|new/i.test((b.innerText || '').trim()) && (b.innerText||'').trim().length < 26);
        if (btn) { btn.click(); await settle(1500); }
    }
    const scope = [...pageQSA('.modal,[role="dialog"]')].find(m => m.offsetParent) || document;
    if (data.categoryName) {
        const sel = [...scope.querySelectorAll('select')].find(s => /categor/i.test(labelNear(s)) || /categor/i.test(s.id||''));
        if (sel && !setSelect2Text(sel.id, data.categoryName)) {
            const opt = vasyBest(data.categoryName, [...sel.options], o => (o.text||'').trim(), 0.45);
            if (opt) { sel.value = opt.item.value; sel.dispatchEvent(new Event('change', {bubbles:true})); }
            else { reply('error', null, `Category "<b>${data.categoryName}</b>" not found on this page.`); return; }
        }
        await sleep(600);
    }
    // Option name/value pairs come in as "Size: S,M,L" style data
    const pairs = Array.isArray(data.options) ? data.options : [];
    const nameInputs = [...scope.querySelectorAll('input')].filter(i => i.offsetParent && /option\s*name|eg\.?\s*size/i.test((i.placeholder||'') + ' ' + labelNear(i)));
    const valInputs  = [...scope.querySelectorAll('input')].filter(i => i.offsetParent && /option\s*value/i.test((i.placeholder||'') + ' ' + labelNear(i)));
    if (!nameInputs.length || !valInputs.length) {
        reply('info', 'Variant Page Opened', 'The pre-defined variants form is open — add the option names and values, then Save.');
        return;
    }
    for (let i = 0; i < pairs.length && i < nameInputs.length; i++) {
        setVal(nameInputs[i], pairs[i].name);
        await sleep(200);
        setVal(valInputs[i], Array.isArray(pairs[i].values) ? pairs[i].values.join(',') : pairs[i].values);
        await sleep(200);
    }
    watchResult('Variant Set Created', ['/category-wise-variants']);
    if (!clickSaveBtn(scope) && !clickSaveBtn()) reply('error', null, 'Save button not found on the variants form.');
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT TO EXCEL — works on any list page (v9.12.0 allows Stock Verification
// export before approval, subject to the user's permissions)
// ═══════════════════════════════════════════════════════════════════════════════
async function exportExcel(data) {
    await sleep(800);
    const hits = [...pageQSA('button,a,[onclick],[class*="export" i]')].filter(e => {
        if (!e.offsetParent) return false;
        const hay = (e.innerText || '') + ' ' + (e.title || '') + ' ' + (e.getAttribute('aria-label') || '') +
                    ' ' + (e.className || '') + ' ' + (e.getAttribute('onclick') || '') + ' ' + (e.getAttribute('href') || '');
        return /export|\bexcel\b|\bxlsx?\b|download/i.test(hay) && !/import|template|pdf|print/i.test(hay);
    });
    if (!hits.length) {
        reply('error', null, `I can't find an Export control on this page. Open the list you want to export (Stock Verification, a register, any grid) and ask again.`);
        return;
    }
    // Prefer something that explicitly says Excel/XLS over a generic "Export"
    const best = hits.find(e => /excel|xlsx?/i.test((e.innerText || '') + ' ' + (e.title || '') + ' ' + (e.className || ''))) || hits[0];
    best.click();
    await settle(1200);
    // Some grids open a small menu — pick the Excel entry inside it
    const menuItem = [...pageQSA('a,button,li,[role="menuitem"]')].find(e =>
        e.offsetParent && /^\s*(excel|xlsx?|export to excel)\s*$/i.test((e.innerText || '').trim()));
    if (menuItem) { menuItem.click(); await sleep(800); }
    reply('success', 'Export Started',
        `Asked VasyERP to export this list. The file lands in your browser's <b>Downloads</b>.` +
        `<br><small style="color:#888">If nothing downloaded, your role may not have export rights for this module.</small>`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK VERIFICATION (physical count) — /inventorytracking/new
// ═══════════════════════════════════════════════════════════════════════════════
async function createStockVerification(data) {
    await settle(2000);
    // Legacy pages share the same barcode/typeahead item search as SO/PO/POS —
    // try that; if this layout differs, open honestly instead of guessing.
    // The redesigned React page's box reads "Scan barcode or type product code…"
    // — no "earch" in it, so the old test never matched and every verification
    // fell through to "I couldn't auto-add on this layout".
    const hasSearch = document.getElementById('searchItemBarcode')
                   || pageQS('.tt-input, input[placeholder*="earch" i],'
                        + 'input[placeholder*="scan barcode" i], input[placeholder*="product code" i]');
    if (!data.itemName || !hasSearch) {
        reply('info', 'Stock Verification Opened',
            `The physical-count page is ready${data.itemName ? ` — I couldn't auto-add "<b>${data.itemName}</b>" on this layout yet` : ''}. ` +
            `Add the item(s), enter the counted quantity and save.`);
        return;
    }
    const st = await searchAndSelectItem(data.itemName,
        { ...(data.qty != null ? { qty: data.qty } : {}), inputId: hasSearch.id || 'searchItemBarcode' });
    if (st === 'asked') return;
    if (!st) { reply('error', null, `Product "<b>${data.itemName}</b>" not found here — check the name and try again.`); return; }
    await settle(1000);
    if (data.qty != null) smartSet(data.qty, { label: /physical|counted|actual|verified?\s*qty/i });
    // v9.12.0: employee logins MASK System Qty / Difference Qty / Difference Amount
    // so the count stays honest — say so rather than reporting them as zero.
    const masked = !pageText().match(/system\s*qty|difference\s*qty/i);
    // v9.12.0 also added an unsaved-changes warning: navigating away now prompts,
    // which a browser dialog we cannot dismiss — so tell the user to finish here.
    // The page states the consequence itself — quote it rather than paraphrase:
    // "N variances will create a stock adjustment voucher on save."
    const variance = (pageText().match(/(\d+)\s+variances?\s+will create[^.]*\./i) || [])[0];
    reply('info', 'Item Added',
        `<b>${data.itemName}</b> is on the verification list${data.qty != null ? ` with qty <b>${data.qty}</b>` : ''}. ` +
        `Review the counted quantity, then press <b>Submit for approval</b> — I don't submit physical counts.` +
        (variance ? `<br><small style="color:#888">VasyERP says: <b>${variance}</b></small>` : '') +
        (masked ? `<br><small style="color:#888">System/Difference quantities are hidden for your login — that's deliberate, so the physical count isn't influenced.</small>` : '') +
        `<br><small style="color:#888">Finish or discard this count before asking me for something else — VasyERP now warns about unsaved verifications, and that browser prompt is one I can't click for you.</small>`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// E-INVOICE / E-WAY BILL for a named document — locate id, open detail, trigger
// ═══════════════════════════════════════════════════════════════════════════════
async function einvoiceForDoc(data) {
    const invNo = (data.invoiceNumber || '').trim();
    if (!invNo) { reply('error', null, 'Which invoice number?'); return; }
    await settle(1200);
    await searchInTable(invNo);
    await settle(2200);
    const link = [...pageQSA('a[href*="/sales/invoice/"]')].find(a =>
        a.offsetParent && (a.innerText || '').trim().toUpperCase() === invNo.toUpperCase());
    if (!link) {
        reply('error', null, `Invoice "<b>${invNo}</b>" not found in the Invoice list. Check the number (and the FY selector) and try again.`);
        return;
    }
    chrome.runtime.sendMessage({
        action: 'inject_on_navigate',
        url: location.origin + link.getAttribute('href'),
        message: { action: 'trigger_edoc', data: { type: data.type || 'einvoice', distance: data.distance || '', invoiceNumber: invNo } }
    });
}

async function triggerEdoc(data) {
    await settle(2000);
    if (data.type === 'eway') {
        // Recon: [onclick*=genEwayBill] runs /eway/sales/checkdata, and ONLY opens
        // #generate_ewaybill_modal when the doc passes validation. On failure the
        // reasons show in a transient toastr — unreliable to scrape. So we run the
        // same same-origin validation ourselves first and quote the ERP verbatim.
        const idM = location.pathname.match(/\/sales\/invoice\/(\d+)/);
        if (idM) {
            try {
                // Spring CSRF: jQuery ajax on the page injects the token; we must too
                const csrfTok = pageQS('meta[name="_csrf"]')?.content
                             || document.getElementById('csrftag')?.value || '';
                const csrfHdr = pageQS('meta[name="_csrf_header"]')?.content || 'X-CSRF-TOKEN';
                const r = await fetch('/eway/sales/checkdata', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest',
                               ...(csrfTok ? { [csrfHdr]: csrfTok } : {}) },
                    body: 'salesId=' + idM[1] + (csrfTok ? '&_csrf=' + encodeURIComponent(csrfTok) : '')
                });
                const j = await r.json();
                const d0 = Array.isArray(j) ? j[0] : j;
                if (d0 && String(d0.status) === '500' && d0.msg) {
                    const items = d0.msg.split(/(?=- )/).map(s => s.replace(/^-\s*/, '').trim()).filter(Boolean);
                    reply('error', null, `<b>${data.invoiceNumber}</b> isn't ready for an E-Way Bill. VasyERP needs:<br>• ${items.join('<br>• ')}<br>Fix these on the invoice/contact, then try again.`);
                    return;
                }
            } catch (e) { /* validation probe failed — fall through to the UI flow */ }
        }
        const trig = pageQS('[onclick*="genEwayBill"]')
                  || [...pageQSA('button,a')].find(b => b.offsetParent && /e.?way/i.test(b.innerText || b.title || ''));
        if (!trig) { reply('error', null, `E-Way Bill option not found on <b>${data.invoiceNumber}</b> — it may already be generated, or E-Way isn't enabled for this document type.`); return; }
        trig.click();
        const modal = await waitForEl(() => {
            const m = document.getElementById('generate_ewaybill_modal');
            return (m && (m.offsetParent || getComputedStyle(m).display !== 'none' && m.classList.contains('show'))) ? m : null;
        }, 8000);
        if (!modal) {
            const toast = pageQS('#toast-container .toast-message, .toast-message');
            reply('error', null, toast && toast.innerText.trim()
                ? `ERP says: <b>${toast.innerText.trim().slice(0, 200)}</b>`
                : `The E-Way Bill window didn't open for <b>${data.invoiceNumber}</b> — the document may be missing transport details (pincodes/GSTIN/HSN).`);
            return;
        }
        if (data.distance) {
            const dist = modal.querySelector('#ewayBillDistance');
            if (dist) { dist.value = data.distance; dist.dispatchEvent(new Event('input', { bubbles: true })); dist.dispatchEvent(new Event('change', { bubbles: true })); }
        } else {
            reply('info', null, `The E-Way Bill window is open for <b>${data.invoiceNumber}</b> — enter the <b>distance in km</b> (1–4000) and press Generate. Next time say e.g. "generate eway bill for ${data.invoiceNumber} distance 45".`);
            return;
        }
        const gen = modal.querySelector('[onclick*="generateEwayBillNew"]')
                 || [...modal.querySelectorAll('button')].find(b => /^generate$/i.test((b.innerText || '').trim()));
        if (!gen) { reply('error', null, 'Generate button not found in the E-Way Bill window.'); return; }
        watchResult('E-Way Bill Generated', [], 'Check the invoice page for the E-Way Bill number.');
        gen.click();
        return;
    }
    // E-Invoice — direct trigger; recon: POST /einvoice/sales/<id>/generateinvoice,
    // page reloads on success, toastr error otherwise.
    const btn = pageQS('[onclick*="GenerateE_Invoice"]')
             || [...pageQSA('button,a')].find(b => b.offsetParent && /generate.*e.?invoice/i.test(b.innerText || b.title || ''));
    if (!btn) { reply('error', null, `Generate E-Invoice option not found on <b>${data.invoiceNumber}</b> — it may already be generated (look for the IRN on the page).`); return; }
    watchResult('E-Invoice Generated', [], 'The IRN will appear on the invoice after the page refreshes.');
    btn.click();
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER ROLE — React role builder at /users/user-roles/new
// ═══════════════════════════════════════════════════════════════════════════════
// Job presets. A merchant asks for "a cashier role", not for 12 checkbox ids —
// these are the permissions that job actually needs. Deliberately no Delete
// anywhere: removing documents is an owner's decision, not a job description.
const ROLE_PRESETS = {
    cashier: ['View-dashboard','View-pos','Insert-pos','View-posnew','Insert-posnew',
              'View-poscreditnote','Insert-poscreditnote','View-salesregister',
              'View-customers','Insert-customers','View-product','View-stock'],
    'purchase manager': ['View-dashboard','View-report','View-suppliers','Insert-suppliers','Edit-suppliers',
              'View-order','Insert-order','Edit-order','View-materialinward','Insert-materialinward',
              'View-bill','Insert-bill','View-payment','Insert-payment','View-product','View-stock',
              'View-stocktransferrequest','Insert-stocktransferrequest'],
    'sales manager': ['View-dashboard','View-report','View-customers','Insert-customers','Edit-customers',
              'View-invoice','Insert-invoice','Edit-invoice','Pdf-invoice','View-salesorder','Insert-salesorder',
              'Edit-salesorder','View-estimate','Insert-estimate','View-deliverychallan','Insert-deliverychallan',
              'View-receipt','Insert-receipt','View-creditnote','Insert-creditnote','View-product','View-stock',
              'View-discount','View-coupon'],
    accountant: ['View-dashboard','View-report','View-payment','Insert-payment','View-receipt','Insert-receipt',
              'View-bank','View-bank_transaction','Insert-bank_transaction','View-bank_reconciliation',
              'Insert-bank_reconciliation','View-JOURNAL_VOUCHER','Insert-JOURNAL_VOUCHER',
              'View-credit_debit_note_accounting','Insert-credit_debit_note_accounting','View-accounts',
              'View-accountgroup','View-expense','Insert-expense','View-tax','View-invoice','View-bill'],
    storekeeper: ['View-dashboard','View-product','Insert-product','Edit-product','View-stock',
              'Insert-stockadjustment','View-stocktransfer','Insert-stocktransfer',
              'View-stocktransferrequest','Insert-stocktransferrequest','View-inventoryTracking',
              'Insert-inventoryTracking','View-materialinward','Insert-materialinward','View-openingstock'],
};
const PRESET_ALIASES = [
    [/\bcashier|billing\s*(staff|clerk)|till\b/i,          'cashier'],
    [/\bpurchas(e|ing)\s*(manager|executive|officer)?\b/i, 'purchase manager'],
    [/\bsales\s*(manager|executive|officer)?\b/i,          'sales manager'],
    [/\baccountant|accounts?\s*(manager|executive)?\b/i,   'accountant'],
    [/\bstore\s*keeper|storekeeper|inventory\s*manager|warehouse\b/i, 'storekeeper'],
];

async function createUserRole(data) {
    // The LEGACY /userrole/new page carries the same permission matrix with stable
    // semantic ids (userRoleName, View-<module>, Insert-<module>, …), where the
    // React rebuild only exposes emotion-hashed classes. That is the difference
    // between "all permissions or none" and actually granting a job's rights.
    await settle(1200);
    const nameInp = await waitForEl('#userRoleName', 8000)
                 || await waitForEl(() => [...pageQSA('input')]
                        .find(i => i.offsetParent && /role name/i.test(i.placeholder || labelNear(i) || '')), 4000);
    if (!nameInp) { reply('error', null, 'Role name field not found — the User Role page may have changed, or your role lacks permission.'); return; }
    setVal(nameInp, data.roleName || '');
    await sleep(300);
    if (!nameInp.value) { reply('error', null, `Couldn't type the role name.`); return; }

    const box = id => document.getElementById(id);
    const tick = async (id) => { const el = box(id); if (!el) return false;
                                 if (!el.checked) { el.click(); await sleep(45); } return true; };

    let granted = [], missing = [], summary, presetName = null;
    if (data.allPerms) {
        // The bare module checkbox is a select-all for its own row.
        const mods = [...pageQSA('input[type=checkbox]')]
            .filter(c => c.id && !/-/.test(c.id) && !/^outlet-/.test(c.id));
        for (const m of mods) { if (!m.checked) { m.click(); await sleep(35); } }
        granted = mods.map(m => m.id);
        summary = `Every module was granted (${granted.length} modules).`;
    } else {
        // Resolve a preset from the role name or an explicit permissions list.
        let wanted = Array.isArray(data.permissions) && data.permissions.length ? data.permissions : null;
        if (!wanted) {
            const hay = `${data.preset || ''} ${data.roleName || ''}`;
            const hit = PRESET_ALIASES.find(([re]) => re.test(hay));
            if (hit) { presetName = hit[1]; wanted = ROLE_PRESETS[presetName]; }
        }
        if (!wanted) {
            reply('info', null,
                `I created nothing yet — "<b>${data.roleName}</b>" doesn't match a job I have a permission set for.<br>` +
                `<small>Say e.g. "create a <b>cashier</b> role called ${data.roleName}", or add "<b>with all permissions</b>". ` +
                `Known jobs: ${Object.keys(ROLE_PRESETS).join(', ')}.</small>`);
            return;
        }
        // Only the exact Action-module boxes — never the module toggle, which
        // would silently add Edit and Delete on top of what was asked for.
        for (const id of wanted) { (await tick(id) ? granted : missing).push(id); }
        summary = `Granted ${granted.length} permission${granted.length===1?'':'s'}` +
                  (presetName ? ` for a <b>${presetName}</b>` : '') + ` — no delete rights.`;
    }

    // Scope to the outlets the account exposes; default to the first if none set.
    const outlets = [...pageQSA('input[type=checkbox][id^="outlet-"]')];
    if (outlets.length && !outlets.some(o => o.checked)) { outlets[0].click(); await sleep(60); }

    // A job preset is a best guess at a permission set, and accounts differ in
    // which boxes exist (stock adjustment has Insert but no View here). Skipping
    // an absent box is the right call for a preset; stopping is only right when
    // the user listed the permissions themselves.
    if (missing.length && presetName) {
        summary += ` <small>(${missing.length} not offered on this account, skipped: ${missing.slice(0, 4).join(', ')})</small>`;
        missing = [];
    }
    if (missing.length) {
        reply('info', null,
            `${summary}<br><small>${missing.length} permission(s) don't exist on this account: ` +
            `${missing.slice(0,6).join(', ')}. Nothing was saved — tell me to go ahead and I'll save what matched.</small>`);
        return;
    }
    watchResult('Role Created', ['/userrole'], summary);
    if (!clickSaveBtn()) reply('error', null, 'The Save button was not found on the User Role page.');
}

// ═══════════════════════════════════════════════════════════════════════════════
// BILL PAYMENT — VasyERP's own flow: bill list → bill id → /payment/new?purchaseId
// ═══════════════════════════════════════════════════════════════════════════════
async function payBill(data) {
    const billNo = (data.billNumber || '').trim();
    if (!billNo) { reply('error', null, 'Which bill number should I pay?'); return; }
    await settle(1200);
    await searchInTable(billNo);
    await settle(2200);
    // The bill link's href carries the internal id — no fragile clicking needed.
    const link = [...pageQSA('a[href*="/purchase/bill/"]')].find(a =>
        a.offsetParent && (a.innerText || '').trim().toUpperCase() === billNo.toUpperCase());
    if (!link) {
        reply('error', null, `Bill "<b>${billNo}</b>" not found in the Supplier Bill list. Check the number (and the FY selector) and try again.`);
        return;
    }
    const idM = (link.getAttribute('href') || '').match(/\/purchase\/bill\/(\d+)/);
    if (!idM) { reply('error', null, `Couldn't read the internal id for <b>${billNo}</b> — open the bill and use Make Payment manually.`); return; }
    // The payment page needs the party by NAME (it is no longer prefilled from the
    // bill link), so carry the supplier across from the row we just matched.
    // Read the supplier from the SUPPLIER column, not by scanning cells for one
    // that happens to contain letters — that heuristic picked "100 paid(100%)"
    // out of the Paid Amount column and selected it as the party.
    const row = link.closest('tr');
    const cells = row ? [...row.querySelectorAll('td')].map(td => (td.innerText || '').replace(/\s+/g, ' ').trim()) : [];
    const table = row ? row.closest('table') : null;
    const heads = table ? [...table.querySelectorAll('thead th')].map(th => (th.innerText || '').replace(/\s+/g, ' ').trim()) : [];
    const supIdx = heads.findIndex(h => /^(supplier|party|vendor)/i.test(h));
    const supplierName = data.supplierName
        || (supIdx >= 0 && cells[supIdx] ? cells[supIdx] : '')
        || cells.find(x => x && x !== billNo && /[A-Za-z]{3}/.test(x) &&
                           !/^\d[\d,.\/-]*$/.test(x) && !/\d+\s*(?:paid|due|%)/i.test(x)) || '';
    chrome.runtime.sendMessage({
        action: 'inject_on_navigate',
        url: location.origin + '/payment/new?purchaseId=' + idM[1],
        message: { action: 'complete_bill_payment', data: { amount: data.amount || '', paymentMode: data.paymentMode || 'Cash', billNumber: billNo, supplierName } }
    });
}

async function completeBillPayment(data) {
    await settle(2000);
    // Bank mode? flip the radio and pick the first real bank
    if (/bank|neft|rtgs|imps/i.test(data.paymentMode || '')) {
        const bankRadio = pageQS('input[name="paymentMode"][value="bank"]');
        if (bankRadio && !bankRadio.checked) { bankRadio.click(); await sleep(500); }
        const bankSel = document.getElementById('bankVo');
        if (bankSel && bankSel.options.length > 1) { bankSel.value = bankSel.options[1].value; bankSel.dispatchEvent(new Event('change', { bubbles: true })); }
    } else {
        // Cash type — pick "Cash (Cash in Hand)" (or the first cash account)
        const cashSel = document.getElementById('cashdropdown');
        if (cashSel) {
            const opt = [...cashSel.options].find(o => /^cash\s*\(/i.test((o.text || '').trim())) || cashSel.options[1];
            if (opt) { cashSel.value = opt.value; cashSel.dispatchEvent(new Event('change', { bubbles: true })); await sleep(400); }
        }
    }
    // Verified 06/09/2026: /payment/new?purchaseId=<id> NO LONGER prefills the
    // party or the bill grid. Select Party is mandatory, so without this the save
    // fails — and the old "already fully paid" message blamed the bill for what is
    // really a missing party.
    const partySel = document.getElementById('accountCustomId');
    if (partySel && !partySel.value && data.supplierName) {
        const { tok, hdr: hdrN } = await _csrf();
        try {
            const res = await fetch('/payment/select/party/json', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded',
                           'X-Requested-With': 'XMLHttpRequest', ...(tok ? { [hdrN]: tok } : {}) },
                body: new URLSearchParams({ accountname: data.supplierName, page: 1 }).toString()
            });
            const items = (await res.json().catch(() => ({}))).items || [];
            const best = vasyBest(data.supplierName, items, i => (i.text || '').trim(), 0.45);
            if (best) {
                const o = new Option((best.item.text || '').trim(), String(best.item.id), true, true);
                partySel.appendChild(o);
                partySel.value = String(best.item.id);
                partySel.dispatchEvent(new Event('change', { bubbles: true }));
                await settle(4000);
            }
        } catch (e) {}
    }
    if (partySel && !partySel.value) {
        reply('info', null,
            `The payment form is open, but <b>Select Party</b> is empty and it's mandatory — ` +
            `this build no longer fills it from the bill link.<br>` +
            `<small>Tell me the supplier ("<i>pay bill ${data.billNumber || 'BIL…'} to &lt;supplier&gt;</i>") ` +
            `or pick the party yourself. Nothing was saved.</small>`);
        return;
    }

    // Custom partial amount (default: the prefilled full due)
    if (data.amount && data.amount !== 'FULL') {
        smartSet(data.amount, { ids: ['totalPayment'], label: /^payment\s*amount|^amount\b/i });
    } else {
        // Nothing prefilled either — fall back to the party's closing balance.
        const amtEl = document.getElementById('totalPayment');
        const bal = (pageText().match(/Closing Balance[:\s₹]*([\d,]+\.?\d*)/i) || [])[1];
        if (amtEl && (!amtEl.value || amtEl.value === '0') && bal) setVal(amtEl, bal.replace(/,/g, ''));
    }
    // Is the bill actually allocatable on this form? /payment/new?purchaseId=<id>
    // renders the "Against Voucher" block with display:none and an empty bill
    // grid — the ERP only unhides it from its own party-picker flow. Pressing Save
    // in that state is answered with "Minimum One Bill Is required" and nothing is
    // written. Check before saving rather than firing a save that cannot land.
    const againstDiv = document.getElementById('against_bill_div');
    const billRows = [...pageQSA('#bill_table tr')]
        .filter(r => r.getClientRects().length && /\d/.test(r.innerText || ''));
    const againstChecked = !!(document.getElementById('againstBill') || {}).checked;
    if (againstChecked && (!billRows.length || (againstDiv && !againstDiv.offsetParent))) {
        const amt = (document.getElementById('totalPayment') || {}).value || data.amount || '';
        reply('info', null,
            `I've opened the payment for <b>${data.billNumber || 'this bill'}</b> and filled the party` +
            `${amt ? ` and amount (₹${amt})` : ''}, but VasyERP hasn't loaded its bill-allocation grid on this ` +
            `screen, so it would refuse the save with "Minimum One Bill Is required". <b>Nothing was saved.</b><br>` +
            `<small>Tick the bill in <i>Against Voucher</i> and press Save — or, if you just want the money ` +
            `recorded against the supplier, say <i>"pay ${data.supplierName || 'supplier'} ${amt || '<amount>'} ` +
            `${(data.paymentMode || 'cash').toLowerCase()}"</i> and I'll post it on account.</small>`);
        return;
    }

    watchResult('Payment Recorded', ['/payment/'], 'Bill payment saved — the bill status will update to Paid.');
    if (!clickSaveBtn()) reply('error', null, 'Save button not found on the Payment form.');
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE Q&A — answer questions straight from the current page (dashboard/reports)
// ═══════════════════════════════════════════════════════════════════════════════
// ── Dashboard period picker (jQuery daterangepicker) ─────────────────────────
// Primary path: MAIN-world bridge clicks the range li inside the picker's own
// container via the jQuery instance (proven reliable — the page has 9 pickers
// and only the instance knows which container belongs to #fromToDate).
// Fallback: open the picker in the DOM and click the visible range item.
async function setDashboardPeriod(rangeKey, inputId = 'fromToDate') {
    const inp = document.getElementById(inputId);
    if (!inp) return false;
    const beforeVal = inp.value;

    // Path A — main-world bridge
    const ds = document.documentElement.dataset;
    ds.vasyPeriodResult = '';
    ds.vasyPeriod = rangeKey;
    ds.vasyPeriodInput = inputId;
    document.dispatchEvent(new CustomEvent('vasy:set-period'));
    let bridged = '';
    const bEnd = Date.now() + 2000;
    while (Date.now() < bEnd && !(bridged = ds.vasyPeriodResult || '')) await sleep(100);

    // Path B — DOM fallback if the bridge isn't there / failed
    if (bridged !== 'ok') {
        if (!inp.offsetParent) return false;
        inp.click();
        await sleep(500);
        const picker = [...pageQSA('.daterangepicker')].find(p => p.offsetParent);
        if (!picker) return false;
        const li = [...picker.querySelectorAll('.ranges li')].find(l =>
            (l.getAttribute('data-range-key') || l.innerText || '').trim().toLowerCase() === rangeKey.toLowerCase());
        if (!li) { inp.click(); return false; }
        li.click();
    }

    // Wait for the range to apply + tiles to re-fetch (same-range picks keep the value)
    const end = Date.now() + 4000;
    while (Date.now() < end && inp.value === beforeVal) await sleep(200);
    await settle(2200);
    return true;
}

// ── Financial-year switcher (header dropdown) ────────────────────────────────
// Returns 'already' | 'switched' | 'notfound' | 'nofy'. Switching reloads the page.
async function setFinancialYear(fyText) {
    const wrap = pageQS('.financial-year-dash');
    if (!wrap) return 'nofy';
    const current = (wrap.querySelector('.yrText')?.innerText || wrap.innerText || '').trim();
    if (current.includes(fyText)) return 'already';
    const toggle = wrap.querySelector('a.m-dropdown__toggle') || wrap.querySelector('a');
    toggle?.click();
    await sleep(500);
    const link = [...wrap.querySelectorAll('a.m-nav__link')].find(a => (a.innerText || '').includes(fyText));
    if (!link) { toggle?.click(); return 'notfound'; }
    // reply is sent by the caller BEFORE this click — the page reloads on switch
    link.click();
    return 'switched';
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD v2 — VasyERP's React "Dashboard Overview" (recon 07/10/2026)
//   • KPI tiles: [role=button][aria-label="Total Sales: ₹48,420.0000"] — label and
//     EXACT value in the aria-label; the tile shows "₹48.4 K", a change % and a
//     lucide trending-up / trending-down / minus icon.
//   • Panels: an <h3> heading per card (Sales & Purchase Trend, Payment Mode
//     Distribution, Receivables and Payables, Customer Insight, Sales Breakdown,
//     Top Expenses, Top Coupons, …) — the Best/Least Selling card is titled by
//     its tabs. EVERY panel has its own date button, separate from the page's.
//   • Date picker = react-date-range: presets are button.rdrStaticRange (Today,
//     Yesterday, This/Last Week, This/Last Month, This/Last Quarter, Current/Last
//     Financial Year); a click applies immediately, the popover stays open.
// Panels are found by their headings, not a fixed list, so a panel VasyERP adds
// later is still found and can be asked about by name.
// ═══════════════════════════════════════════════════════════════════════════════
const _clean = t => String(t || '').replace(/\s+/g, ' ').trim();
const _vis = e => !!(e && e.getClientRects().length) && !isOurs(e);
const DASH_RANGE_RE = /\d{1,2}\s\w{3}\s\d{4}\s*[–-]\s*\d{1,2}\s\w{3}\s\d{4}/;
function isDashV2() {
    return /^\/dashboard/.test(location.pathname)
        && !!pageQS('[role="button"][aria-label*=": "]')
        && pageQSA('h3').some(h => _vis(h) && /trend|distribution|insight|receivables|breakdown|top expenses/i.test(h.innerText || ''));
}
function dashTilesV2() {
    return pageQSA('[role="button"][aria-label*=": "]').filter(_vis).map(t => {
        const al = t.getAttribute('aria-label') || '';
        const i = al.indexOf(':');
        const svg = t.querySelector('svg');
        const cls = svg ? String(svg.getAttribute('class') || '') : '';
        const lines = (t.innerText || '').split('\n').map(_clean).filter(Boolean);
        const pct = lines.find(l => /^-?[\d.,]+%$/.test(l) && l !== lines[0]) || '';
        return { label: al.slice(0, i).trim(), exact: al.slice(i + 1).trim(), short: lines[0] || '',
                 change: pct, dir: /trending-up/.test(cls) ? 'up' : /trending-down/.test(cls) ? 'down' : (pct ? 'flat' : '') };
    }).filter(t => t.label);
}
function dashPanelsV2() {
    const heads = pageQSA('h3').filter(h => _vis(h) && !isChromeEl(h) && _clean(h.innerText).length > 2 && _clean(h.innerText).length < 60);
    const items = heads.map(h => ({ title: _clean(h.innerText), head: h }));
    // cards titled by their tabs (Best Selling / Least Selling)
    for (const tl of pageQSA('[role="tablist"]').filter(_vis)) {
        const tabs = [...tl.querySelectorAll('[role="tab"]')].map(t => _clean(t.innerText));
        if (tabs.some(t => /selling/i.test(t))) items.push({ title: tabs.join(' / '), head: tl });
    }
    const titles = items.map(x => x.title);
    return items.map(x => {
        let c = x.head, card = x.head;
        for (let i = 0; i < 10 && c.parentElement; i++) {
            c = c.parentElement;
            const txt = _clean(c.innerText);
            if (titles.some(t => t !== x.title && txt.includes(t.split(' / ')[0]))) break;
            card = c;
        }
        return { title: x.title, card };
    });
}
function _panelLines(card) { return (card.innerText || '').split('\n').map(_clean).filter(Boolean); }
function _dateBtnIn(scope) { return [...scope.querySelectorAll('button')].find(b => _vis(b) && DASH_RANGE_RE.test(_clean(b.innerText))); }
function _globalDateBtn(panels) {
    return pageQSA('button').find(b => _vis(b) && DASH_RANGE_RE.test(_clean(b.innerText)) && !panels.some(p => p.card.contains(b)));
}
const DASH_PRESETS = {
    'today': 'Today', 'yesterday': 'Yesterday', 'this week': 'This Week', 'last week': 'Last Week',
    'this month': 'This Month', 'last month': 'Last Month', 'this quarter': 'This Quarter', 'last quarter': 'Last Quarter',
    'this financial year': 'Current Financial Year', 'current financial year': 'Current Financial Year', 'last financial year': 'Last Financial Year',
};
// Pick a preset on one date button. → { ok, range } or { ok:false, why }
async function setDashRangeV2(btn, period) {
    if (!btn) return { ok: false, why: 'no date selector' };
    const want = DASH_PRESETS[String(period || '').toLowerCase()];
    if (!want) return { ok: false, why: `VasyERP's dashboard has no “${period}” option (it offers Today, Yesterday, this/last week, month, quarter and financial year)` };
    const before = _clean(btn.innerText);
    btn.click();
    const opt = await waitForEl(() => pageQSA('.rdrStaticRange').find(b => _vis(b) && _clean(b.innerText).toLowerCase() === want.toLowerCase()) || null, 3000);
    if (!opt) { btn.click(); return { ok: false, why: 'the date options did not open' }; }
    opt.click();
    const t0 = Date.now();
    while (Date.now() - t0 < 3000 && _clean(btn.innerText) === before) await sleep(150);
    // the popover stays open after a pick — close it so it doesn't cover the panels
    if (pageQSA('.rdrStaticRange').some(_vis)) { btn.click(); await sleep(250); }
    if (pageQSA('.rdrStaticRange').some(_vis)) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle(2200, { quiet: 600 });
    return { ok: true, range: _clean(btn.innerText) };
}
async function _clickTab(card, re) {
    const tab = [...card.querySelectorAll('[role="tab"]')].find(t => re.test(_clean(t.innerText)));
    if (!tab) return false;
    if (tab.getAttribute('aria-selected') !== 'true') { tab.click(); await settle(1600, { quiet: 500 }); }
    return true;
}
function _tableRows(card) {
    const t = [...card.querySelectorAll('table')].find(x => _vis(x) && x.querySelector('thead th'));
    if (!t) return { heads: [], rows: [] };
    const heads = [...t.querySelectorAll('thead th')].map(h => _clean(h.innerText));
    const rows = [...t.querySelectorAll('tbody tr')].filter(tr => _vis(tr) && !isTotalsRow(tr))
        .map(tr => [...tr.cells].map(td => _clean(td.innerText)))
        .filter(r => r.some(Boolean) && !/no (records?|data|sales insight)/i.test(r.join(' ')));
    return { heads, rows };
}
// Which panel a question is about. Returns { title-regex, tab? } or null.
const DASH_INTENTS = [
    { re: /payment\s*mode|mode\s+of\s+payment|(?:paid|pay|paying)\s+(?:by|via|with)|how\s+(?:did|do)\s+(?:customers?|people)\s+pay|cash\s+(?:vs|or|and)\s+(?:upi|card)|\bupi\b|\bwallet\b/i, panel: /payment\s*mode/i },
    { re: /receivabl|payabl|outstanding|who\s+owes|owe\s+me|\bdues?\b|ageing|aging|overdue|to\s+(?:receive|collect|pay)\b/i, panel: /receivables/i,
      tab: q => /payabl|to\s+pay|(?:i|we)\s+owe|supplier/i.test(q) ? /^payable$/i : /^receivable$/i },
    { re: /customer\s+(?:insight|segment)|segments?\b|champion|loyal|at\s+risk|hibernat|can'?t\s+lose|needs\s+attention|potential\s+loyalist|promising|\brfm\b|(?:top|best|lost|regular|vip|risky?)\s+customers?/i, panel: /customer\s+insight/i },
    { re: /(?:best|top|most|fast)[\s-]*(?:selling|sold|moving)|least[\s-]*(?:selling|sold)|slow[\s-]*moving|worst[\s-]*selling|top\s+(?:\d+\s+)?(?:products?|items?)/i, panel: /selling/i,
      tab: q => /least|slow|worst/i.test(q) ? /^least\s+selling$/i : /^best\s+selling$/i },
    { re: /sales\s+breakdown|category[\s-]*wise|by\s+category|category\s+sales|sales\s+by\s+category/i, panel: /sales\s+breakdown/i, tab: () => /^table$/i },
    { re: /top\s+(?:\d+\s+)?expenses?|biggest\s+expenses?|expense\s+breakdown|where.*(?:spend|spent)/i, panel: /top\s+expenses/i, tab: () => /^table$/i },
    { re: /top\s+(?:\d+\s+)?coupons?|coupons?\s+(?:used|usage|redeemed)/i, panel: /top\s+coupons/i, tab: () => /^table$/i },
    { re: /\btrend\b|sales\s+(?:vs|versus|and)\s+purchases?|purchases?\s+(?:vs|versus)\s+sales|graph|chart/i, panel: /trend/i },
    { re: /business\s+health|\bbhi\b|health\s+(?:indicator|index|score)|how\s+healthy|score\s+of\s+my\s+business/i, panel: /business\s+health/i },
    // V9.14.0: Target vs Actual is its own card next to the BHI score
    { re: /\btargets?\b/i, panel: /target\s+vs|target/i },
];

async function answerDashV2(data, question) {
    let panels = dashPanelsV2();
    let tiles = dashTilesV2();
    const q = String(question || '');
    const nq = q.toLowerCase();
    const notes = [];
    const syncM = _clean(pageText()).match(/last synced:?\s*([\d\/]+,?\s*[\d:]+)/i);

    // A panel asked for by name (works for panels added after this was written)
    let intent = DASH_INTENTS.find(x => x.re.test(q));
    let panel = intent ? panels.find(p => intent.panel.test(p.title)) : null;
    if (!panel) {
        const named = panels.filter(p => p.title.length > 4).find(p => vasyNorm(q).includes(vasyNorm(p.title.split(' / ')[0])));
        if (named) { panel = named; intent = intent || { panel: new RegExp(named.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }; }
    }

    // Tiles: label words in the question ("total sales", "cash in hand", "avg cart value")
    const nrm = x => String(x || '').toLowerCase().replace(/\baverage\b/g, 'avg').replace(/\bquantity\b/g, 'qty').replace(/\brevenue\b|\bturnover\b/g, 'sales')
                                     .replace(/\bno\.?\b/g, 'no').replace(/[^a-z0-9% ]/g, ' ').replace(/\s+/g, ' ').trim();
    const qn = nrm(q);
    const scoreTile = t => {
        const ln = nrm(t.label);
        if (qn.includes(ln)) return 1 + ln.length / 100;                  // longest exact label wins ("total sales return")
        const words = ln.split(' ').filter(w => w.length >= 3 && w !== 'total');
        if (!words.length) return 0;
        return words.filter(w => qn.split(' ').some(x => x === w || (x.length >= 4 && vasyFuzzy(x, w) >= 0.86))).length / words.length;
    };
    let tileHits = tiles.map(t => ({ ...t, score: scoreTile(t) })).filter(t => t.score >= 0.99).sort((a, b) => b.score - a.score);
    // "sales" alone means Total Sales, not every tile with "sales" in it
    if (tileHits.length > 1 && tileHits[0].score > 1) tileHits = tileHits.filter(t => t.score > 1).slice(0, 2);
    tileHits = tileHits.slice(0, 3);
    if (panel && intent && !/^total\b|\bkpi\b/i.test(q) && tileHits.every(t => t.score < 1.05)) tileHits = [];

    if (!panel && !tileHits.length) {
        // nothing specific: offer what this dashboard can answer
        const shown = tiles.slice(0, 8).map(t => `<b>${t.label}</b> ${t.short}`).join(' · ');
        // retryParse: the bubble asks again with the dashboard tier off, so a question
        // that was never about the dashboard ("what Sharma owes") gets another reading
        reply('info', 'On your dashboard', `I couldn't match “${q.replace(/</g, '&lt;')}” to a tile or panel.` +
            (shown ? `<br><small>Tiles: ${shown}</small>` : '') +
            `<br><small>Panels: ${panels.map(p => p.title).join(' · ')}</small>`, { retryParse: true, question: q });
        return;
    }

    const parts = [];
    // ── tiles (page-wide date range) ──
    if (tileHits.length) {
        let range = '';
        if (data.period) {
            const r = await setDashRangeV2(_globalDateBtn(panels), data.period);
            if (r.ok) { range = r.range; tiles = dashTilesV2(); tileHits = tileHits.map(h => ({ ...tiles.find(t => t.label === h.label), score: h.score })); }
            else notes.push(r.why);
        }
        if (!range) range = _clean((_globalDateBtn(panels) || {}).innerText || '');
        const arrow = d => d === 'up' ? '▲' : d === 'down' ? '▼' : '';
        parts.push(tileHits.map(t => {
            // the tile's exact value can carry 4–5 decimals ("₹2,74,672.00000"): keep two
            const v = t.exact && /[\d]/.test(t.exact) ? t.exact.replace(/(\.\d{2})\d*$/, '$1') : t.short;
            return `<b>${t.label}:</b> ${v}` + (t.change ? ` <small>(${arrow(t.dir)} ${t.change} vs the previous period)</small>` : '');
        }).join('<br>') + (range ? `<br><small>📅 ${range}</small>` : ''));
    }

    // ── one panel (its own date range, its own tabs) ──
    if (panel) {
        const card = panel.card;
        if (data.period) {
            const r = await setDashRangeV2(_dateBtnIn(card), data.period);
            if (!r.ok) notes.push(r.why);
        }
        if (intent && intent.tab) await _clickTab(card, intent.tab(q));
        const lines = _panelLines(card);
        const range = _clean((_dateBtnIn(card) || {}).innerText || '');
        const empty = lines.find(l => /^no .*(found|data)/i.test(l) || /coming soon/i.test(l));
        let body = '';
        const t = panel.title;
        if (/payment\s*mode/i.test(t)) {
            const i = lines.findIndex(l => /^total\s/i.test(l));
            const pairs = [];
            for (let k = (i >= 0 ? i + 2 : 0); k < lines.length - 1; k++) if (/^₹|^-?[\d,]+\.\d/.test(lines[k + 1]) && /^[A-Za-z]/.test(lines[k])) pairs.push([lines[k], lines[k + 1]]);
            body = pairs.length ? pairs.map(([m, a]) => `${m} <b>${a}</b>`).join(' · ') + (i >= 0 ? `<br><small>${lines[i].toLowerCase().replace(/^./, c => c.toUpperCase())}: ${lines[i + 1]}</small>` : '') : '';
        } else if (/receivables/i.test(t)) {
            const today = [];
            lines.forEach((l, k) => { if (/^today'?s\s+(receivable|payable):?$/i.test(l) && lines[k + 1]) today.push(`${l.replace(/:$/, '')} <b>${lines[k + 1]}</b>`); });
            const { heads, rows } = _tableRows(card);
            const tab = ([...card.querySelectorAll('[role="tab"]')].find(x => x.getAttribute('aria-selected') === 'true') || {}).innerText || '';
            const ni = heads.findIndex(h => /name/i.test(h)), ai = heads.findIndex(h => /total\s+outstanding|amount/i.test(h));
            body = today.join(' · ') + '<br>' + (rows.length
                ? `<b>${_clean(tab) || 'Outstanding'}</b>:<br>` + rows.slice(0, 6).map((r, k) => `${k + 1}. ${r[ni >= 0 ? ni : 1] || r.find(Boolean)} — <b>${r[ai >= 0 ? ai : 3] || ''}</b>`).join('<br>')
                : `No ${_clean(tab).toLowerCase() || 'outstanding'} amounts in this period.`);
        } else if (/customer\s+insight/i.test(t)) {
            const segs = [];
            for (let k = 0; k < lines.length - 2; k++) if (/^-?[\d.]+%$/.test(lines[k + 1]) && /customers?$/i.test(lines[k + 2])) segs.push({ name: lines[k], pct: lines[k + 1], n: lines[k + 2] });
            const asked = segs.filter(sg => new RegExp(sg.name.replace(/'/g, "'?").replace(/\s+/g, '\\s+'), 'i').test(q));
            const pick = asked.length ? asked : segs.slice().sort((a, b) => parseInt(b.n) - parseInt(a.n));
            body = pick.map(sg => `<b>${sg.name}</b> — ${sg.n} <small>(${sg.pct})</small>`).join('<br>');
        } else if (/business\s+health|target\s+vs/i.test(t)) {
            // V9.14.0: two neighbouring cards — "Business Health Index (BHI)": "83.6%" "801/900"
            // "Excellent" "Your BHI Score as of 21st Oct '2026: 10:25 AM" "Refresh Score"; and
            // "Target vs Actual": "No target set" (or the targets). Answer from both.
            const cardOf = re => (panels.find(p => re.test(p.title)) || {}).card;
            const textAfter = (c, re) => { const x = c ? _clean(c.innerText) : ''; const m = x.match(re); return m ? x.slice(m.index + m[0].length).trim() : x; };
            const after = textAfter(cardOf(/business\s+health/i), /business\s+health\s+ind\w*\s*(?:\(bhi\))?/i);
            const pct = (after.match(/(\d+(?:\.\d+)?)\s*%/) || [])[1];
            const pts = after.match(/(\d+)\s*\/\s*(\d+)/);
            const rate = (after.match(/\d+\s*\/\s*\d+\s+([A-Za-z][A-Za-z ]{2,20}?)(?=\s+(?:Your|BHI|Refresh|Target)|$)/) || [])[1];
            const asOf = (after.match(/score\s+as\s+of\s+(.+?)(?=\s+Refresh|\s+Target|$)/i) || [])[1];
            const tva = textAfter(cardOf(/target\s+vs/i), /target\s+vs\.?\s+actual/i).replace(/^filter\s+target\s+vs\.?\s+actual\s*/i, '');
            const tvaLine = tva ? `Target vs Actual: ${/no target/i.test(tva) ? 'no target set yet — set one with <b>BHI Config</b> on the dashboard' : tva.slice(0, 220)}` : '';
            const score = (pct || pts) ? `Business Health Index: <b>${pct ? pct + '%' : ''}</b>${pts ? ` (${pts[1]}/${pts[2]} points)` : ''}${rate ? ` — <b>${rate}</b>` : ''}` : '';
            body = (/\btargets?\b/i.test(q) ? [tvaLine, score] : [score, tvaLine]).filter(Boolean).join('<br>') +
                   (asOf ? `<br><small>Score as of ${asOf}</small>` : '');
        } else {
            const { heads, rows } = _tableRows(card);
            if (rows.length) {
                const skip = heads.map((h, k) => (/^#$|^action$/i.test(h) ? k : -1)).filter(k => k >= 0);
                const want = /all|full|every/i.test(q) ? 15 : 6;
                body = rows.slice(0, want).map((r, k) => `${k + 1}. ` + r.filter((c, ci) => !skip.includes(ci) && c).slice(0, 4).map((c, ci) => ci === 0 ? `<b>${c}</b>` : c).join(' — ')).join('<br>') +
                       (rows.length > want ? `<br><small>…and ${rows.length - want} more on the dashboard</small>` : '');
            } else {
                // trend-style summaries: value / change / label triples
                const trip = [];
                for (let k = 0; k < lines.length - 2; k++) if (/^₹|^-?[\d.,]+\s*(K|L|Cr)?$/i.test(lines[k]) && /%$/.test(lines[k + 1]) && /^[A-Za-z]/.test(lines[k + 2])) trip.push(`${lines[k + 2]} <b>${lines[k]}</b>`);
                body = trip.join(' · ');
            }
        }
        if (!body) body = empty ? (/coming soon/i.test(empty) ? `VasyERP shows this panel as <b>coming soon</b> — there's nothing to read yet.` : `${empty} for this period.`) : `I opened <b>${t}</b> but couldn't read figures from it.`;
        const link = [...card.querySelectorAll('a[href]')].find(a => /detailed\s+report/i.test(a.innerText || ''));
        // the panel's name is the reply's title when it is the only thing asked about
        parts.push((tileHits.length ? `<b>${t}</b><br>` : '') + body + `<br><small>${range ? '📅 ' + range : ''}${link ? `${range ? ' · ' : ''}<a href="${link.href}" target="_blank">View detailed report</a>` : ''}</small>`);
    }
    const meta = [syncM ? `🕐 Last synced ${syncM[1]}` : '', ...notes].filter(Boolean).join(' · ');
    // An answer is titled by what it answers — never the generic "saved!" cheer
    const title = panel && !tileHits.length ? panel.title.split(' / ')[0].replace(/^Best Selling$/, 'Best & Least Selling')
                : tileHits.length === 1 && !panel ? tileHits[0].label : 'From your dashboard';
    reply('success', title, parts.join('<br><br>') + (meta ? `<br><small style="color:#999">${meta}</small>` : ''));
}

async function answerPageQuestion(data) {
    let question = (data.question || '').trim();
    if (!question) { reply('error', null, 'What would you like to know?'); return; }

    // ── Financial-year switch (explicit year like "FY 2024-25") ──────────────
    if (data.fySwitch) {
        const wrap = pageQS('.financial-year-dash');
        const has = wrap && [...wrap.querySelectorAll('a.m-nav__link,a')].some(a => (a.innerText || '').includes(data.fySwitch));
        const current = (wrap?.querySelector('.yrText')?.innerText || '').trim();
        if (current.includes(data.fySwitch)) {
            if (!/[a-z]{4,}/i.test(question.replace(/\b(change|switch|set|to|fy|financial|year)\b/gi, '').replace(/[\d\s-]/g, ''))) {
                reply('success', null, `Already on <b>FY ${data.fySwitch}</b> ✓`); return;
            }
            // already on the right FY — fall through and answer the question
        } else if (wrap) {
            if (!has) { reply('error', null, `FY <b>${data.fySwitch}</b> isn't in the financial-year list. Open the FY dropdown (top-left) to see available years.`); return; }
            // The switch reloads the page, so confirm FIRST, then click.
            reply('success', null, `Switching to <b>FY ${data.fySwitch}</b>… the page will reload with that year's data. ${/[?]|sales|profit|total|stock/i.test(question) ? 'Ask your question again once it loads.' : ''}`);
            await sleep(300);
            await setFinancialYear(data.fySwitch);
            return;
        } else {
            reply('error', null, 'Financial-year selector not found on this page — open the Dashboard and try again.'); return;
        }
    }

    // ── The redesigned dashboard has its own reader ──────────────────────────
    // It renders after the page loads: wait for it before falling back to the
    // old reader, which misread the new tiles ("Best Selling: 14%").
    if (/^\/dashboard/.test(location.pathname)) await waitForEl(() => isDashV2() ? true : null, 9000);
    if (isDashV2()) {
        await waitForEl(() => dashTilesV2().length >= 3 ? true : null, 8000);
        await answerDashV2(data, question);
        return;
    }

    // ── Date-period selection (Today / Yesterday / This Month / …) ───────────
    let periodNote = '';
    if (data.period) {
        const ok = await setDashboardPeriod(data.period);
        periodNote = ok ? `📅 ${data.period}` : '';
        if (!ok && document.getElementById('fromToDate')) periodNote = '';
        // Strip the period phrase so it doesn't pollute label matching below.
        question = question.replace(/\b(for|in|of|during)?\s*(today|yesterday|this\s+week|this\s+month|last\s+15\s+days|last\s+30\s+days|past\s+month|this\s+quarter|last\s+quarter|this\s+(financial\s+year|fy)|last\s+(financial\s+year|fy)|current\s+fy)\b/gi, ' ').replace(/\s+/g, ' ').trim() || data.question;
    }

    // Normalize with synonyms so user vocabulary matches tile labels.
    const nrm = s => String(s || '').toLowerCase()
        .replace(/[^a-z0-9 %]/g, ' ')
        .replace(/\bquantity\b/g, 'qty')
        .replace(/\baverage\b/g, 'avg')
        .replace(/\bbasket\b/g, 'cart')
        .replace(/\brevenue\b/g, 'sales')
        .replace(/\bturnover\b/g, 'sales')
        .replace(/\bearnings?\b/g, 'profit')
        .replace(/\s+/g, ' ').trim();
    const nq = nrm(question);
    const STOP = new Set(['what','whats','how','many','much','who','whose','which','show','tell','give','list','any','my','our','the','is','are','was','were','do','does','did','have','has','had','can','could','will','would','of','in','on','at','for','to','and','or','me','we','you','it','there','here','today','yesterday','week','month','quarter','year','now','current','currently','please','right','this','last','past','days']);
    const qContent = nq.split(' ').filter(w => w.length >= 3 && !STOP.has(w));

    // Forward: question contains the label / its words. Reverse (tiles only):
    // every content word of a short question is found in the label —
    // handles "how many products" → "Total Products".
    function scoreLabel(label, allowReverse) {
        const nl = nrm(label);
        if (!nl || nl.length < 3) return 0;
        if (nq.includes(nl)) return 1;
        const words = nl.split(' ').filter(w => w.length >= 3);
        if (!words.length) return 0;
        const fwd = words.filter(w => nq.includes(w) || nq.split(' ').some(qw => qw.length >= 3 && vasyFuzzy(qw, w) >= 0.85)).length / words.length;
        let rev = 0;
        if (allowReverse && qContent.length && qContent.length <= 4) {
            rev = 0.9 * (qContent.filter(qw => nl.includes(qw) || words.some(w => vasyFuzzy(qw, w) >= 0.85)).length / qContent.length);
        }
        return Math.max(fwd, rev);
    }

    // ── 1) Announcements / version questions ─────────────────────────────────
    if (/\b(announce|version|what'?s new|release|update log|changelog)\b/i.test(question)) {
        const bodyLines = pageText().split('\n').map(l => l.trim()).filter(Boolean);
        const idx = bodyLines.findIndex(l => /important announcement/i.test(l));
        if (idx >= 0) {
            const chunk = bodyLines.slice(idx + 1, idx + 10).filter(l => l.length > 2).slice(0, 8);
            reply('success', 'Latest announcement', chunk.map(l => `• ${l}`).join('<br>'));
            return;
        }
    }

    // Accepts plain numbers plus ₹/$/Rs prefixes and Indian-unit suffixes: "₹2341", "-29.20 L", "2.26 C", "15.77"
    const numRe = /^(₹|\$|rs\.?)?\s*-?[\d,]+(\.\d+)?\s*(%|C|Cr|L|K|Lakh|Crore)?$/i;

    function extract() {
        // Stat tiles — consecutive text lines: numeric value then its label
        const lines = pageText().split('\n').map(l => l.trim()).filter(Boolean);
        const tiles = [];
        for (let i = 0; i < lines.length - 1; i++) {
            if (numRe.test(lines[i]) && /^[A-Za-z][A-Za-z ()./%&'-]{2,45}$/.test(lines[i + 1]) && !numRe.test(lines[i + 1])) {
                tiles.push({ label: lines[i + 1], value: lines[i] });
            }
        }
        // Tables — headers + rows, with a nearby title.
        // The Help & Shortcuts panel ships THREE tables (keyboard shortcuts,
        // downloads, sessions) on EVERY page, so without this filter a report
        // question could be answered with "F2 Dashboard".
        const tables = [...pageQSA('table')]
            .filter(t => t.offsetParent && !isChromeEl(t))
            .map(t => {
            const headers = [...t.querySelectorAll('thead th, thead td, tr:first-child th')].map(h => h.innerText.trim()).filter(Boolean);
            const rows = [...t.querySelectorAll('tbody tr')]
                // Skip sticky/footer TOTALS rows (v9.12.0 pinned them inside the
                // grid) so they're never reported as if they were data rows.
                .filter(tr => !isTotalsRow(tr))
                .map(tr => [...tr.querySelectorAll('td')].map(td => td.innerText.trim()))
                .filter(r => r.length && r.some(c => c) && !/no data found/i.test(r.join(' ')))
                .slice(0, 25);
            let title = '', pickerId = '';
            let el = t.parentElement;
            for (let hops = 0; hops < 5 && el; hops++) {
                // Stop before shared ancestors that hold OTHER widgets' tables —
                // otherwise TO PAY's heading can bleed onto TODAY'S PAYABLE etc.
                if (el.querySelectorAll('table').length > 1) break;
                const h = el.querySelector('h1,h2,h3,h4,h5,h6,[class*="title" i],[class*="head" i]');
                const txt = h ? (h.innerText || '').trim().split('\n')[0] : '';
                if (!pickerId) pickerId = el.querySelector('input.todaybtn-datepicker')?.id || '';
                if (txt && txt.length < 60) { title = txt; break; }
                el = el.parentElement;
            }
            return { title, headers, rows, pickerId };
        }).filter(t => t.rows.length);
        // "Last synced: <timestamp>" freshness note if the page shows one
        const syncIdx = lines.findIndex(l => /last synced/i.test(l));
        const synced = syncIdx >= 0 ? (lines[syncIdx].replace(/last synced:?\s*/i, '') || lines[syncIdx + 1] || '') : '';
        return { tiles, tables, synced: /\d/.test(synced) ? synced : '' };
    }

    // Dashboard widgets server-render STALE cached rows first, then AJAX refreshes
    // them — so don't just wait for data to EXIST, wait for it to STABILIZE:
    // two consecutive extracts with identical table content (or timeout).
    let tiles = [], tables = [], synced = '';
    const fingerprint = t => JSON.stringify(t.map(x => [x.title, x.rows.slice(0, 3)]));
    let prevFp = null, stable = false;
    const end = Date.now() + 10000;
    while (Date.now() < end) {
        ({ tiles, tables, synced } = extract());
        if (tiles.length >= 3 || tables.length) {
            const fp = fingerprint(tables);
            if (prevFp !== null && fp === prevFp) { stable = true; break; }
            prevFp = fp;
        }
        await settle(1100);
    }
    if (!stable) { await sleep(800); ({ tiles, tables, synced } = extract()); }

    const tileHits = tiles
        .map(tl => ({ ...tl, score: scoreLabel(tl.label, true) }))
        .filter(tl => tl.score >= 0.6)
        .sort((a, b) => b.score - a.score)
        .filter((tl, i, arr) => arr.findIndex(x => x.label === tl.label) === i)
        .slice(0, 4);

    const tableHits = tables
        .map(tb => ({ ...tb, score: Math.max(scoreLabel(tb.title, false), scoreLabel(tb.headers.join(' '), false) * 0.8) }))
        .filter(tb => tb.score >= 0.5)
        .sort((a, b) => b.score - a.score);

    // ── Compose the answer ────────────────────────────────────────────────────
    const parts = [];
    if (tileHits.length) {
        parts.push(tileHits.map(tl => `<b>${tl.label}:</b> ${tl.value}`).join('<br>'));
    }
    if (tableHits.length && (!tileHits.length || tableHits[0].score >= 0.75)) {
        let tb = tableHits[0];
        // The dashboard's widget tables each have their OWN date picker — sync it
        // to the requested period so the table data matches what's asked.
        if (data.period && tb.pickerId && tb.pickerId !== 'fromToDate') {
            const okT = await setDashboardPeriod(data.period, tb.pickerId);
            if (okT && !periodNote) periodNote = `📅 ${data.period}`;
        }
        // SETTLE the chosen table: during widget refresh the SPA transiently keeps
        // old + new rows in the same tbody (that's how a stale "Mountwell" row
        // sneaks in). Re-read until two consecutive reads of THIS table agree.
        let last = JSON.stringify(tb.rows);
        for (let s = 0; s < 4; s++) {
            await settle(1300);
            const fresh = extract().tables.find(x => x.title === tb.title);
            if (!fresh || !fresh.rows.length) continue;
            const now = JSON.stringify(fresh.rows);
            tb = { ...fresh, score: tb.score };
            if (now === last) break;
            last = now;
        }
        // Dedupe rows (same party+doc appearing twice from old/new render passes)
        const seenRow = new Set();
        tb.rows = tb.rows.filter(r => {
            const key = r.filter(c => c).slice(0, 3).join('|');
            if (seenRow.has(key)) return false;
            seenRow.add(key); return true;
        });
        const wantAll = /\ball\b|\bfull\b|\bevery\b/i.test(question);
        const rows = tb.rows.slice(0, wantAll ? 15 : 5);
        const list = rows.map((r, i) => {
            let cells = r.filter(c => c);
            // Drop the table's own "#" column so we don't double-number rows
            if (cells.length > 1 && /^\d{1,3}$/.test(cells[0])) cells = cells.slice(1);
            return `${i + 1}. ${cells.slice(0, 4).join(' — ')}`;
        }).join('<br>');
        parts.push(`<b>${tb.title || 'Matching table'}</b><br>${list}${tb.rows.length > rows.length ? `<br><small style="color:#999">…and ${tb.rows.length - rows.length} more rows on the page</small>` : ''}`);
    }

    if (parts.length) {
        const meta = [data.reportName ? `📊 ${data.reportName}` : '', periodNote, synced ? `🕐 Live as of ${synced}` : ''].filter(Boolean).join(' · ');
        const metaHtml = meta ? `<br><small style="color:#999">${meta}</small>` : '';
        reply('success', null, parts.join('<br><br>') + metaHtml);
    } else {
        // Smart fallback — AUTO-OPEN the right report and re-ask there (once).
        const SUGGEST = [
            [/dead\s*stock|ageing|aging/i,            'stock ageing',            'Stock Ageing Report'],
            [/gst|tax\s+liab/i,                       'tax summary',             'Tax Summary'],
            [/staff|salesman|employee.*(perform|sale)/i, 'employee performance report', 'Employee Performance Report'],
            [/busiest|day\s+of\s+week|hourly/i,       'daily sales summary',     'Day-wise Sales Summary'],
            [/expir/i,                                'inventory report',        'Inventory Report'],
            [/margin.*(product|sku)|profitab|product.*profit/i, 'product wise sales', 'Product-wise Sales Summary'],
            [/stock\s+(register|summary|movement)/i,  'inventory report',        'Inventory Report'],
        ];
        const hit = SUGGEST.find(([re]) => re.test(question));
        const url = hit ? REPORT_URLS[hit[1]] : null;
        if (url && !data.autoOpened) {
            // Navigate to the report and re-run this question there. No reply here —
            // the bubble is still awaiting; the report-page answer becomes the reply.
            chrome.runtime.sendMessage({
                action: 'inject_on_navigate',
                url: location.origin + url,
                message: { action: 'page_qa', data: { question: data.question, autoOpened: true, reportName: hit[2] } }
            });
            return;
        }
        const tip = hit ? `I opened <b>${hit[2]}</b> but couldn't extract that value — adjust its filters and ask again.`
                        : `Open the <b>Dashboard</b> or the relevant <b>report</b>, then ask again — I read whatever is on screen.`;
        reply('info', null, `I couldn't spot "<b>${question}</b>" here. ${tip}`);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

if (!window.__vasyAgentV10) {
    window.__vasyAgentV10 = true;
    chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
        // Acknowledge at once: the bubble listens on this tab too, so without an
        // ack the background could not tell "received" from "lost while the page
        // was changing" (it retries once on no-ack). The id stops a retry running twice.
        if (req && req.__vasyId) {
            try { sendResponse({ ack: true }); } catch (e) {}
            if (window.__vasySeenId === req.__vasyId) return;
            window.__vasySeenId = req.__vasyId;
        }
        // breadcrumb for diagnosing "nothing happened": which command arrived, when
        try { document.documentElement.dataset.vasyAgentLast = (req.action || '?') + ':' + (req.entity || '') + '@' + Date.now(); } catch (e) {}
        if (req.action !== 'agent_result') { __vasyT0 = Date.now(); try { document.documentElement.dataset.vasyTrace = ''; } catch (e) {} vtrace(req.action + ':' + (req.entity || '')); }
        // An expired session sends every page to /login — say so, instead of letting a
        // handler report "No product matches …" for a product that exists.
        if (req.action !== 'agent_result' && /^\/login\b/i.test(location.pathname)) {
            reply('error', 'Signed out', 'Your VasyERP session has expired — sign in again, then repeat the command. Nothing was done.');
            return;
        }
        const d = norm(req.data || {}, req.entity);
        switch (req.action) {
            case 'create_record':
                __vasyWarnNote = '';
                try { chrome.storage.local.remove('vasyPendingNote'); } catch (e) {}
                // Pre-flight: session + explicit permission denial on this page
                __vasyTask = req.entity;
                if (permissionBlocked(req.entity)) break;
                switch (req.entity) {
                    case 'Contact':               safeRun(() => createContact(d),               'Contact');               break;
                    case 'Employee':              safeRun(() => createEmployee(d),              'Employee');              break;
                    case 'Product':               safeRun(() => createProduct(d),               'Product');               break;
                    case 'PurchaseOrder':         safeRun(() => createPurchaseOrder(d),         'PurchaseOrder');         break;
                    case 'MaterialInward':        safeRun(() => createMaterialInward(d),        'MaterialInward');        break;
                    case 'SupplierBill':          safeRun(() => createSupplierBill(d),          'SupplierBill');          break;
                    case 'SalesOrder':            safeRun(() => createSalesOrder(d),            'SalesOrder');            break;
                    case 'SalesInvoice':          safeRun(() => createSalesInvoice(d),          'SalesInvoice');          break;
                    case 'SalesReturn':           safeRun(() => createSalesReturn(d),           'SalesReturn');           break;
                    case 'SalesEstimate':         safeRun(() => createSalesEstimate(d),         'SalesEstimate');         break;
                    case 'StockAdjust':           safeRun(() => createStockAdjustment(d),       'StockAdjust');           break;
                    case 'StockTransfer':         safeRun(() => createStockTransfer(d),         'StockTransfer');         break;
                    case 'StockTransferRequest':  safeRun(() => createStockTransferRequest(d),  'StockTransferRequest');  break;
                    case 'MaterialConsumption':   safeRun(() => createMaterialConsumption(d),   'MaterialConsumption');   break;
                    case 'CRMLead':               safeRun(() => createCRMLead(d),               'CRMLead');               break;
                    case 'Payment':               safeRun(() => createPayment(d),               'Payment');               break;
                    case 'Receipt':               safeRun(() => createReceipt(d),               'Receipt');               break;
                    case 'Expense':               safeRun(() => createExpense(d),               'Expense');               break;
                    case 'InternalTransfer':      safeRun(() => createInternalTransfer(d),      'InternalTransfer');      break;
                    case 'DeliveryChallan':       safeRun(() => createDeliveryChallan(d),       'DeliveryChallan');       break;
                    case 'BillOfMaterials':       safeRun(() => createBillOfMaterials(d),       'BillOfMaterials');       break;
                    case 'Recipe':                safeRun(() => createRecipe(d),                'Recipe');                break;
                    case 'MaterialCreation':      safeRun(() => createMaterialCreation(d),      'MaterialCreation');      break;
                    case 'JournalVoucher':        safeRun(() => createJournalVoucher(d),        'JournalVoucher');        break;
                    case 'POSSale':               safeRun(() => createPOSSale(d),               'POSSale');               break;
                    case 'PurchaseReturn':        safeRun(() => createPurchaseReturn(d),        'PurchaseReturn');        break;
                    case 'Coupon':                safeRun(() => createCoupon(d),                'Coupon');                break;
                    case 'Membership':            safeRun(() => createMembership(d),            'Membership');            break;
                    case 'Discount':              safeRun(() => createDiscount(d),              'Discount');              break;
                    case 'Branch':                safeRun(() => createBranch(d),                'Branch');                break;
                    case 'Category':              safeRun(() => createItemMaster('Category', d), 'Category'); break;
                    case 'Brand':                 safeRun(() => createItemMaster('Brand', d), 'Brand'); break;
                    case 'OpeningStock':          safeRun(() => createOpeningStock(d),          'OpeningStock');          break;
                    case 'Department':            safeRun(() => createItemMaster('Department', d), 'Department'); break;
                    case 'Loyalty':               safeRun(() => adjustLoyaltyPoints(d),         'Loyalty');               break;
                    case 'BarcodeLabels':         safeRun(() => printBarcodes(d),               'BarcodeLabels');         break;
                    case 'Tally':                 safeRun(() => exportToTally(d),               'Tally');                 break;
                    case 'Logs':                  safeRun(() => openLogs(d),                    'Logs');                  break;
                    case 'POSReturn':             safeRun(() => posReturnLookup(d),             'POSReturn');             break;
                    case 'EInvoice':              safeRun(() => triggerEInvoiceOrEWayBill(d, 'EInvoice'),     'EInvoice');          break;
                    case 'EWayBill':              safeRun(() => triggerEInvoiceOrEWayBill(d, 'EWayBill'),     'EWayBill');          break;
                    case 'BankReconciliation':    safeRun(() => openBankReconciliation(d),                    'BankReconciliation'); break;
                    case 'StockVerification':     safeRun(() => createStockVerification(d),                   'StockVerification'); break;
                    case 'BankTransaction':       safeRun(() => createBankTransaction(d),                     'BankTransaction'); break;
                    case 'CategoryVariant':       safeRun(() => createCategoryVariant(d),                     'CategoryVariant'); break;
                    // Unknown module but the dispatcher already navigated us to its
                    // page — hand over honestly instead of a dead-end error.
                    default: reply('info', 'Page Opened',
                        `I've opened the right page for <b>${req.entity}</b>, but I can't fill this form automatically yet. Complete it manually and Save — and tell the developer so this module gets automated next.`);
                }
                break;
            case 'select_batch':      safeRun(() => handleSelectBatch(d),          'BatchSelect'); break;
            case 'edit_record':       safeRun(() => editRecord(req.entity, d),    'Edit');       break;
            case 'fill_edit_form':    safeRun(() => fillEditForm(req.entity, d),  'EditForm');   break;
            case 'search_records':    safeRun(() => searchRecords(d.query, d),    'Search');     break;
            case 'party_balance':     safeRun(() => partyBalance(d),              'Balance');    break;
            case 'stock_query':       safeRun(() => stockQuery(d),                'Stock');      break;
            case 'open_document':     safeRun(() => openDocument(d),              'Open');       break;
            case 'print_document':    safeRun(() => printDocument(d),             'Print');      break;
            case 'page_qa':           safeRun(() => answerPageQuestion(d),        'PageQA');     break;
            case 'pay_bill':          safeRun(() => payBill(d),                   'BillPayment');break;
            case 'toggle_setting':    safeRun(() => toggleSetting(d),             'Setting');    break;
            case 'complete_bill_payment': safeRun(() => completeBillPayment(d),   'BillPayment');break;
            case 'collect_invoice':   safeRun(() => collectInvoice(d),            'InvoiceReceipt');break;
            case 'complete_invoice_receipt': safeRun(() => completeInvoiceReceipt(d), 'InvoiceReceipt');break;
            case 'einvoice_for_doc':  safeRun(() => einvoiceForDoc(d),            'EInvoiceDoc');break;
            case 'trigger_edoc':      safeRun(() => triggerEdoc(d),               'EInvoiceDoc');break;
            case 'create_user_role':  safeRun(() => createUserRole(d),            'UserRole');   break;
            case 'page_opened':       reply('success', 'Page Opened', d.note || 'Here you go — tell me what you\'d like to do on this page.'); break;
            case 'confirm_save':      safeRun(() => confirmSave(d), d.task || 'Save', { confirmed: true }); break;
            case 'approve_transfer':  safeRun(() => approveTransfer(d), 'TransferApproval', { confirmed: !!d.confirmed }); break;
            case 'create_simple_master': safeRun(() => createSimpleMaster(req.entity, d, req.spec), req.entity); break;
            case 'ask_vina':          safeRun(() => askVina(d),                   'Vina');       break;
            case 'read_vina':         safeRun(() => readVinaAnswer(d),            'Vina');       break;
            case 'export_excel':      safeRun(() => exportExcel(d),               'ExportExcel');break;
            case 'po_from_vina':      safeRun(() => poFromVina(d),                'Vina');       break;
            case 'delete_record':     safeRun(() => deleteRecord(d, 'delete'),    'Delete');     break;
            case 'deactivate_record': safeRun(() => deleteRecord(d, 'deactivate'),'Deactivate'); break;
            case 'fill_report':       safeRun(() => fillReport(d),                'Report');     break;
            case 'fill_fields':       safeRun(() => fillFieldsByLabel(req.data || {}), 'FieldFill'); break;
        }
    });
}
} // end window.__vasyAgentDefined guard
