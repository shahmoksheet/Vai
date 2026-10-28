// © 2026 Moksheet Shah. All rights reserved. Shared for viewing only — no copying, modification or redistribution without written permission. See LICENSE.
'use strict';
// content_bubble.js v17.3 — VasyERP Floating Chat Bubble — Premium Red & White UI
// Features: Voice Input, TTS, Smart Context Chips, Command History, Alt+V shortcut, Copy messages
// Upgraded: Bank Reconciliation, Debit Note, Credit Note, CRM chips, richer help

// Print views (/sales/invoice/htmlpdf/<id>, …/<id>/pdf, /receipt/pdf/<id>) are
// pages meant for paper — a chat bubble there would print on the customer's invoice.
if (!window.__vasyBubbleV11 && !/(?:^|\/)(?:html)?pdf(?:\/|$)/i.test(location.pathname)) {
    window.__vasyBubbleV11 = true;

    // ── State ──────────────────────────────────────────────────────────────────
    let conversationState = { entity: null, action: null, fields: {} };
    let awaitingResult = false;
    let failsafeTimer  = null;
    let cmdHistory     = [];
    let historyIdx     = -1;
    let chatLog           = [];   // persisted across page navigations
    let _taskChainResolver = null; // resolves when current chained task completes
    let ttsEnabled     = false;
    let isListening    = false;
    let recognition    = null;
    let vasyLang       = 'en-IN';   // voice input + TTS language

    // ── Context-aware chips per module ────────────────────────────────────────
    // IMPORTANT: more-specific paths must come BEFORE shorter paths that are
    // substrings of them (e.g. /product/stock before /product).
    const CHIP_SETS = {
        // ── Products (specific paths first) ──
        '/product/setup-opening-stock': [{e:'📋',l:'Set Opening Stock',p:'Set opening stock'},{e:'🔍',l:'Search Product',p:'Search product'}],
        '/product/stock':               [{e:'⬆️',l:'Increase Stock',p:'Increase stock of'},{e:'⬇️',l:'Decrease Stock',p:'Decrease stock of'}],
        '/product':                     [{e:'📦',l:'New Product',p:'Create a new product'},{e:'⬆️',l:'Add Stock',p:'Increase stock of'},{e:'📋',l:'Opening Stock',p:'Set opening stock'},{e:'🔍',l:'Search',p:'Search product'},{e:'✏️',l:'Edit Price',p:'Edit product price'}],
        // ── Purchase ──
        '/purchase/materialinward':     [{e:'📦',l:'New GRN',p:'Create material inward'},{e:'🔍',l:'Search GRN',p:'Search material inward'}],
        '/purchase/debitnote':          [{e:'↩️',l:'New Debit Note',p:'Create debit note for supplier return'},{e:'🔍',l:'Search DN',p:'Search debit note'}],
        '/purchase/order':              [{e:'🛒',l:'New PO',p:'Create a new purchase order'},{e:'📦',l:'New GRN',p:'Create material inward'},{e:'🔍',l:'Search PO',p:'Search purchase order'}],
        '/purchase/bill':               [{e:'🧾',l:'New Bill',p:'Create supplier bill'},{e:'💸',l:'Pay Supplier',p:'Record payment to supplier'},{e:'🔍',l:'Search Bill',p:'Search supplier bill'}],
        // ── Sales ──
        '/sales/deliverychallan':       [{e:'🚚',l:'New DC',p:'Create delivery challan'},{e:'📄',l:'E-Way Bill',p:'Generate e-way bill'},{e:'🔍',l:'Search DC',p:'Search delivery challan'}],
        '/sales/creditnote':            [{e:'↩️',l:'New Credit Note',p:'Create credit note for customer return'},{e:'🔍',l:'Search CN',p:'Search credit note'}],
        '/sales/estimate':              [{e:'📋',l:'New Estimate',p:'Create a new sales estimate'},{e:'🔍',l:'Search',p:'Search estimate'}],
        '/sales/invoice':               [{e:'🧾',l:'New Invoice',p:'Create a new sales invoice'},{e:'🔍',l:'Search Invoice',p:'Search sales invoice'},{e:'📄',l:'E-Invoice',p:'Generate e-invoice'},{e:'🚚',l:'E-Way Bill',p:'Generate e-way bill'}],
        '/sales/order':                 [{e:'💰',l:'New SO',p:'Create a new sales order'},{e:'🧾',l:'New Invoice',p:'Create a new sales invoice'},{e:'🔍',l:'Search SO',p:'Search sales order'}],
        // ── Stock ──
        '/stocktransferrequest':        [{e:'📋',l:'New Request',p:'Create stock transfer request'},{e:'🔍',l:'Search',p:'Search transfer request'}],
        '/stocktransfer':               [{e:'🚚',l:'New Transfer',p:'Create stock transfer'},{e:'🔍',l:'Search',p:'Search stock transfer'}],
        '/stockverification':           [{e:'✅',l:'New Verification',p:'Create stock verification'},{e:'📊',l:'Report',p:'Show stock verification report'}],
        '/materialconsumption':         [{e:'🏭',l:'New Consumption',p:'Create material consumption'},{e:'📊',l:'Report',p:'Show consumption production report'}],
        '/materialcreation':            [{e:'⚙️',l:'New Creation',p:'Create material creation'}],
        // ── Contacts & People ──
        '/contact':                     [{e:'👤',l:'New Customer',p:'Create a new customer contact'},{e:'🏭',l:'New Supplier',p:'Create a new supplier contact'},{e:'🔍',l:'Search',p:'Search contact'},{e:'✏️',l:'Edit Contact',p:'Edit contact'}],
        '/employee':                    [{e:'🧑‍💼',l:'New Employee',p:'Create a new employee'},{e:'🔍',l:'Search',p:'Search employee'},{e:'✏️',l:'Edit Employee',p:'Edit employee'}],
        // ── Finance & Bank ──
        '/payment':                     [{e:'💸',l:'New Payment',p:'Record payment to supplier'},{e:'🔍',l:'Search',p:'Search payment'}],
        '/receipt':                     [{e:'💰',l:'New Receipt',p:'Record receipt from customer'},{e:'🔍',l:'Search',p:'Search receipt'}],
        '/expense':                     [{e:'🧾',l:'New Expense',p:'Record expense'},{e:'🔍',l:'Search',p:'Search expense'}],
        '/journalvoucher':              [{e:'📒',l:'New JV',p:'Create journal voucher'},{e:'🔍',l:'Search JV',p:'Search journal voucher'}],
        '/manager/internal':            [{e:'💸',l:'Withdraw Cash',p:'Withdraw cash for employee'},{e:'🔄',l:'Bank Transfer',p:'Transfer between bank accounts'}],
        '/bankreconciliation':          [{e:'🏦',l:'Reconcile',p:'Start bank reconciliation'},{e:'📋',l:'Statement',p:'Show bank reconciliation statement'}],
        // ── POS ──
        '/pos':                         [{e:'🏪',l:'New Sale',p:'New POS sale'},{e:'📊',l:'POS Report',p:'Show POS order list'},{e:'💰',l:'Sales Register',p:'Show sales register report'},{e:'⭐',l:'Check Points',p:'Check loyalty points for customer mobile'},{e:'🎟️',l:'Apply Coupon',p:'Apply coupon code to POS sale'}],
        // ── CRM ──
        '/crm/loyalty':                 [{e:'⭐',l:'Add Points',p:'Add loyalty points to customer mobile'},{e:'➖',l:'Deduct Points',p:'Deduct loyalty points from customer mobile'},{e:'🏅',l:'Assign Plan',p:'Assign membership to customer mobile'},{e:'🔍',l:'Check Points',p:'Check loyalty points for customer mobile'}],
        '/crm/feedback':                [{e:'🔍',l:'Search Feedback',p:'Search customer feedback'},{e:'📊',l:'Sales Report',p:'Show sales report today'}],
        // ── Reports ──
        '/report':                      [{e:'💰',l:'Sales',p:'Show sales report today'},{e:'📦',l:'Stock',p:'Show stock summary'},{e:'📋',l:'GST',p:'Show GST report this month'},{e:'📈',l:'P&L',p:'Show profit loss this month'},{e:'📒',l:'Day Book',p:'Show day book today'},{e:'🏦',l:'Bank Recon',p:'Show bank reconciliation'},{e:'👥',l:'Outstanding',p:'Show customer outstanding'}],
        // ── Masters ──
        '/billofmaterials':             [{e:'📋',l:'New BOM',p:'Create BOM for recipe'},{e:'🔍',l:'Search',p:'Search bill of materials'}],
        '/recipe':                      [{e:'🍽️',l:'New Recipe',p:'Create recipe'},{e:'🔍',l:'Search',p:'Search recipe'}],
        '/coupon':                      [{e:'🎟️',l:'New Coupon',p:'Create coupon'},{e:'💸',l:'Discount',p:'Create discount'},{e:'🏅',l:'Membership',p:'Create membership'}],
        '/discount':                    [{e:'💸',l:'New Discount',p:'Create discount'},{e:'🎟️',l:'New Coupon',p:'Create coupon'}],
        '/membershipmaster':            [{e:'🏅',l:'New Membership',p:'Create membership'}],
        '/branch':                      [{e:'🏪',l:'New Branch',p:'Create branch'}],
        '/categorybrand':               [{e:'🏷️',l:'New Category',p:'Create category'},{e:'©️',l:'New Brand',p:'Create brand'}],
        // ── Dashboard (most frequent actions) ──
        '/dashboard':                   [{e:'📊',l:'Sales Today',p:'total sales today'},{e:'🗓️',l:'Sales This Month',p:'total sales this month'},{e:'💳',l:'Payment Modes',p:'how did customers pay this month'},{e:'💰',l:'Who Owes Me',p:'who owes me money'},{e:'🏆',l:'Champions',p:'who are my champion customers'},{e:'🔥',l:'Best Sellers',p:'best selling products this month'},{e:'💸',l:'Top Expenses',p:'top expenses this month'},{e:'📦',l:'Stock Value',p:'stock value'},{e:'🧾',l:'New Invoice',p:'Create a new sales invoice'},{e:'🏪',l:'POS Sale',p:'New POS sale'}],
    };

    const DEFAULT_CHIPS = [
        {e:'👤',l:'New Customer',p:'Create a new customer contact'},
        {e:'🏭',l:'New Supplier',p:'Create a new supplier contact'},
        {e:'🧑‍💼',l:'New Employee',p:'Create a new employee'},
        {e:'📦',l:'New Product',p:'Create a new product'},
        {e:'🧾',l:'New Invoice',p:'Create a new sales invoice'},
        {e:'🏪',l:'POS Sale',p:'New POS sale'},
        {e:'🛒',l:'New PO',p:'Create a new purchase order'},
        {e:'💸',l:'Pay Supplier',p:'Record payment to supplier'},
        {e:'💰',l:'Collect Receipt',p:'Record receipt from customer'},
        {e:'⭐',l:'Loyalty Points',p:'Add loyalty points to customer mobile'},
        {e:'📊',l:'Sales Report',p:'Show sales report today'},
        {e:'📋',l:'GST Report',p:'Show GST report this month'},
        {e:'🏦',l:'Bank Recon',p:'Open bank reconciliation'},
    ];

    const MODULE_NAMES = {
        '/contact':'Contacts', '/employee':'Employees', '/product':'Products',
        '/purchase/order':'Purchase Orders', '/purchase/materialinward':'Material Inward',
        '/purchase/bill':'Supplier Bills', '/purchase/debitnote':'Purchase Return',
        '/sales/order':'Sales Orders', '/sales/invoice':'Sales Invoices',
        '/sales/creditnote':'Credit Notes', '/sales/estimate':'Estimates',
        '/sales/deliverychallan':'Delivery Challan', '/pos':'POS',
        '/payment':'Payments', '/receipt':'Receipts', '/expense':'Expenses',
        '/stocktransfer':'Stock Transfer', '/stocktransferrequest':'Transfer Request',
        '/materialconsumption':'Material Consumption', '/materialcreation':'Material Creation',
        '/billofmaterials':'Bill of Materials', '/recipe':'Recipes',
        '/product/stock':'Stock Adjust', '/product/setup-opening-stock':'Opening Stock',
        '/journalvoucher':'Journal Voucher', '/manager/internaltransfer':'Internal Transfer',
        '/report':'Reports', '/crm':'CRM', '/branch':'Branches',
        '/categorybrand':'Category/Brand', '/coupon':'Coupons',
        '/discount':'Discounts', '/membershipmaster':'Membership',
        '/stockverification':'Stock Verification', '/crm/loyalty':'Loyalty',
        '/crm/feedback':'Feedback', '/bankreconciliation':'Bank Reconciliation',
        '/dashboard':'Dashboard',
    };

    function getModuleName() {
        const p = location.pathname;
        for (const [k, v] of Object.entries(MODULE_NAMES)) {
            if (p.includes(k)) return v;
        }
        return 'VasyERP';
    }

    // ── Dashboard chips follow the dashboard ─────────────────────────────────
    // VasyERP redesigned its dashboard in Oct 2026 and will again. Rather than a
    // fixed list, the chips come from what is on screen: one per panel present
    // (a panel we don't know yet still gets a "show <panel>" chip) plus the key
    // KPI tiles. Before the dashboard renders, the static set above is used.
    const DASH_PANEL_CHIPS = [
        [/payment\s*mode/i,        [{e:'💳', l:'Payment Modes', p:'how did customers pay this month'}]],
        [/receivables/i,            [{e:'💰', l:'Who Owes Me', p:'who owes me money'}, {e:'💸', l:'What I Owe', p:'show my payables'}]],
        [/customer\s+insight/i,     [{e:'🏆', l:'Champions', p:'who are my champion customers'}, {e:'⚠️', l:'At-Risk Customers', p:'which customers are at risk'}]],
        [/selling/i,                [{e:'🔥', l:'Best Sellers', p:'best selling products this month'}, {e:'🐢', l:'Slow Movers', p:'least selling products this month'}]],
        [/sales\s+breakdown/i,      [{e:'🧩', l:'Category Sales', p:'category wise sales this month'}]],
        [/top\s+expenses/i,         [{e:'🧾', l:'Top Expenses', p:'top expenses this month'}]],
        [/top\s+coupons/i,          [{e:'🎟️', l:'Top Coupons', p:'top coupons this month'}]],
        [/trend/i,                  [{e:'📈', l:'Sales vs Purchase', p:'sales vs purchase trend this month'}]],
        // V9.14.0: the Business Health Index went live (score /900, rating, Target vs Actual)
        [/business\s+health/i,      [{e:'❤️', l:'Business Health', p:'what is my business health score'}]],
        [/coming\s+soon|target\s+vs/i, []],
    ];
    const DASH_TILE_CHIPS = [
        [/^total sales$/i,              [{e:'📊', l:'Sales Today', p:'total sales today'}, {e:'🗓️', l:'Sales This Month', p:'total sales this month'}]],
        [/^avg profit margin \(%\)$/i,  [{e:'💹', l:'Profit Margin %', p:'avg profit margin % this month'}]],
        [/^cash in hand$/i,             [{e:'💵', l:'Cash in Hand', p:'cash in hand'}]],
        [/^stock value$/i,              [{e:'📦', l:'Stock Value', p:'stock value'}]],
        [/^avg cart value$/i,           [{e:'🛒', l:'Avg Cart Value', p:'avg cart value this month'}]],
        [/^total expenses$/i,           [{e:'💸', l:'Expenses', p:'total expenses this month'}]],
    ];
    function dashboardSnapshot() {
        const vis = e => e && e.getClientRects().length && !e.closest('#vasy-root');
        const tiles = [...document.querySelectorAll('[role="button"][aria-label*=": "]')].filter(vis)
            .map(t => (t.getAttribute('aria-label') || '').split(':')[0].trim()).filter(Boolean);
        // headings in the page's own furniture (help/support sidebars, header) are not panels
        const CHROME = 'nav,header,.navbar,#sidebar-menu,.m-aside,.m-header,.supportSidebar__panel,[class*="supportSidebar" i],[class*="helpSidebar" i],[class*="sidebar" i],[role="dialog"]';
        const panels = [...document.querySelectorAll('h3')].filter(h => vis(h) && !h.closest(CHROME))
            .map(h => (h.innerText || '').replace(/\s+/g, ' ').trim()).filter(t => t.length > 2 && t.length < 60);
        if ([...document.querySelectorAll('[role="tab"]')].some(t => /best\s+selling/i.test(t.innerText || ''))) panels.push('Best Selling');
        return { tiles, panels };
    }
    function dashboardChips() {
        const { tiles, panels } = dashboardSnapshot();
        if (tiles.length < 3) return null;                     // not rendered yet / old dashboard
        // Most-asked first, whatever order the panels sit in on the page.
        const ORDER = ['Sales Today', 'Sales This Month', 'Payment Modes', 'Who Owes Me', 'Best Sellers', 'Champions',
                       'Top Expenses', 'Sales vs Purchase', 'Category Sales', 'Slow Movers', 'At-Risk Customers', 'What I Owe', 'Top Coupons'];
        const cand = [], seen = new Set();
        const add = (c, rank) => { if (c && !seen.has(c.p)) { seen.add(c.p); cand.push({ ...c, rank }); } };
        const rankOf = c => { const i = ORDER.indexOf(c.l); return i < 0 ? 50 : i; };
        for (const [re, chips] of DASH_TILE_CHIPS) if (tiles.some(t => re.test(t))) chips.forEach(c => add(c, rankOf(c) < 50 ? rankOf(c) : 70));
        for (const title of panels) {
            const hit = DASH_PANEL_CHIPS.find(([re]) => re.test(title));
            if (hit) hit[1].forEach(c => add(c, rankOf(c)));
            // a panel VasyERP added that we don't know yet still gets asked about
            else add({ e: '🔎', l: title.length > 22 ? title.slice(0, 20) + '…' : title, p: `show ${title.toLowerCase()}` }, 60);
        }
        add({e:'🧾', l:'New Invoice', p:'Create a new sales invoice'}, 90);
        add({e:'🏪', l:'POS Sale', p:'New POS sale'}, 91);
        return cand.sort((a, b) => a.rank - b.rank).slice(0, 14).map(({ rank, ...c }) => c);
    }
    // The type-ahead learns the dashboard too: every tile label becomes a question.
    function learnDashboardSuggestions() {
        const { tiles } = dashboardSnapshot();
        for (const t of tiles) {
            const q = `what is my ${t.toLowerCase()} this month`;
            if (!SUGGESTIONS.includes(q)) SUGGESTIONS.push(q);
        }
    }

    function getChips() {
        const p = location.pathname;
        if (/^\/dashboard/.test(p)) {
            const dyn = dashboardChips();
            if (dyn && dyn.length) { learnDashboardSuggestions(); return dyn; }
        }
        // a document's own page (/sales/invoice/<id>, /receipt/<id> …) — print it first
        if (/^\/(?:sales|purchase)\/\w+\/\d+\/?$|^\/(?:payment|receipt|stocktransfer)\/\d+\/?$/.test(p)) {
            const mod = Object.entries(CHIP_SETS).find(([k]) => p.includes(k));
            return [{e:'🖨️',l:'Print',p:'print this'}, {e:'📄',l:'PDF',p:'download pdf'}, ...((mod && mod[1]) || []).slice(0, 2)];
        }
        for (const [k, chips] of Object.entries(CHIP_SETS)) {
            if (p.includes(k)) return chips;
        }
        return DEFAULT_CHIPS;
    }

    // ── Voice setup ────────────────────────────────────────────────────────────
    function setupRecognition() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return null;
        const r = new SR();
        r.lang = 'en-IN';
        r.continuous = false;
        r.interimResults = true;
        r.maxAlternatives = 1;
        return r;
    }

    // ── Type-ahead command suggestions ────────────────────────────────────────
    // Users shouldn't have to memorise phrasings. As they type we offer the
    // closest real commands — matched on WORDS not prefixes, so "invoce raj" and
    // "raj invoice" both surface the invoice template, and a typo still matches.
    const SUGGESTIONS = [
        'create customer ', 'create supplier ', 'create employee ',
        'create purchase order for ', 'create material inward for ',
        'create supplier bill for ', 'pay supplier bill ',
        'create sales invoice for ', 'create sales order for ',
        'create delivery challan for ', 'create credit note for ',
        'collect invoice ', 'sell ', 'create product ',
        'create stock transfer to ', 'do stock verification for ',
        'stock adjustment ', 'add expense ',
        'journal voucher debit ', 'create bank transaction ',
        'print barcodes for ', 'export sales to tally',
        'create a cashier role', 'create a purchase manager role',
        'set loyalty earn rate 10 points per 100',
        'who changed the settings', 'show user activity log',
        'enable allow negative stock', 'what settings are there for barcodes',
        'what are the total sales today', 'low stock report', 'trial balance',
        'total sales this month', 'how did customers pay this month', 'who owes me money', 'show my payables',
        'who are my champion customers', 'which customers are at risk', 'best selling products this month',
        'least selling products this month', 'category wise sales this month', 'top expenses this month',
        'top coupons this month', 'sales vs purchase trend this month', 'avg cart value this month',
        'avg profit margin % this month', 'cash in hand', 'stock value',
        'how much does Gupta Stores owe', 'stock of ', 'open invoice ', 'find customer ',
        'return pos bill ',
    ];
    // Same edit-distance idea as the parser, kept tiny for the UI.
    function _tokenClose(a, b) {
        if (b.startsWith(a)) return true;
        if (a.length < 4 || Math.abs(a.length - b.length) > 2) return false;
        let d = 0, i = 0, j = 0;
        while (i < a.length && j < b.length && d <= 1) {
            if (a[i] === b[j]) { i++; j++; continue; }
            d++;
            if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
        }
        return d + (a.length - i) + (b.length - j) <= 1;
    }
    // ── Usage model: the box learns what THIS user actually runs ─────────────
    // A shop that raises twenty invoices a day and never touches manufacturing
    // should not keep being offered a bill of materials. Each accepted command
    // decays with a one-week half-life, so the ranking follows the season the
    // business is actually in rather than everything it has ever typed.
    const _HALF_LIFE_DAYS = 7;
    let _cmdStats = {};                      // prefix -> [{t: epochMs}, ...] trimmed
    function loadCmdStats() {
        try { chrome.storage.local.get(['vasyCmdStats'], r => { _cmdStats = r.vasyCmdStats || {}; }); }
        catch (e) {}
    }
    function recordCmdUse(text) {
        try {
            const key = SUGGESTIONS.find(s => text.toLowerCase().startsWith(s.trim().toLowerCase()));
            if (!key) return;
            const now = Date.now();
            const arr = (_cmdStats[key] || []).filter(t => now - t < 90 * 864e5);
            arr.push(now);
            while (arr.length > 40) arr.shift();
            _cmdStats[key] = arr;
            chrome.storage.local.set({ vasyCmdStats: _cmdStats });
        } catch (e) {}
    }
    function usageWeight(key) {
        const arr = _cmdStats[key];
        if (!arr || !arr.length) return 0;
        const now = Date.now();
        let w = 0;
        for (const t of arr) w += Math.pow(0.5, (now - t) / (_HALF_LIFE_DAYS * 864e5));
        return Math.min(1, w / 4);           // 4 recent uses saturates the bonus
    }
    // "cpo" -> "create purchase order": every query letter appearing in order at
    // a word boundary. Power users type initials; this makes that work.
    function _acronymHit(q, phrase) {
        if (q.length < 2 || q.length > 6 || /\s/.test(q)) return false;
        const initials = phrase.toLowerCase().split(/\s+/).filter(Boolean).map(w => w[0]).join('');
        return initials.startsWith(q);
    }
    function suggestionsFor(text) {
        const q = text.trim().toLowerCase();
        if (q.length < 2) return [];
        const words = q.split(/\s+/).filter(Boolean);
        const scored = [];
        for (const s of SUGGESTIONS) {
            const low = s.toLowerCase();
            const sw = low.split(/\s+/).filter(Boolean);
            let hits = 0;
            for (const w of words) if (sw.some(t => _tokenClose(w, t))) hits++;
            const acro = _acronymHit(q, s);
            if (!hits && !acro) continue;
            const score = (hits / words.length)
                        + (low.startsWith(q) ? 1 : 0)      // literal prefix wins
                        + (acro ? 0.8 : 0)                 // initials next
                        + 0.6 * usageWeight(s);            // then personal habit
            scored.push({ s, score });
        }
        return scored.sort((a, b) => b.score - a.score).slice(0, 4).map(x => x.s);
    }
    loadCmdStats();

    function renderSuggestions(text) {
        const box = document.getElementById('vasy-suggest');
        if (!box) return;
        const list = suggestionsFor(text);
        if (!list.length) { box.classList.add('vasy-hidden'); box.innerHTML = ''; return; }
        box.innerHTML = list.map(s =>
            `<button class="vasy-sug" data-cmd="${s.replace(/"/g, '&quot;')}">${s.trim()}</button>`).join('');
        box.classList.remove('vasy-hidden');
        box.querySelectorAll('.vasy-sug').forEach(b => b.addEventListener('click', () => {
            const input = document.getElementById('vasy-input');
            input.value = b.dataset.cmd;
            box.classList.add('vasy-hidden'); box.innerHTML = '';
            input.focus();
            // A complete command runs; one ending in a space still needs a name.
            if (!/\s$/.test(b.dataset.cmd)) document.getElementById('vasy-send')?.click();
        }));
    }

    // Download Chrome's on-device language models. MUST be called from inside a
    // user gesture (a click/change handler) — otherwise Chrome answers
    // "Requires a user gesture when availability is downloading or downloadable".
    // Everything here is optional: where the models can't be fetched the agent
    // simply keeps working in English.
    async function warmLanguageModels(langTag) {
        const lang = String(langTag || '').split('-')[0];
        if (!lang || lang === 'en' || lang === 'auto') return;
        const note = (msg) => { const el = document.getElementById('vasy-lang-note'); if (el) el.textContent = msg; };
        try {
            if (typeof LanguageDetector !== 'undefined') {
                const a = await LanguageDetector.availability();
                if (a === 'downloadable' || a === 'downloading') {
                    note('Downloading the on-device language model… this happens once.');
                    await LanguageDetector.create({ monitor: m => m.addEventListener('downloadprogress',
                        e => note(`Downloading language model… ${Math.round(e.loaded * 100)}%`)) });
                }
            }
            if (typeof Translator !== 'undefined') {
                for (const [from, to] of [[lang, 'en'], ['en', lang]]) {
                    const a = await Translator.availability({ sourceLanguage: from, targetLanguage: to });
                    if (a === 'downloadable' || a === 'downloading') await Translator.create({ sourceLanguage: from, targetLanguage: to });
                }
            }
            note('Ready — speak or type in your language and Vasy will answer in it.');
        } catch (e) {
            note("This browser can't run on-device translation, so Vasy will keep working in English. Voice input still works in your language.");
        }
    }

    // Language the LAST reply came back in (set from the background's _userLang),
    // so we read the answer aloud in the language the user actually spoke.
    let lastReplyLang = '';
    function speak(text) {
        if (!ttsEnabled || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const plain = text.replace(/<[^>]*>/g, ' ').replace(/[✅❌ℹ️⚠️🎉🚀✨👌🙈😅😕📅🕐📊💡🔒🌐]/g, '').replace(/\s+/g, ' ').trim();
        if (!plain || plain.length < 3) return;
        const utt = new SpeechSynthesisUtterance(plain.slice(0, 260));
        // Prefer the language of the reply itself; fall back to the chosen one.
        const want = lastReplyLang ? lastReplyLang + '-IN'
                   : (vasyLang && vasyLang !== 'auto') ? vasyLang
                   : (navigator.language || 'en-IN');
        utt.lang = want;
        const voices = window.speechSynthesis.getVoices() || [];
        const match = voices.find(v => v.lang === want) || voices.find(v => v.lang.startsWith(want.split('-')[0]));
        if (match) utt.voice = match;
        utt.rate = 1.06;
        utt.pitch = 1.03;
        window.speechSynthesis.speak(utt);
    }

    // ── Line icons (stroke = currentColor, so they follow the theme) ────────────
    const ICON = {
        history: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        plus:    '<path d="M12 5v14M5 12h14"/>',
        sun:     '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
        moon:    '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
        spkOn:   '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
        spkOff:  '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m17 9 4 6M21 9l-4 6"/>',
        eye:     '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
        eyeOff:  '<path d="M3 3l18 18"/><path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
        shrink:  '<path d="m7 9 5 5 5-5"/>',
        expand:  '<path d="m7 15 5-5 5 5"/>',
        more:    '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
        gear:    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
        close:   '<path d="M18 6 6 18M6 6l12 12"/>',
        mic:     '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
        send:    '<path d="M5 12h14M13 6l6 6-6 6"/>',
        console: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>',
        grip:    '<path d="M15 21l6-6M9 21l12-12"/>',
    };
    const svg = (name, size = 16) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;
    const setIcon = (btn, name) => { if (btn) btn.innerHTML = svg(name); };

    // Voice languages: tag, short label for the pill, full name
    const VOICE_LANGS = [
        ['auto', 'Auto', '🌐 Auto-detect'], ['en-IN', 'EN', 'English (India)'], ['hi-IN', 'हि', 'हिन्दी — Hindi'],
        ['gu-IN', 'ગુ', 'ગુજરાતી — Gujarati'], ['mr-IN', 'म', 'मराठी — Marathi'], ['ta-IN', 'த', 'தமிழ் — Tamil'],
        ['te-IN', 'తె', 'తెలుగు — Telugu'], ['bn-IN', 'বা', 'বাংলা — Bengali'], ['kn-IN', 'ಕ', 'ಕನ್ನಡ — Kannada'],
        ['pa-IN', 'ਪੰ', 'ਪੰਜਾਬੀ — Punjabi'], ['ml-IN', 'മ', 'മലയാളം — Malayalam'], ['or-IN', 'ଓ', 'ଓଡ଼ିଆ — Odia'],
        ['ur-IN', 'ار', 'اردو — Urdu'], ['en-US', 'US', 'English (US)'],
    ];

    // ── Build UI ───────────────────────────────────────────────────────────────
    function buildUI() {
        const el = document.createElement('div');
        el.id = 'vasy-root';
        el.innerHTML = `
            <div id="vasy-panel" class="vasy-hidden">
                <div id="vasy-header">
                    <div id="vasy-header-left">
                        <span id="vasy-logo"><svg viewBox="0 0 100 100" width="22" height="22" aria-hidden="true"><path d="M24 30 L50 76" stroke="#fff" stroke-width="15" stroke-linecap="round" fill="none"/><path d="M50 76 L74 26" stroke="#fff" stroke-width="15" stroke-linecap="round" fill="none"/><circle cx="79" cy="15" r="8" fill="#FFAE33"/></svg></span>
                        <div>
                            <div id="vasy-title">Vasy AI Agent</div>
                            <div id="vasy-subtitle">v17 · drag me anywhere</div>
                        </div>
                    </div>
                    <div id="vasy-header-btns">
                        <button id="vasy-history-btn" title="Past chats — view & continue (Alt+H)">${svg('history')}</button>
                        <button id="vasy-new-btn" title="New chat — saves this one (Alt+N)">${svg('plus')}</button>
                        <button id="vasy-ghost-btn" title="See-through — read the ERP page behind the chat (Alt+G)">${svg('eye')}</button>
                        <button id="vasy-mini-btn" title="Compact — shrink to the input and last reply (Alt+K)">${svg('shrink')}</button>
                        <button id="vasy-more-btn" title="More">${svg('more')}</button>
                        <button id="vasy-close-btn" title="Close (Alt+V / Esc)">${svg('close')}</button>
                    </div>
                    <div id="vasy-more-menu" class="vasy-hidden" role="menu">
                        <button id="vasy-console-btn" role="menuitem">${svg('console')}<span>Open chat console (new window)</span></button>
                        <button id="vasy-theme-btn" role="menuitem" title="Toggle light / dark (Alt+T)">${svg('moon')}<span>Dark mode</span></button>
                        <button id="vasy-tts-btn" role="menuitem" title="Voice responses OFF — click to enable">${svg('spkOff')}<span>Read replies aloud</span></button>
                        <button id="vasy-settings-btn" role="menuitem" title="Settings">${svg('gear')}<span>Settings &amp; language</span></button>
                        <button id="vasy-pos-reset" role="menuitem">${svg('grip')}<span>Reset position &amp; size</span></button>
                    </div>
                </div>

                <div id="vasy-context-bar">
                    <span id="vasy-context-icon">📄</span>
                    <span id="vasy-context-module">Dashboard</span>
                    <span id="vasy-context-hint">Alt+V · Alt+M mic · Alt+N new · Alt+H past chats</span>
                </div>

                <div id="vasy-settings" class="vasy-hidden">
                    <label id="vasy-lang-label" style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;margin-top:4px">🎤 Voice language</label>
                    <select id="vasy-lang" style="width:100%;padding:8px 10px;border-radius:10px;font-size:12px">
                        <option value="auto">🌐 Auto-detect (speak any language)</option>
                        <option value="en-IN">English (India)</option>
                        <option value="hi-IN">हिन्दी — Hindi</option>
                        <option value="gu-IN">ગુજરાતી — Gujarati</option>
                        <option value="mr-IN">मराठी — Marathi</option>
                        <option value="ta-IN">தமிழ் — Tamil</option>
                        <option value="te-IN">తెలుగు — Telugu</option>
                        <option value="bn-IN">বাংলা — Bengali</option>
                        <option value="kn-IN">ಕನ್ನಡ — Kannada</option>
                        <option value="pa-IN">ਪੰਜਾਬੀ — Punjabi</option>
                        <option value="ml-IN">മലയാളം — Malayalam</option>
                        <option value="or-IN">ଓଡ଼ିଆ — Odia</option>
                        <option value="ur-IN">اردو — Urdu</option>
                        <option value="en-US">English (US)</option>
                    </select>
                    <p id="vasy-lang-note" style="font-size:10.5px;line-height:1.45;margin:6px 0 0;opacity:.75">
                        Speak or type in your language — Vasy understands the command in English and answers back in yours, on your device.
                    </p>
                    <div id="vasy-ai-box">
                        <div class="vasy-ai-head">🧠 On-device AI &amp; learning</div>
                        <label id="vasy-ai-row"><input type="checkbox" id="vasy-ai-on"> <span id="vasy-ai-status">Checking Chrome's built-in model…</span></label>
                        <div id="vasy-learn-row"><span id="vasy-learn-count">Learning from what works…</span><button type="button" id="vasy-learn-forget">Forget</button></div>
                        <p class="vasy-ai-note">Runs inside Chrome — no key, nothing leaves this computer. When a wording is new, Vasy asks before acting on its reading, and remembers the wordings that worked.</p>
                    </div>
                    <a id="vasy-about-link" href="#" style="display:block;margin-top:10px;padding:9px 12px;border-radius:10px;border:1.5px solid rgba(107,76,246,.4);color:#6B4CF6;font-size:12.5px;font-weight:700;text-decoration:none;text-align:center">📖 About Vasy AI Agent — guide, commands &amp; FAQ</a>
                    <a id="vasy-credit" href="https://www.linkedin.com/in/moksheet-shah-14a30a21a/" target="_blank" rel="noopener"
                       style="display:flex;align-items:center;gap:8px;margin-top:10px;padding:9px 12px;border-radius:10px;background:linear-gradient(135deg,#171226,#241E3C);text-decoration:none">
                        <svg viewBox="0 0 100 100" width="18" height="18" aria-hidden="true"><defs><linearGradient id="vasyEvoCredit" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#E23B4E"/><stop offset="100%" stop-color="#6B4CF6"/></linearGradient></defs><path d="M24 30 L50 76" stroke="url(#vasyEvoCredit)" stroke-width="15" stroke-linecap="round" fill="none"/><path d="M50 76 L74 26" stroke="url(#vasyEvoCredit)" stroke-width="15" stroke-linecap="round" fill="none"/><circle cx="79" cy="15" r="8" fill="#FFAE33"/></svg>
                        <span style="font-size:11px;color:#B9B1D4;line-height:1.4">Developed by <b style="color:#fff">Moksheet Shah</b><br><span style="color:#8B9DFF;font-weight:600">in · Connect on LinkedIn ↗</span></span>
                    </a>
                </div>

                <div id="vasy-history" class="vasy-hidden">
                    <div id="vasy-history-head">🕘 Past chats <span style="font-weight:400;text-transform:none;letter-spacing:0">— tap one to continue where you left off</span></div>
                    <div id="vasy-history-list"></div>
                </div>

                <div id="vasy-chips"></div>

                <div id="vasy-log">
                    <div class="vm vm-bot">👋 Hey! I'm <b>Vasy</b> — your business copilot. Tell me what you need in plain words and I'll do the clicking. No API key needed.<br><small style="color:#999">Try <i>"create customer Raj Sharma"</i>, <i>"total sales today"</i> or <i>"create product v1300 with variants size m,l,xl"</i> · tap a chip · 🎤 to speak.</small></div>
                </div>

                <div id="vasy-voice-bar" class="vasy-hidden">
                    <div id="vasy-voice-waves">
                        <span></span><span></span><span></span><span></span><span></span>
                    </div>
                    <span id="vasy-voice-text">Listening… speak your command</span>
                </div>

                <div id="vasy-suggest" class="vasy-hidden"></div>

                <div id="vasy-lang-menu" class="vasy-hidden" role="menu">
                    <div id="vasy-lang-menu-head">Speak in</div>
                    <div id="vasy-lang-menu-list"></div>
                    <label id="vasy-handsfree-row"><input type="checkbox" id="vasy-handsfree"> <span>Hands-free — listen again after each reply</span></label>
                    <div id="vasy-voice-engine"></div>
                </div>

                <div id="vasy-input-row">
                    <button id="vasy-mic" title="Voice input — click to speak (Alt+M)">${svg('mic', 18)}</button>
                    <button id="vasy-lang-pill" title="Voice language">EN</button>
                    <div id="vasy-input-wrap">
                        <input type="text" id="vasy-input" placeholder="Type a command — Tab completes" autocomplete="off" spellcheck="false" disabled>
                        <div id="vasy-ghost" aria-hidden="true" hidden></div>
                    </div>
                    <button id="vasy-stop" class="vasy-hidden" title="Cancel current task">Stop</button>
                    <button id="vasy-send" disabled title="Send">${svg('send', 18)}</button>
                </div>
                <div id="vasy-resize" title="Drag to resize">${svg('grip', 14)}</div>
            </div>

            <button id="vasy-fab" title="Vasy AI Agent (Alt+V)">
                <span id="vasy-fab-icon"><svg viewBox="0 0 100 100" width="30" height="30" aria-hidden="true"><path d="M24 30 L50 76" stroke="#fff" stroke-width="15" stroke-linecap="round" fill="none"/><path d="M50 76 L74 26" stroke="#fff" stroke-width="15" stroke-linecap="round" fill="none"/><circle cx="79" cy="15" r="8" fill="#FFAE33"/></svg></span>
                <span id="vasy-fab-dot"></span>
            </button>
        `;
        document.body.appendChild(el);
    }

    // ── Init ───────────────────────────────────────────────────────────────────
    function initBubble() {
        const panel       = document.getElementById('vasy-panel');
        const fab         = document.getElementById('vasy-fab');
        const dot         = document.getElementById('vasy-fab-dot');
        const closeBtn    = document.getElementById('vasy-close-btn');
        const settingsBtn = document.getElementById('vasy-settings-btn');
        const ttsBtn      = document.getElementById('vasy-tts-btn');
        const settings    = document.getElementById('vasy-settings');
        const log         = document.getElementById('vasy-log');
        const input       = document.getElementById('vasy-input');
        const sendBtn     = document.getElementById('vasy-send');
        const stopBtn     = document.getElementById('vasy-stop');
        const micBtn      = document.getElementById('vasy-mic');
        const voiceBar    = document.getElementById('vasy-voice-bar');
        const voiceText   = document.getElementById('vasy-voice-text');
        const chipsEl     = document.getElementById('vasy-chips');
        const ctxModule   = document.getElementById('vasy-context-module');

        // ── helpers ───────────────────────────────────────────────────────────
        const enable  = () => { input.disabled = false; sendBtn.disabled = false; stopBtn.classList.add('vasy-hidden'); };
        const disable = () => { input.disabled = true;  sendBtn.disabled = true;  stopBtn.classList.remove('vasy-hidden'); };

        // Rotating placeholder tips — discoverable, engaging
        const TIPS = [
            'Try: total sales yesterday',
            'Try: how did customers pay this month?',
            'Try: who owes me money?',
            'Try: who are my champion customers?',
            'Try: least selling products last month',
            'Try: top expenses this month',
            'Try: switch FY to 2025-26',
            'Try: create customer Raj Sharma',
            'Try: sell 2 notebook1s cash',
            'Try: purchase order for OSWAL SHINDE item mousepad qty 5',
            'Try: pay Mehta Traders ₹5000 cash',
            'Type a command or use the 🎤 mic…',
        ];
        let tipIdx = 0;
        setInterval(() => {
            if (document.activeElement !== input && !input.value) {
                tipIdx = (tipIdx + 1) % TIPS.length;
                input.placeholder = TIPS[tipIdx];
            }
        }, 4000);

        // ── Extension context guard ───────────────────────────────────────────
        let _ctxErrShown = false;
        function showContextError() {
            if (_ctxErrShown) return;
            _ctxErrShown = true;
            removeTyping();
            setBusy(false);
            enable();
            addMsg('⚠️ VasyERP extension was reloaded — please <b>refresh this page</b> to reconnect.', 'vm-bot vm-error');
        }
        function safeSet(data, cb) {
            try {
                if (cb) chrome.storage.local.set(data, cb);
                else     chrome.storage.local.set(data);
            } catch (e) { showContextError(); }
        }

        function ts() {
            const d = new Date();
            return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        }

        function addMsg(html, cls, speakText = '') {
            removeTyping();
            const d = document.createElement('div');
            d.className = `vm ${cls} vm-copyable`;
            d.innerHTML = html + `<span class="vm-ts">${ts()}</span>`;
            // Copy button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'vm-copy-btn';
            copyBtn.title = 'Copy';
            copyBtn.textContent = '⎘';
            copyBtn.addEventListener('click', e => {
                e.stopPropagation();
                navigator.clipboard?.writeText(cleanMsgText(d)).catch(() => {});
                copyBtn.textContent = '✓';
                setTimeout(() => { copyBtn.textContent = '⎘'; }, 1200);
            });
            d.appendChild(copyBtn);
            log.appendChild(d);
            log.scrollTop = log.scrollHeight;
            consoleEcho('msg', html, cls);
            if (cls.includes('vm-bot')) { try { onBotReply(); } catch (e) {} }
            chatLog.push({ html, cls });
            if (chatLog.length > 30) chatLog.shift();
            safeSet({ chatLog });
            if (speakText) speak(speakText);
            // Bot questions get tappable quick-reply buttons (Cash/UPI/Card etc.)
            // Errors get them too when they offer "(a/b/c)" choices — e.g. the
            // "Multiple close matches — which one?" disambiguation ask.
            if (cls.includes('vm-bot') && !cls.includes('vm-success')) {
                try { attachQuickReplies(d, d.innerText || ''); } catch (e) {}
            }
            return d;
        }

        function addSys(text, quiet) {
            const d = document.createElement('div');
            d.className = 'vm vm-sys';
            d.textContent = text;
            log.appendChild(d);
            log.scrollTop = log.scrollHeight;
            if (!quiet) consoleEcho('sys', text, 'vm-sys');   // page-load housekeeping stays local
        }
        // The chat console page (console.html) mirrors this conversation. Content
        // script → runtime message reaches every extension page; the background
        // simply ignores it.
        function consoleEcho(kind, html, cls) {
            try { chrome.runtime.sendMessage({ action: 'bubble_echo', kind, html, cls, page: location.pathname,
                                               module: getModuleName(), busy: awaitingResult }).catch(() => {}); } catch (e) {}
        }

        // Copy the message TEXT only — timestamps, source badges and the ⎘ glyph
        // must never ride along (re-sending a copied command otherwise breaks parsing).
        function cleanMsgText(d) {
            const clone = d.cloneNode(true);
            clone.querySelectorAll('.vm-ts,.vm-copy-btn,.vm-src').forEach(x => x.remove());
            return (clone.innerText || '').trim();
        }

        // Render one persisted {html, cls} entry into the log (used when restoring
        // the live chat after navigation AND when reopening an archived chat).
        function renderStoredMsg(m) {
            const d = document.createElement('div');
            d.className = `vm ${m.cls} vm-copyable`;
            d.innerHTML = m.html + `<span class="vm-ts"></span>`;
            const copyBtn = document.createElement('button');
            copyBtn.className = 'vm-copy-btn';
            copyBtn.title = 'Copy';
            copyBtn.textContent = '⎘';
            copyBtn.addEventListener('click', ev => {
                ev.stopPropagation();
                navigator.clipboard?.writeText(cleanMsgText(d)).catch(() => {});
                copyBtn.textContent = '✓';
                setTimeout(() => { copyBtn.textContent = '⎘'; }, 1200);
            });
            d.appendChild(copyBtn);
            log.appendChild(d);
        }

        // Every reply is worked out inside the browser. The one badge worth showing:
        // a wording Vasy remembered from an earlier success (the on-device model's
        // replies say "I read that as …" in their own words).
        function srcBadge(source) {
            if (source === 'learned') return `<span class="vm-src vm-src-local" title="You said it this way before and it worked — answered from Vasy's memory">📚 Remembered</span>`;
            return '';
        }
        function srcIcon() { return '⚡'; }
        // Shown when Chrome's on-device Translator handled a non-English command.
        const LANG_NAME = { hi:'हिन्दी', gu:'ગુજરાતી', mr:'मराठी', ta:'தமிழ்', te:'తెలుగు',
                            bn:'বাংলা', kn:'ಕನ್ನಡ', pa:'ਪੰਜਾਬੀ', ml:'മലയാളം', or:'ଓଡ଼ିଆ', as:'অসমীয়া', ur:'اردو' };
        function langBadge(lang) {
            if (!lang || lang === 'en') return '';
            const name = LANG_NAME[lang] || lang.toUpperCase();
            return `<span class="vm-src vm-src-local" title="Understood and answered in your language using Chrome's built-in translator — on-device, no credits">🌐 ${name}</span>`;
        }

        let typingTimer = null;
        function addTyping() {
            const d = document.createElement('div');
            d.id = 'vasy-typing';
            d.className = 'vm vm-bot vm-typing';
            d.innerHTML = '<span></span><span></span><span></span>';
            log.appendChild(d);
            log.scrollTop = log.scrollHeight;
            // The rules answer near-instantly. The background says when it hands a new
            // wording to Chrome's on-device model (parse_note); any other long wait is a
            // busy computer, and saying "thinking it over" then would not be true.
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                const t = document.getElementById('vasy-typing');
                if (t) {
                    t.classList.add('vm-typing-ai');
                    t.textContent = '⏳ Working on it…';
                    log.scrollTop = log.scrollHeight;
                    typingTimer = setTimeout(() => {
                        const t2 = document.getElementById('vasy-typing');
                        if (t2 && !t2.dataset.ai) t2.textContent = '⏳ Still working — this computer seems busy…';
                    }, 6000);
                }
            }, 550);
        }

        function removeTyping() { clearTimeout(typingTimer); document.getElementById('vasy-typing')?.remove(); }

        // ── Personality: friendly, varied, professional ──────────────────────
        const CHEERS = ['Done! 🎉', 'All set ✅', 'Boom — saved! 🚀', 'Sorted! ✨', 'That went through 👌', 'Nailed it ✅'];
        const OOPS   = ['Hmm, hit a snag 😅', 'Small bump 🙈', 'That didn\'t go through 😕', 'Oops —'];
        const cheer  = () => CHEERS[Math.floor(Math.random() * CHEERS.length)];
        const oops   = () => OOPS[Math.floor(Math.random() * OOPS.length)];

        // Mini celebration — floating emojis over the log on success
        function celebrate() {
            const emojis = ['🎉', '✨', '✅', '🎊'];
            for (let i = 0; i < 5; i++) {
                const s = document.createElement('span');
                s.textContent = emojis[i % emojis.length];
                s.style.cssText = `position:absolute;bottom:70px;left:${18 + Math.random() * 64}%;font-size:${13 + Math.random() * 9}px;pointer-events:none;z-index:99;opacity:1;transition:transform 1.15s cubic-bezier(.2,.6,.4,1),opacity 1.15s ease;transform:translateY(0) rotate(0deg)`;
                panel.appendChild(s);
                requestAnimationFrame(() => {
                    s.style.transform = `translateY(-${130 + Math.random() * 110}px) rotate(${Math.random() * 60 - 30}deg)`;
                    s.style.opacity = '0';
                });
                setTimeout(() => s.remove(), 1300);
            }
        }

        // ── Quick-reply buttons — tap instead of type ─────────────────────────
        function quickRepliesFor(text) {
            const t = (text || '').toLowerCase();
            if (/payment mode|cash\s*\/\s*upi/.test(t))     return ['💵 Cash', '📱 UPI', '💳 Card'];
            if (/increase or decrease/.test(t))             return ['📈 Increase', '📉 Decrease'];
            if (/quantity\??\s*$|qty\??\s*$/.test(t))       return ['1', '2', '5', '10'];
            if (/customer|supplier|transport\b.*\?/.test(t) && /type/.test(t)) return ['👤 Customer', '🏭 Supplier'];
            if (/type of coupon|coupon type/.test(t))       return ['💰 Amount', '％ Percentage', '🧾 Entire Bill'];
            // GENERIC: any question offering "(optionA/optionB/optionC)" → tappable buttons
            const par = (text || '').match(/\(([^()]{3,90})\)/);
            if (par && par[1].includes('/')) {
                const opts = par[1].split('/').map(s => s.trim()).filter(s => s && s.length <= 24 && !/https?:/i.test(s)).slice(0, 4);
                if (opts.length >= 2) return opts.map(o => o.charAt(0).toUpperCase() + o.slice(1));
            }
            return null;
        }

        // Explicit answers sent with the reply (label shown, value sent).
        function attachChoices(msgEl, choices) {
            if (!msgEl) return;
            msgEl.querySelectorAll('.vm-quick').forEach(q => q.remove());   // no guessed buttons on top
            const wrap = document.createElement('div');
            wrap.className = 'vm-quick vm-choices';
            choices.slice(0, 6).forEach(c => {
                const b = document.createElement('button');
                b.className = 'vm-quick-btn';
                b.textContent = c.label || c.value;
                b.title = c.value;
                b.addEventListener('click', () => {
                    wrap.remove();
                    input.value = c.value;
                    document.getElementById('vasy-send')?.click();
                });
                wrap.appendChild(b);
            });
            msgEl.appendChild(wrap);
            log.scrollTop = log.scrollHeight;
            try { chrome.runtime.sendMessage({ action: 'bubble_echo', kind: 'choices', choices: choices.slice(0, 6), page: location.pathname }).catch(() => {}); } catch (e) {}
        }

        function attachQuickReplies(msgEl, text) {
            const opts = quickRepliesFor(text);
            if (!opts) return;
            const wrap = document.createElement('div');
            wrap.className = 'vm-quick';
            opts.forEach(label => {
                const b = document.createElement('button');
                b.className = 'vm-quick-btn';
                b.textContent = label;
                b.addEventListener('click', () => {
                    wrap.remove();
                    const val = label.replace(/^[^\w\d]+\s*/, ''); // strip leading emoji
                    input.value = val;
                    document.getElementById('vasy-send')?.click();
                });
                wrap.appendChild(b);
            });
            msgEl.appendChild(wrap);
            log.scrollTop = log.scrollHeight;
        }

        function setBusy(on) {
            on ? dot.classList.add('vasy-dot-busy') : dot.classList.remove('vasy-dot-busy');
            try { chrome.runtime.sendMessage({ action: 'bubble_echo', kind: 'busy', busy: !!on, page: location.pathname, module: getModuleName() }).catch(() => {}); } catch (e) {}
        }

        let _aiWarmAt = 0, _aiKeepAlive = null;
        function openPanel() {
            panel.classList.remove('vasy-hidden');
            fab.classList.add('vasy-fab-open');
            refreshContext();
            if (!input.disabled) input.focus();
            // the on-device model takes seconds to open a session — start it now, not when a hard
            // sentence arrives, and keep it alive while the chat is open (the service worker
            // otherwise sleeps after 30 s and drops the session)
            const warm = () => { try { chrome.runtime.sendMessage({ action: 'ai_warm' }).catch(() => {}); } catch (e) {} };
            if (Date.now() - _aiWarmAt > 20000) { _aiWarmAt = Date.now(); warm(); }
            if (!_aiKeepAlive) _aiKeepAlive = setInterval(() => {
                if (panel.classList.contains('vasy-hidden') || document.hidden) { clearInterval(_aiKeepAlive); _aiKeepAlive = null; return; }
                warm();
            }, 25000);
        }

        function closePanel() {
            panel.classList.add('vasy-hidden');
            fab.classList.remove('vasy-fab-open');
            stopListening();
        }

        function refreshContext() {
            ctxModule.textContent = getModuleName();
            renderChips(getChips());
            // the redesigned dashboard renders after load — rebuild its chips once it has
            if (/^\/dashboard/.test(location.pathname) && !dashboardChips()) {
                let tries = 0;
                const iv = setInterval(() => {
                    if (++tries > 20) return clearInterval(iv);
                    const dyn = dashboardChips();
                    if (dyn && dyn.length) { clearInterval(iv); learnDashboardSuggestions(); renderChips(dyn); }
                }, 1500);
            }
        }

        function renderChips(chips) {
            chipsEl.innerHTML = '';
            chips.forEach(c => {
                const btn = document.createElement('button');
                btn.className = 'vasy-chip';
                btn.textContent = `${c.e} ${c.l}`;
                btn.addEventListener('click', () => { input.value = c.p; handleSend(); });
                chipsEl.appendChild(btn);
            });
        }

        // ── Live progress line while a task runs ──────────────────────────────
        // The only sign of life used to be one static "⏳ …" line for up to 90 s.
        // Now: elapsed seconds after 6 s, a Stop button after 20 s, "done in Ns" at the end.
        let progressEl = null, progressTimer = null, progressT0 = 0;
        function startProgress(text, since) {
            stopProgress();
            progressT0 = since || Date.now();
            safeSet({ awaitingLabel: text });   // so the line survives the page reloading under it
            const d = document.createElement('div');
            d.className = 'vm vm-sys vm-progress';
            d.innerHTML = '<span class="vp-text"></span><span class="vp-time"></span><button type="button" class="vp-stop" hidden>Stop</button>';
            d.querySelector('.vp-text').textContent = text;
            d.querySelector('.vp-stop').addEventListener('click', forceStop);
            log.appendChild(d); log.scrollTop = log.scrollHeight;
            progressEl = d;
            consoleEcho('sys', text, 'vm-sys');
            progressTimer = setInterval(() => {
                if (!progressEl) return;
                const s = Math.round((Date.now() - progressT0) / 1000);
                const t = progressEl.querySelector('.vp-time');
                if (s >= 6) t.textContent = s >= 20 ? ` · ${s}s — VasyERP is taking its time` : ` · ${s}s`;
                if (s >= 20) progressEl.querySelector('.vp-stop').hidden = false;
            }, 1000);
        }
        function stopProgress(done) {
            if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
            if (progressEl) {
                progressEl.querySelector('.vp-stop')?.remove();
                const t = progressEl.querySelector('.vp-time');
                const s = Math.round((Date.now() - progressT0) / 1000);
                if (t) t.textContent = done ? ` · done in ${s}s` : '';
                progressEl.classList.add('vm-progress-done');
            }
            progressEl = null;
        }

        // ── Failsafe: auto-unlock after 90s ───────────────────────────────────
        function startFailsafe() {
            clearFailsafe(false);
            failsafeTimer = setTimeout(() => {
                if (!awaitingResult) return;
                awaitingResult = false;
                safeSet({ awaitingResult: false });
                stopProgress(false);
                setBusy(false); enable(); removeTyping();
                addMsg('⏱️ <b>No answer from the page in 90 s.</b> VasyERP may still be saving — look at the screen before sending it again, so nothing is entered twice.', 'vm-bot vm-error', 'No answer from the page. Check VasyERP before trying again.');
            }, 90000);
        }

        function clearFailsafe(done = true) {
            if (failsafeTimer) { clearTimeout(failsafeTimer); failsafeTimer = null; }
            stopProgress(done);
        }

        function forceStop() {
            clearFailsafe(false);
            awaitingResult = false;
            conversationState = { entity: null, action: null, fields: {} };
            chatLog = [];
            safeSet({ awaitingResult: false, conversationState, chatLog: [] });
            setBusy(false); enable(); removeTyping(); stopListening();
            addMsg('🛑 Stopped. Task cancelled.', 'vm-bot', 'Stopped.');
            input.focus();
        }

        // ── Voice Input ───────────────────────────────────────────────────────
        recognition = setupRecognition();

        // ── On-device speech (Chrome 139+): measured on Chrome 152 — en-IN, en-US
        // and hi-IN are downloadable for local recognition; gu-IN is not yet, and
        // stays on Chrome's normal (cloud) recognition. Installing needs a user
        // gesture, so it starts from a mic click or a language pick.
        let voiceLocal = false, voiceInstalling = false;
        const SRClass = window.SpeechRecognition || window.webkitSpeechRecognition;
        const voiceLangTag = () => (vasyLang && vasyLang !== 'auto') ? vasyLang : (navigator.language || 'en-IN');
        async function prepareVoiceEngine(fromGesture) {
            voiceLocal = false;
            const eng = document.getElementById('vasy-voice-engine');
            if (!SRClass || typeof SRClass.available !== 'function') { if (eng) eng.textContent = 'Recognition: Chrome speech service'; return; }
            const opts = { langs: [voiceLangTag()], processLocally: true };
            try {
                const a = await SRClass.available(opts);
                if (a === 'available') voiceLocal = true;
                else if ((a === 'downloadable' || a === 'downloading') && fromGesture && !voiceInstalling) {
                    voiceInstalling = true;
                    if (eng) eng.textContent = 'Downloading on-device speech for this language — once only. Using Chrome speech meanwhile.';
                    SRClass.install(opts).then(ok => { voiceInstalling = false; if (ok) { voiceLocal = true; if (eng) eng.textContent = 'Recognition: on your device ✓ (private, works offline)'; } })
                                         .catch(() => { voiceInstalling = false; });
                }
                if (eng && !voiceInstalling) eng.textContent = voiceLocal ? 'Recognition: on your device ✓ (private, works offline)'
                    : a === 'unavailable' ? 'Recognition: Chrome speech service (no on-device model for this language yet)'
                    : 'Recognition: Chrome speech service — tap the mic once to download the on-device model';
            } catch (e) { if (eng) eng.textContent = 'Recognition: Chrome speech service'; }
        }
        // Bias recognition toward ERP words — "GRN" and "challan" are not words a
        // general model expects. Only where the browser supports phrase biasing.
        function voicePhrases() {
            try {
                if (typeof SpeechRecognitionPhrase === 'undefined') return null;
                const words = ['purchase order', 'sales order', 'sales invoice', 'GRN', 'material inward', 'supplier bill',
                    'delivery challan', 'estimate', 'credit note', 'debit note', 'receipt', 'payment', 'expense', 'stock transfer',
                    'stock adjustment', 'opening stock', 'material consumption', 'material creation', 'journal voucher',
                    'trial balance', 'profit and loss', 'general ledger', 'GST', 'MRP', 'purchase price', 'customer', 'supplier'];
                return words.map(w => new SpeechRecognitionPhrase(w, 3.0));
            } catch (e) { return null; }
        }
        // Hands-free: after each reply (and after it has been read aloud), listen again.
        let handsFree = false;
        function onBotReply() {
            if (!handsFree || awaitingResult || isListening || panel.classList.contains('vasy-hidden')) return;
            const go = () => { if (!awaitingResult && !isListening) startListening(); };
            if (ttsEnabled && window.speechSynthesis && window.speechSynthesis.speaking) {
                const iv = setInterval(() => { if (!window.speechSynthesis.speaking) { clearInterval(iv); setTimeout(go, 350); } }, 250);
            } else setTimeout(go, 700);
        }

        function startListening() {
            if (!recognition) {
                addMsg('❌ Voice input not supported in this browser. Use Chrome.', 'vm-bot vm-error');
                return;
            }
            // "auto" lets Chrome pick from the browser/system locale instead of
            // forcing one language — the background tier detects and translates
            // whatever actually comes back, so a wrong guess here is recoverable.
            recognition.lang = voiceLangTag();
            try { recognition.processLocally = !!voiceLocal; } catch (e) {}
            try { const ph = voicePhrases(); if (ph && voiceLocal) recognition.phrases = ph; } catch (e) {}
            if (!voiceLocal && !voiceInstalling) prepareVoiceEngine(true);
            if (isListening) { stopListening(); return; }
            isListening = true;
            micBtn.classList.add('vasy-mic-on');
            voiceBar.classList.remove('vasy-hidden');
            voiceText.textContent = (voiceLocal ? 'Listening on your device… ' : 'Listening… ') + 'speak your command' + (handsFree ? ' (say "stop listening" to end hands-free)' : '');

            recognition.onresult = e => {
                let interim = '';
                let final_ = '';
                for (const r of e.results) {
                    if (r.isFinal) final_ += r[0].transcript;
                    else interim += r[0].transcript;
                }
                input.value = final_ || interim;
                if (final_) voiceText.textContent = `"${final_}"`;
                else voiceText.textContent = `Hearing: "${interim}"`;
            };

            recognition.onend = () => {
                isListening = false;
                micBtn.classList.remove('vasy-mic-on');
                voiceBar.classList.add('vasy-hidden');
                const t = input.value.trim();
                if (/^(stop listening|stop|band karo|बंद करो|bas)$/i.test(t)) {
                    input.value = '';
                    if (handsFree) { handsFree = false; const hf = document.getElementById('vasy-handsfree'); if (hf) hf.checked = false; safeSet({ vasyHandsFree: false }); addSys('🎤 Hands-free off.'); }
                    return;
                }
                if (t) { setTimeout(handleSend, 200); }
            };

            recognition.onerror = e => {
                isListening = false;
                micBtn.classList.remove('vasy-mic-on');
                voiceBar.classList.add('vasy-hidden');
                if (e.error !== 'no-speech' && e.error !== 'aborted') {
                    addMsg(`🎤 Voice error: ${e.error}. Try typing instead.`, 'vm-bot vm-error');
                }
            };

            try { recognition.start(); } catch(e) {
                isListening = false;
                micBtn.classList.remove('vasy-mic-on');
            }
        }

        function stopListening() {
            if (!isListening || !recognition) return;
            try { recognition.stop(); } catch(e) {}
            isListening = false;
            micBtn.classList.remove('vasy-mic-on');
            voiceBar.classList.add('vasy-hidden');
        }

        // ── Load persisted state ──────────────────────────────────────────────
        try { chrome.storage.local.get(['conversationState','awaitingResult','awaitingSince','awaitingLabel','cmdHistory','ttsEnabled','chatLog'], r => {
            enable();
            if (r.conversationState) conversationState = r.conversationState;
            if (r.cmdHistory)  { cmdHistory = r.cmdHistory; }
            if (r.chatLog && r.chatLog.length) {
                chatLog = r.chatLog;
                addSys('📝 Conversation history', true);
                r.chatLog.forEach(renderStoredMsg);
                log.scrollTop = log.scrollHeight;
            }
            if (r.ttsEnabled)  { ttsEnabled = true; ttsBtn.innerHTML = svg('spkOn') + '<span>Read replies aloud: on</span>'; ttsBtn.classList.add('vasy-tts-on'); }
            // A task that died (tab closed, page crashed) left "busy" saved, and every
            // later command was refused until a fresh 90s failsafe ran out. A task
            // older than the failsafe window cannot still be coming back.
            if (r.awaitingResult && (!r.awaitingSince || Date.now() - r.awaitingSince > 95000)) {
                r.awaitingResult = false;
                safeSet({ awaitingResult: false });
            }
            if (r.awaitingResult) {
                awaitingResult = true;
                disable(); setBusy(true);
                openPanel();
                startFailsafe();
                startProgress(r.awaitingLabel || '⏳ Still working on your last command…', r.awaitingSince);
            }
        }); } catch (e) { showContextError(); }

        // ── Events ────────────────────────────────────────────────────────────
        fab.addEventListener('click', () => panel.classList.contains('vasy-hidden') ? openPanel() : closePanel());
        closeBtn.addEventListener('click', closePanel);
        stopBtn.addEventListener('click', forceStop);
        micBtn.addEventListener('click', () => { if (!awaitingResult) startListening(); });

        settingsBtn.addEventListener('click', () => { settings.classList.toggle('vasy-hidden'); if (!settings.classList.contains('vasy-hidden')) refreshAIStatus(); });

        // ── On-device AI & learning (Settings) ────────────────────────────────
        const aiOn = document.getElementById('vasy-ai-on'), aiStatus = document.getElementById('vasy-ai-status');
        const learnCount = document.getElementById('vasy-learn-count'), learnForget = document.getElementById('vasy-learn-forget');
        const AI_WORDS = {
            available:    'Chrome’s on-device model is ready.',
            downloadable: 'Chrome can download its on-device model — use “Turn on on-device AI” in the Vasy toolbar menu.',
            downloading:  'Chrome is downloading its on-device model…',
            unavailable:  'This computer can’t run Chrome’s on-device model — Vasy keeps working without it.',
        };
        function refreshAIStatus() {
            try { chrome.runtime.sendMessage({ action: 'ai_status' }).then(s => {
                if (!s) return;
                aiOn.checked = !s.off;
                aiOn.disabled = s.ai !== 'available';
                aiStatus.textContent = s.off && s.ai === 'available' ? 'Off — Vasy uses its own rules only.' : (AI_WORDS[s.ai] || AI_WORDS.unavailable);
                if (!s.off && s.ai === 'available' && s.keepsWarm === false && s.mem)
                    aiStatus.textContent += ` With ${Math.round(s.mem.totalGB)} GB of memory here, it's opened only when needed and freed soon after.`;
                const n = (s.learned && s.learned.examples) || 0;
                learnCount.textContent = n ? `Learned ${n} wording${n === 1 ? '' : 's'} from tasks that worked.` : 'Nothing learned yet — it learns from tasks that work.';
                learnForget.disabled = !n;
            }).catch(() => {}); } catch (e) {}
        }
        aiOn.addEventListener('change', () => {
            try { chrome.runtime.sendMessage({ action: 'ai_set', off: !aiOn.checked }).then(refreshAIStatus).catch(() => {}); } catch (e) {}
        });
        learnForget.addEventListener('click', () => {
            if (learnForget.dataset.armed !== '1') {   // confirm in place — no browser dialog
                learnForget.dataset.armed = '1'; learnForget.textContent = 'Sure?';
                setTimeout(() => { learnForget.dataset.armed = ''; learnForget.textContent = 'Forget'; }, 3000);
                return;
            }
            learnForget.dataset.armed = ''; learnForget.textContent = 'Forget';
            try { chrome.runtime.sendMessage({ action: 'learn_forget' }).then(() => { refreshAIStatus(); addSys('🧹 Forgot the wordings Vasy had learned.'); }).catch(() => {}); } catch (e) {}
        });

        // ── Theme: light / dark (persisted; defaults to OS preference) ────────
        const rootEl   = document.getElementById('vasy-root');
        const themeBtn = document.getElementById('vasy-theme-btn');
        const applyTheme = (dark) => {
            rootEl.classList.toggle('vasy-dark', dark);
            themeBtn.innerHTML = svg(dark ? 'sun' : 'moon') + `<span>${dark ? 'Light mode' : 'Dark mode'}</span>`;
            themeBtn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
        };
        try { chrome.storage.local.get(['vasyTheme'], r => {
            const dark = r.vasyTheme ? r.vasyTheme === 'dark'
                       : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            applyTheme(dark);
        }); } catch (e) {}
        themeBtn.addEventListener('click', () => {
            const dark = !rootEl.classList.contains('vasy-dark');
            applyTheme(dark);
            safeSet({ vasyTheme: dark ? 'dark' : 'light' });
        });

        // ── Drag & place ──────────────────────────────────────────────────────
        // The panel and the launcher each go wherever the user puts them, so the
        // chat never sits on the figures they need to read. Positions are kept
        // per browser (chrome.storage) and clamped back on-screen on resize.
        const GAP = 8, FAB = 58;
        let place = { panel: null, fab: null, size: null };   // {x,y} {x,y} {w,h}
        const vw = () => window.innerWidth, vh = () => window.innerHeight;
        const panelSize = () => {
            const w = Math.min(Math.max((place.size && place.size.w) || 400, 320), vw() - 2 * GAP);
            const h = Math.min(Math.max((place.size && place.size.h) || 600, 300), vh() - 2 * GAP);
            return { w, h };
        };
        const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
        function defaultFab() { return { x: vw() - FAB - 24, y: vh() - FAB - 24 }; }
        function defaultPanel() {
            const f = place.fab || defaultFab(), { w, h } = panelSize();
            let x = f.x + FAB - w, y = f.y - h - 12;
            if (y < GAP) y = f.y + FAB + 12 > vh() - h ? GAP : f.y + FAB + 12;
            return { x: clamp(x, GAP, vw() - w - GAP), y: clamp(y, GAP, vh() - h - GAP) };
        }
        function applyPlace() {
            const f = place.fab || defaultFab();
            const fx = clamp(f.x, GAP, vw() - FAB - GAP), fy = clamp(f.y, GAP, vh() - FAB - GAP);
            const { w, h } = panelSize();
            const p = place.panel || defaultPanel();
            const px = clamp(p.x, GAP, vw() - Math.min(w, vw()) - GAP), py = clamp(p.y, GAP, vh() - 48 - GAP);
            rootEl.classList.add('vasy-free');
            rootEl.style.setProperty('--vf-x', fx + 'px'); rootEl.style.setProperty('--vf-y', fy + 'px');
            rootEl.style.setProperty('--vp-x', px + 'px'); rootEl.style.setProperty('--vp-y', py + 'px');
            rootEl.style.setProperty('--vp-w', w + 'px');
            rootEl.style.setProperty('--vp-h', Math.min(h, vh() - py - GAP) + 'px');
        }
        function savePlace() { safeSet({ vasyPlace: place }); }
        function dragify(handle, onMove, onEnd, opts = {}) {
            handle.addEventListener('pointerdown', ev => {
                if (ev.button !== 0) return;
                if (!opts.anywhere && ev.target.closest('button,input,select,a,textarea,label,#vasy-more-menu')) return;
                const sx = ev.clientX, sy = ev.clientY;
                let moved = false;
                // Without this the browser starts a text selection and the drag
                // highlights half the ERP page (measured on the dashboard).
                ev.preventDefault();
                const prevSel = document.documentElement.style.userSelect;
                document.documentElement.style.userSelect = 'none';
                const mv = e => {
                    const dx = e.clientX - sx, dy = e.clientY - sy;
                    if (!moved && Math.hypot(dx, dy) < 5) return;
                    if (!moved) { moved = true; rootEl.classList.add('vasy-dragging'); }
                    onMove(dx, dy);
                };
                const up = () => {
                    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
                    rootEl.classList.remove('vasy-dragging');
                    document.documentElement.style.userSelect = prevSel;
                    try { if (moved) window.getSelection().removeAllRanges(); } catch (e) {}
                    if (moved) { onEnd(); handle.__vasyDragged = Date.now(); }
                };
                window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
                if (opts.start) opts.start();
            });
        }
        // snap to an edge when dropped within 16px of it
        const snap = (v, max) => v < 16 + GAP ? GAP : (max - v < 16 + GAP ? max : v);
        let base = null;
        dragify(document.getElementById('vasy-header'), (dx, dy) => {
            const { w } = panelSize();
            const x = clamp(base.x + dx, GAP, vw() - w - GAP), y = clamp(base.y + dy, GAP, vh() - 48 - GAP);
            place.panel = { x, y }; applyPlace();
        }, () => {
            const { w } = panelSize();
            place.panel = { x: snap(place.panel.x, vw() - w - GAP), y: snap(place.panel.y, vh() - 48 - GAP) };
            applyPlace(); savePlace();
        }, { start: () => { const p = place.panel || defaultPanel(); base = { ...p }; } });
        let fbase = null;
        dragify(fab, (dx, dy) => {
            place.fab = { x: clamp(fbase.x + dx, GAP, vw() - FAB - GAP), y: clamp(fbase.y + dy, GAP, vh() - FAB - GAP) };
            applyPlace();
        }, () => { place.fab = { x: snap(place.fab.x, vw() - FAB - GAP), y: snap(place.fab.y, vh() - FAB - GAP) }; applyPlace(); savePlace(); },
        { anywhere: true, start: () => { fbase = { ...(place.fab || defaultFab()) }; } });
        // resize from the bottom-right grip
        let sbase = null;
        dragify(document.getElementById('vasy-resize'), (dx, dy) => {
            place.size = { w: clamp(sbase.w + dx, 320, vw() - 2 * GAP), h: clamp(sbase.h + dy, 300, vh() - 2 * GAP) };
            applyPlace();
        }, () => savePlace(), { anywhere: true, start: () => { sbase = { ...panelSize() }; place.panel = place.panel || defaultPanel(); } });
        document.getElementById('vasy-header').addEventListener('dblclick', e => {
            if (e.target.closest('button')) return;
            place = { panel: null, fab: null, size: null }; applyPlace(); savePlace();
        });
        window.addEventListener('resize', applyPlace);
        try { chrome.storage.local.get(['vasyPlace', 'vasyMini', 'vasyHandsFree'], r => {
            if (r.vasyPlace) place = { panel: null, fab: null, size: null, ...r.vasyPlace };
            applyPlace();
            if (r.vasyMini) panel.classList.add('vasy-mini');
            setIcon(document.getElementById('vasy-mini-btn'), panel.classList.contains('vasy-mini') ? 'expand' : 'shrink');
            handsFree = !!r.vasyHandsFree;
            const hf = document.getElementById('vasy-handsfree'); if (hf) hf.checked = handsFree;
        }); } catch (e) { applyPlace(); }
        // a drag must not also count as a click on the launcher
        fab.addEventListener('click', e => { if (fab.__vasyDragged && Date.now() - fab.__vasyDragged < 300) { e.stopImmediatePropagation(); } }, true);

        // ── Compact and see-through ───────────────────────────────────────────
        const miniBtn = document.getElementById('vasy-mini-btn');
        const ghostBtn = document.getElementById('vasy-ghost-btn');
        function toggleMini(force) {
            const on = force != null ? force : !panel.classList.contains('vasy-mini');
            panel.classList.toggle('vasy-mini', on);
            setIcon(miniBtn, on ? 'expand' : 'shrink');
            miniBtn.title = on ? 'Expand (Alt+K)' : 'Compact — shrink to the input and last reply (Alt+K)';
            safeSet({ vasyMini: on });
            log.scrollTop = log.scrollHeight;
        }
        function toggleGhost(force) {
            const on = force != null ? force : !panel.classList.contains('vasy-ghost');
            panel.classList.toggle('vasy-ghost', on);
            setIcon(ghostBtn, on ? 'eyeOff' : 'eye');
            ghostBtn.title = on ? 'Make the chat solid again (Alt+G)' : 'See-through — read the ERP page behind the chat (Alt+G)';
            const sub = document.getElementById('vasy-subtitle');
            if (sub) sub.textContent = on ? 'See-through · click the eye to bring it back' : 'v17 · drag me anywhere';
        }
        miniBtn.addEventListener('click', () => toggleMini());
        ghostBtn.addEventListener('click', () => toggleGhost());
        document.addEventListener('keydown', e => {
            if (!e.altKey || e.ctrlKey || e.metaKey) return;
            if (e.key === 'g' || e.key === 'G') { e.preventDefault(); toggleGhost(); }
            if (e.key === 'k' || e.key === 'K') { e.preventDefault(); toggleMini(); }
        });

        // ── "More" menu and the language pill ─────────────────────────────────
        const moreMenu = document.getElementById('vasy-more-menu');
        const langMenu = document.getElementById('vasy-lang-menu');
        const langPill = document.getElementById('vasy-lang-pill');
        document.getElementById('vasy-more-btn').addEventListener('click', e => { e.stopPropagation(); langMenu.classList.add('vasy-hidden'); moreMenu.classList.toggle('vasy-hidden'); });
        moreMenu.addEventListener('click', e => { if (e.target.closest('button')) setTimeout(() => moreMenu.classList.add('vasy-hidden'), 0); });
        document.getElementById('vasy-console-btn').addEventListener('click', () => {
            try { chrome.runtime.sendMessage({ action: 'open_console' }).catch(() => {}); } catch (e) { showContextError(); }
        });
        document.getElementById('vasy-pos-reset').addEventListener('click', () => {
            place = { panel: null, fab: null, size: null }; applyPlace(); savePlace();
        });
        function renderLangMenu() {
            const cur = vasyLang || 'auto';
            const list = document.getElementById('vasy-lang-menu-list');
            list.innerHTML = VOICE_LANGS.map(([tag, , name]) =>
                `<button class="vasy-lang-opt${tag === cur ? ' vasy-on' : ''}" data-lang="${tag}" role="menuitemradio" aria-checked="${tag === cur}">${name}</button>`).join('');
            const short = (VOICE_LANGS.find(l => l[0] === cur) || VOICE_LANGS[0])[1];
            langPill.textContent = short;
        }
        langPill.addEventListener('click', e => {
            e.stopPropagation(); moreMenu.classList.add('vasy-hidden');
            renderLangMenu(); langMenu.classList.toggle('vasy-hidden');
            if (!langMenu.classList.contains('vasy-hidden')) prepareVoiceEngine(false);
        });
        document.getElementById('vasy-lang-menu-list').addEventListener('click', e => {
            const b = e.target.closest('.vasy-lang-opt'); if (!b) return;
            const sel = document.getElementById('vasy-lang');
            if (sel) { sel.value = b.dataset.lang; sel.dispatchEvent(new Event('change')); }
            renderLangMenu();
            prepareVoiceEngine(true);           // this click IS the gesture install() needs
        });
        document.getElementById('vasy-handsfree').addEventListener('change', e => {
            handsFree = e.target.checked; safeSet({ vasyHandsFree: handsFree });
            addSys(handsFree ? '🎤 Hands-free on — I\'ll listen again after each reply. Say "stop listening" to end.' : '🎤 Hands-free off.');
        });
        document.addEventListener('pointerdown', e => {
            if (!e.target.closest('#vasy-more-menu,#vasy-more-btn')) moreMenu.classList.add('vasy-hidden');
            if (!e.target.closest('#vasy-lang-menu,#vasy-lang-pill')) langMenu.classList.add('vasy-hidden');
        }, true);

        // ── Voice language selector ───────────────────────────────────────────
        const langSel = document.getElementById('vasy-lang');
        try { chrome.storage.local.get(['vasyLang'], r => {
            if (r.vasyLang) { vasyLang = r.vasyLang; langSel.value = vasyLang; }
            renderLangMenu();
            prepareVoiceEngine(false);
        }); } catch (e) {}
        langSel.addEventListener('change', () => {
            vasyLang = langSel.value;
            safeSet({ vasyLang });
            // Chrome refuses to download its on-device language models unless the
            // call happens inside a USER GESTURE — and the background service
            // worker never has one. Picking a language here IS that gesture, so
            // this is the one place the download can legitimately start.
            warmLanguageModels(vasyLang);
            addSys(`🎤 Voice language: ${langSel.options[langSel.selectedIndex].text}`);
        });

        // ── New chat — archives the current one, starts fresh ─────────────────
        const WELCOME_HTML = `👋 Hey! I'm <b>Vasy</b> — your business copilot. Tell me what you need in plain words and I'll do the clicking. No API key needed.<br><small style="color:#999">Try <i>"create customer Raj Sharma"</i>, <i>"total sales today"</i> or <i>"create coupon Diwali10 amount 100"</i> · tap a chip · 🎤 to speak.</small>`;
        // Title = first thing the user said in that chat (falls back to first bot line)
        function chatTitle(logArr) {
            const first = logArr.find(m => (m.cls || '').includes('vm-user')) || logArr[0];
            const div = document.createElement('div');
            div.innerHTML = (first && first.html) || '';
            return (div.textContent || 'Chat').trim().slice(0, 48) || 'Chat';
        }
        // Push the live chat into the archive (with its mid-task state, so a
        // continued chat picks up EXACTLY where it stopped — no context lost).
        function archiveCurrent(archive) {
            if (!chatLog.length) return archive;
            archive.unshift({
                savedAt: new Date().toLocaleString(),
                title: chatTitle(chatLog),
                log: chatLog.slice(-30),
                state: (conversationState && conversationState.entity) ? conversationState : null
            });
            while (archive.length > 10) archive.pop();
            return archive;
        }
        function newChat() {
            try { chrome.storage.local.get(['vasyChatArchive'], r => {
                const hadChat = chatLog.length > 0;
                const archive = archiveCurrent(r.vasyChatArchive || []);
                chatLog = [];
                conversationState = { entity: null, action: null, fields: {} };
                safeSet({ vasyChatArchive: archive, chatLog, conversationState });
                log.innerHTML = '';
                const d = document.createElement('div');
                d.className = 'vm vm-bot';
                d.innerHTML = WELCOME_HTML;
                log.appendChild(d);
                addSys(hadChat ? '🗂️ Previous chat saved — find it under 🕘 · fresh start!' : '✨ Fresh start!');
                input.focus();
            }); } catch (e) {}
        }
        document.getElementById('vasy-new-btn').addEventListener('click', newChat);

        // ── Past chats — view & continue (no context lost) ────────────────────
        const historyPanel = document.getElementById('vasy-history');
        const historyList  = document.getElementById('vasy-history-list');
        const historyBtn   = document.getElementById('vasy-history-btn');

        function openArchivedChat(idx) {
            try { chrome.storage.local.get(['vasyChatArchive'], r => {
                let archive = r.vasyChatArchive || [];
                const entry = archive[idx];
                if (!entry) return;
                archive.splice(idx, 1);                 // it becomes the live chat
                archive = archiveCurrent(archive);      // park the one we're leaving
                chatLog = entry.log || [];
                conversationState = entry.state || { entity: null, action: null, fields: {} };
                safeSet({ vasyChatArchive: archive, chatLog, conversationState });
                log.innerHTML = '';
                addSys(`⏪ Continuing chat from ${entry.savedAt}`);
                chatLog.forEach(renderStoredMsg);
                log.scrollTop = log.scrollHeight;
                if (conversationState.entity)
                    addSys(`🧠 Picking up mid-task: ${conversationState.entity} — just answer the last question or add details.`);
                historyPanel.classList.add('vasy-hidden');
                input.focus();
            }); } catch (e) {}
        }

        function renderHistory() {
            try { chrome.storage.local.get(['vasyChatArchive'], r => {
                const archive = r.vasyChatArchive || [];
                historyList.innerHTML = '';
                if (!archive.length) {
                    historyList.innerHTML = `<div class="vasy-hist-empty">No saved chats yet — press ✚ to save this one and start fresh. Your last 10 chats are kept here.</div>`;
                    return;
                }
                archive.forEach((entry, i) => {
                    const row = document.createElement('div');
                    row.className = 'vasy-hist-row';
                    const meta = document.createElement('div');
                    meta.className = 'vasy-hist-meta';
                    meta.innerHTML = `<div class="vasy-hist-title">${(entry.title || chatTitle(entry.log || [])).replace(/</g,'&lt;')}</div>
                        <div class="vasy-hist-sub">${entry.savedAt || ''} · ${(entry.log || []).length} messages${entry.state && entry.state.entity ? ' · ⏸ mid-task: ' + entry.state.entity : ''}</div>`;
                    meta.title = 'Continue this chat';
                    meta.addEventListener('click', () => openArchivedChat(i));
                    const del = document.createElement('button');
                    del.className = 'vasy-hist-del';
                    del.textContent = '🗑';
                    del.title = 'Delete this chat';
                    del.addEventListener('click', ev => {
                        ev.stopPropagation();
                        try { chrome.storage.local.get(['vasyChatArchive'], rr => {
                            const a = rr.vasyChatArchive || [];
                            a.splice(i, 1);
                            safeSet({ vasyChatArchive: a });
                            renderHistory();
                        }); } catch (e) {}
                    });
                    row.appendChild(meta);
                    row.appendChild(del);
                    historyList.appendChild(row);
                });
            }); } catch (e) {}
        }

        historyBtn.addEventListener('click', () => {
            const opening = historyPanel.classList.contains('vasy-hidden');
            historyPanel.classList.toggle('vasy-hidden');
            if (opening) { settings.classList.add('vasy-hidden'); renderHistory(); }
        });

        // About / guide page — bundled with the extension, opens locally
        document.getElementById('vasy-about-link').addEventListener('click', e => {
            e.preventDefault();
            try { window.open(chrome.runtime.getURL('landing.html'), '_blank'); } catch (err) {}
        });

        ttsBtn.addEventListener('click', () => {
            ttsEnabled = !ttsEnabled;
            ttsBtn.innerHTML = svg(ttsEnabled ? 'spkOn' : 'spkOff') + `<span>Read replies aloud${ttsEnabled ? ': on' : ''}</span>`;
            ttsBtn.title = ttsEnabled ? 'Voice responses ON — click to disable' : 'Voice responses OFF — click to enable';
            ttsBtn.classList.toggle('vasy-tts-on', ttsEnabled);
            safeSet({ ttsEnabled });
            addSys(ttsEnabled ? '🔊 Voice responses enabled' : '🔇 Voice responses disabled');
        });

        sendBtn.addEventListener('click', handleSend);

        // ── Inline completion: grey ghost text after what you typed — Tab (or →
        // at the end of the line) takes it. Best source first: commands THIS user
        // has run (their own history), the command templates ranked by use, then
        // names and codes they have typed before ("…invoice for Gup" → "Gupta Stores").
        const ghost = document.getElementById('vasy-ghost');
        let ghostRest = '';
        const NOT_NAMES = /^(create|add|new|sell|pay|collect|show|open|find|search|stock|print|total|who|what|how|is|enable|disable|set|produce|make|record|receive|transfer|increase|decrease|delete|edit|change|update|the|for|from|to|of|cash|upi|card|bank|yes|no|ok|help)$/i;
        function nameBank() {
            const seen = new Map();
            for (const c of cmdHistory.slice(-300)) {
                const s = String(c || '');
                const found = [...s.matchAll(/\b[A-Z][\w&.'\-]*(?:\s+[A-Z][\w&.'\-]*){0,3}\b/g), ...s.matchAll(/\b[A-Za-z]*\d[\w\/\-]*\b/g)];
                for (const m of found) {
                    let n = m[0].trim();
                    const first = n.split(/\s+/)[0];
                    if (NOT_NAMES.test(first)) n = n.split(/\s+/).slice(1).join(' ');
                    if (n.length < 3 || /^\d+$/.test(n)) continue;
                    const k = n.toLowerCase();
                    seen.set(k, { n, c: ((seen.get(k) || {}).c || 0) + 1 });
                }
            }
            return [...seen.values()].sort((a, b) => b.c - a.c);
        }
        function completionFor(text) {
            if (!text || text.trim().length < 2) return '';
            const low = text.toLowerCase();
            for (let i = cmdHistory.length - 1; i >= 0; i--) {            // 1) your own earlier command
                const c = String(cmdHistory[i] || '');
                if (c.length > text.length && c.toLowerCase().startsWith(low) && !/^(yes|no|cancel|ok)\b/i.test(c)) return c.slice(text.length);
            }
            const tpl = SUGGESTIONS.filter(s => s.length > text.length && s.toLowerCase().startsWith(low))   // 2) a command template
                .sort((a, b) => usageWeight(b) - usageWeight(a))[0];
            if (tpl) return tpl.slice(text.length);
            const m = text.match(/(\S{2,})$/);                                // 3) a name or code you've used
            if (m) {
                const w = m[1].toLowerCase();
                const hit = nameBank().find(x => x.n.toLowerCase().startsWith(w) && x.n.length > w.length);
                if (hit) return hit.n.slice(w.length);
            }
            return '';
        }
        function hideGhost() { ghostRest = ''; if (ghost) { ghost.hidden = true; ghost.textContent = ''; } }
        function renderGhost() {
            if (!ghost) return;
            const v = input.value;
            if (document.activeElement !== input || input.disabled || input.selectionStart !== v.length || input.selectionEnd !== v.length) return hideGhost();
            ghostRest = completionFor(v);
            if (!ghostRest) return hideGhost();
            // match the input's type exactly — with !important, because bubble.css styles
            // everything under #vasy-root with !important rules that beat plain inline styles
            const cs = getComputedStyle(input);
            const imp = (k, v) => ghost.style.setProperty(k, v, 'important');
            imp('font-family', cs.fontFamily); imp('font-size', cs.fontSize); imp('font-weight', cs.fontWeight);
            imp('font-style', cs.fontStyle); imp('letter-spacing', cs.letterSpacing); imp('word-spacing', cs.wordSpacing);
            imp('font-kerning', cs.fontKerning || 'auto'); imp('text-transform', cs.textTransform);
            imp('padding-left', (parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth)) + 'px');
            imp('padding-right', (parseFloat(cs.paddingRight) + parseFloat(cs.borderRightWidth)) + 'px');
            ghost.textContent = '';
            const a = document.createElement('span'); a.className = 'g-typed'; a.textContent = v;
            const b = document.createElement('span'); b.className = 'g-rest'; b.textContent = ghostRest;
            const k = document.createElement('span'); k.className = 'g-key'; k.textContent = 'Tab';
            ghost.append(a, b, k);
            ghost.hidden = false;
            // once the typed text scrolls inside the box, a ghost would no longer line up
            if (input.scrollLeft > 0 || a.offsetWidth > input.clientWidth - 30) hideGhost();
        }
        function acceptGhost() {
            if (!ghostRest || !ghost || ghost.hidden) return false;
            input.value = input.value + ghostRest;
            hideGhost();
            input.setSelectionRange(input.value.length, input.value.length);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
        }

        // Live command suggestions as the user types (and clear them on send).
        input.addEventListener('input', () => { renderSuggestions(input.value); renderGhost(); });
        input.addEventListener('focus', renderGhost);
        input.addEventListener('keyup', e => { if (/^Arrow|^Home$|^End$/.test(e.key)) renderGhost(); });
        input.addEventListener('blur', () => setTimeout(() => {
            hideGhost();
            const b = document.getElementById('vasy-suggest');
            if (b) { b.classList.add('vasy-hidden'); b.innerHTML = ''; }
        }, 180));   // delay so a click on a suggestion still registers

        input.addEventListener('keydown', e => {
            // Tab takes the grey completion; with none showing, the first suggestion below
            if (e.key === 'Tab' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.isComposing) {
                if (acceptGhost()) { e.preventDefault(); return; }
                const first = document.querySelector('#vasy-suggest:not(.vasy-hidden) .vasy-sug');
                if (first && input.value.trim()) {
                    e.preventDefault();
                    input.value = first.dataset.cmd;
                    input.setSelectionRange(input.value.length, input.value.length);
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    return;
                }
            }
            if (e.key === 'ArrowRight' && input.selectionStart === input.value.length && acceptGhost()) { e.preventDefault(); return; }
            if (e.key === 'Escape') {
                // first Esc dismisses the completion / suggestions; only a second one closes the panel
                if (ghostRest) { hideGhost(); e.stopPropagation(); return; }
                const b = document.getElementById('vasy-suggest');
                if (b && !b.classList.contains('vasy-hidden')) { b.classList.add('vasy-hidden'); b.innerHTML = ''; e.stopPropagation(); return; }
            }
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const b = document.getElementById('vasy-suggest');
                if (b) { b.classList.add('vasy-hidden'); b.innerHTML = ''; }
                handleSend(); return;
            }
            // Command history navigation
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (historyIdx < cmdHistory.length - 1) {
                    historyIdx++;
                    input.value = cmdHistory[cmdHistory.length - 1 - historyIdx];
                }
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (historyIdx > 0) {
                    historyIdx--;
                    input.value = cmdHistory[cmdHistory.length - 1 - historyIdx];
                } else if (historyIdx === 0) {
                    historyIdx = -1;
                    input.value = '';
                }
            }
            if (e.key === 'Escape') closePanel();
        });

        // ── Global keyboard shortcuts ─────────────────────────────────────────
        // Alt+V toggle panel · Alt+M mic · Alt+N new chat · Alt+T theme · Esc close
        document.addEventListener('keydown', e => {
            if (e.altKey && /^[vV]$/.test(e.key)) {
                e.preventDefault();
                panel.classList.contains('vasy-hidden') ? openPanel() : closePanel();
            } else if (e.altKey && /^[mM]$/.test(e.key)) {
                e.preventDefault();
                openPanel();
                if (!awaitingResult) startListening();
            } else if (e.altKey && /^[nN]$/.test(e.key)) {
                e.preventDefault();
                openPanel();
                newChat();
            } else if (e.altKey && /^[tT]$/.test(e.key)) {
                e.preventDefault();
                themeBtn.click();
            } else if (e.altKey && /^[hH]$/.test(e.key)) {
                e.preventDefault();
                openPanel();
                historyBtn.click();
            } else if (e.key === 'Escape' && !panel.classList.contains('vasy-hidden')) {
                closePanel();
            }
        });

        // ── Commands typed in the chat console page ───────────────────────────
        // The console doesn't have its own pipeline: it hands the text to THIS
        // bubble, so follow-ups, chains and "yes" confirmations behave exactly the
        // same whichever window the user typed in.
        chrome.runtime.onMessage.addListener((req, _s, respond) => {
            if (req.action === 'parse_note') {
                const t = document.getElementById('vasy-typing');
                if (t) { clearTimeout(typingTimer); t.classList.add('vm-typing-ai'); t.dataset.ai = '1'; t.textContent = String(req.text || ''); log.scrollTop = log.scrollHeight; }
                return;
            }
            if (req.action === 'console_ping') { respond({ ok: true, page: location.pathname, module: getModuleName(), busy: awaitingResult }); return; }
            if (req.action !== 'console_command') return;
            if (awaitingResult) {
                consoleEcho('sys', '⏳ Still working on the previous step — send it again in a moment, or say "stop".', 'vm-sys');
                if (/^(stop|cancel)$/i.test(String(req.text || '').trim())) forceStop();
                respond({ ok: false, busy: true }); return;
            }
            input.value = String(req.text || '');
            handleSend();
            respond({ ok: true });
        });
        safeSet({ vasyErpOrigin: location.origin });

        // ── Incoming agent_result ─────────────────────────────────────────────
        chrome.runtime.onMessage.addListener(req => {
            if (req.action !== 'agent_result') return;

            // ── Batch selection needed: product has multiple batches ───────────
            if (req.status === 'batch_needed') {
                clearFailsafe();
                removeTyping();
                openPanel();
                const bm = addMsg(`🔢 ${req.message}`, 'vm-bot', 'Please select a batch number.');
                if (Array.isArray(req.choices) && req.choices.length) attachChoices(bm, req.choices);
                // Keep conversationState so Pattern 0 maps "batch 2" → select_batch action
                conversationState = { entity: 'POSSale', action: 'batch_select', fields: { ...conversationState.fields } };
                awaitingResult = false;
                safeSet({ conversationState, awaitingResult: false });
                setBusy(false); enable();
                input.focus();
                return;
            }

            // ── Task chain resolver: an intermediate task completed ────────────
            if (_taskChainResolver) {
                const resolve = _taskChainResolver;
                _taskChainResolver = null;
                resolve(req);
                return;
            }

            if (!awaitingResult) return; // deduplicate: ignore backup messages after task handled
            clearFailsafe();
            removeTyping();
            openPanel();
            // The dashboard reader found nothing for a question that was probably never
            // about the dashboard ("show me what Sharma owes") — read it once more without it.
            if (req.retryParse && req.question && !_dashRetried) {
                _dashRetried = true;
                awaitingResult = false; safeSet({ awaitingResult: false });
                setBusy(false); enable();
                conversationState = { entity: null, action: null, fields: {} };
                addSys('↪ Not a dashboard question — reading it another way…');
                handleSend({ text: req.question, retry: true, noDashQA: true });
                return;
            }
            let keepState = false;
            // "Which one?" with real answers: clear the field that turned out to be
            // ambiguous and remember it, so the tapped answer fills exactly that
            // field and the task carries on with everything else kept.
            const hasChoices = Array.isArray(req.choices) && req.choices.length > 0;
            if (hasChoices && conversationState.entity) {
                const term = String(req.choiceTerm || '').trim().toLowerCase();
                const termKey = term && Object.keys(conversationState.fields || {}).find(k => String(conversationState.fields[k] ?? '').trim().toLowerCase() === term);
                // The wrong value goes whichever field it sat in; the answer goes in the
                // field the question names (choiceField) — e.g. a credit note told
                // "SO-12" that isn't an invoice gets its invoiceNumber from the tap.
                if (termKey) delete conversationState.fields[termKey];
                const key = (req.choiceField && String(req.choiceField)) || termKey;
                if (key) { delete conversationState.fields[key]; conversationState.pendingChoice = key;
                           // the offered answers: a reply that matches none of them is a new request
                           conversationState.choiceValues = req.choices.map(c => String(c.value || '')).slice(0, 8); }
            }
            if (req.status === 'success') {
                const msg = `✅ <b>${req.title || cheer()}</b>${req.message ? '<br><small>' + req.message + '</small>' : ''}`;
                // Speak the full result (title + details) when 🔊 is on
                const spoken = [(req.title || 'Done'), (req.message || '').replace(/<[^>]*>/g, ' ')].join('. ');
                addMsg(msg, 'vm-bot vm-success', spoken);
                celebrate();
            } else if (req.status === 'info') {
                // Info = the flow is mid-way (e.g. "select the PO then save") —
                // KEEP the task context so follow-ups like "select BIL173" work.
                // A finished LOOKUP is not mid-way: keeping "PartyBalance" as the
                // open task made the next command ("stock of PP10955") read as an
                // answer to it — "Sorry, I didn't catch that".
                const terminal = /^(PartyBalance|StockQuery|OpenDoc|PageQA|Report|SalesRegister|Vina|VinaRead|Setting)$/.test(conversationState.entity || '')
                              || /^(search|view|open|query|fetch|list|lookup|toggle)$/.test(conversationState.action || '');
                keepState = !!conversationState.entity && !terminal;
                const im = addMsg(`ℹ️ ${req.title ? '<b>' + req.title + '</b> ' : ''}${req.message}`, 'vm-bot', req.message?.replace(/<[^>]*>/g,''));
                if (hasChoices) { attachChoices(im, req.choices); keepState = !!conversationState.entity; }
            } else {
                // Recoverable failures: keep the task context and drop only the failed
                // field, so the user's next message is treated as the correction.
                const plain = (req.message || '').replace(/<[^>]*>/g, '');
                let hint = 'Tweak the details and try again — I\'m right here.';
                if (req.title === 'Signed out' || /session has expired/i.test(plain)) {
                    hint = '🔑 Sign in to VasyERP in this tab, then send the same command again.';
                    keepState = false;
                } else if (/multiple close matches/i.test(plain) && conversationState.entity) {
                    delete conversationState.fields.supplierName;
                    delete conversationState.fields.customerName;
                    delete conversationState.fields.partyName;
                    keepState = true;
                    hint = '👇 Tap the right one (or type it) — I\'ll continue with everything else remembered.';
                } else if (/product .{0,50}not found/i.test(plain) && conversationState.entity) {
                    delete conversationState.fields.itemName;
                    keepState = true;
                    hint = '💡 Just send me the corrected <b>product name</b> — I\'ll retry the rest automatically.';
                } else if (/mobile number.{0,20}(already )?exist/i.test(plain) && conversationState.entity) {
                    delete conversationState.fields.mobile;
                    keepState = true;
                    hint = '💡 Send a different <b>mobile number</b> (or say "skip mobile") — I\'ll retry.';
                } else if (/(customer|supplier|vendor) .{0,50}not found/i.test(plain) && conversationState.entity) {
                    delete conversationState.fields.customerName;
                    delete conversationState.fields.supplierName;
                    keepState = true;
                    hint = '💡 Send me the corrected <b>name</b> — I\'ll retry automatically.';
                }
                const em = addMsg(`${oops()} <b>${req.message || 'Unknown error. Check VasyERP manually.'}</b><br><small style="color:#999">${hint}</small>`, 'vm-bot vm-error', 'Failed. ' + plain);
                if (hasChoices) { attachChoices(em, req.choices); keepState = !!conversationState.entity; }
            }
            if (!keepState) conversationState = { entity: null, action: null, fields: {} };
            awaitingResult = false;
            safeSet({ conversationState, awaitingResult: false });
            setBusy(false); enable();
            input.focus();
            setTimeout(refreshContext, 500);
        });

        // ── Sequential multi-task execution ───────────────────────────────────
        async function executeTaskChain(tasks) {
            awaitingResult = true;
            safeSet({ awaitingResult: true, awaitingSince: Date.now() });
            setBusy(true);
            startFailsafe();

            // The document each step creates becomes the PARENT of the next one —
            // so "…then receive it" means the purchase order made a moment ago, not
            // whichever open order the dropdown happens to list first.
            const PARENT_KEY = {
                'PurchaseOrder>MaterialInward': 'poNumber',
                'MaterialInward>SupplierBill':  'miNumber',
                'SupplierBill>BillPayment':     'billNumber',
                'SalesOrder>DeliveryChallan':   'soNumber',
                'SalesOrder>SalesInvoice':      'soNumber',
                'DeliveryChallan>SalesInvoice': 'challanNumber',
            };
            let lastDoc = null, lastEntity = null;
            for (let i = 0; i < tasks.length; i++) {
                const task  = tasks[i];
                const isLast = i === tasks.length - 1;
                const key = lastDoc && PARENT_KEY[lastEntity + '>' + task.entity];
                if (key && !(task.fields || {})[key]) task.fields = { ...(task.fields || {}), [key]: lastDoc };
                removeTyping();
                addSys(`⚙️ Step ${i + 1}/${tasks.length}: ${task.entity}…`);

                const result = await new Promise(resolve => {
                    _taskChainResolver = resolve;
                    chrome.runtime.sendMessage({
                        action: 'dispatch', entity: task.entity,
                        taskAction: task.action, fields: task.fields
                    }).catch(() => resolve({ status: 'error', message: 'Dispatch failed.' }));
                });

                if (result.status === 'error') {
                    addMsg(`❌ <b>Step ${i + 1} failed:</b> ${result.message || 'Unknown error.'}`, 'vm-bot vm-error');
                    break;
                }
                // Anything short of a clean success means this step is WAITING on
                // the user — a save held for "yes", a variant to pick, a missing
                // parent. Running the next step now would navigate away and throw
                // that half-finished form away, so stop and say what's left.
                if (result.status !== 'success') {
                    addMsg(`⏸️ <b>Step ${i + 1} needs you:</b> ${result.title ? '<b>' + result.title + '</b> — ' : ''}${result.message || ''}`, 'vm-bot');
                    const left = tasks.slice(i + 1).map(t => t.entity);
                    if (left.length)
                        addMsg(`<small>Still to do after that: ${left.join(' → ')}. Ask for ${left.length === 1 ? 'it' : 'them'} once this step is done.</small>`, 'vm-bot');
                    break;
                }

                lastDoc = result.docRef || null;
                lastEntity = task.entity;
                const msgHtml = isLast
                    ? `✅ <b>${result.title || 'All done!'}</b>${result.message ? '<br><small>' + result.message + '</small>' : ''}`
                    : `✅ <b>${result.title || task.entity + ' created'}</b>${result.message ? '<br><small>' + result.message + '</small>' : ''}`;
                addMsg(msgHtml, 'vm-bot vm-success', result.title || 'Done');
            }

            conversationState = { entity: null, action: null, fields: {} };
            awaitingResult = false;
            safeSet({ conversationState, awaitingResult: false });
            clearFailsafe();
            setBusy(false); enable();
            input.focus();
            setTimeout(refreshContext, 500);
        }

        // ── Off-topic pre-filter (saves API tokens) ───────────────────────────
        const OFF_TOPIC_RE = /\b(weather|joke|poem|lyrics|cricket|football|movie|film|recipe|news|sports|code|program|algorithm|explain (?:me )?(?!gst|tds|hsn|credit|debit)|write (?:a |me )?(?!purchase|sales|debit|credit)|tell (?:me )?(?:a )?(?:joke|story|poem|fact))\b/i;
        // "recipe" is off-topic as cooking chat but a VasyERP module (Production › Recipe):
        // without it here every "create recipe …" was turned away before it was parsed.
        const ERP_RE       = /invoice|order|purchase|sale|stock|product|customer|supplier|vendor|gst|report|payment|receipt|ledger|inventory|employee|contact|pos|debit|credit|expense|transfer|journal|voucher|batch|challan|reconcil|loyalty|coupon|discount|branch|barcode|hsn|tds|bill|grn|eway|einvoice|recipe|\bbom\b|bill of material|manufactur|assembl/i;

        function isOffTopic(text) {
            if (ERP_RE.test(text)) return false; // definitely ERP — never block
            return OFF_TOPIC_RE.test(text);
        }

        // ── Send handler ──────────────────────────────────────────────────────
        // opts.retry — a quiet re-ask of the same words (no new user bubble, no history);
        // opts.noDashQA — skip the dashboard tier (it found nothing for this question)
        let _dashRetried = false;
        async function handleSend(opts = {}) {
            const text = String(opts.text != null ? opts.text : input.value).trim();
            if (!text || awaitingResult) return;
            if (!opts.retry) _dashRetried = false;

            const lower = text.toLowerCase();

            if (opts.retry) {
                disable(); addTyping();
            } else if (['reset', 'cancel', 'start over'].includes(lower)) {
                conversationState = { entity: null, action: null, fields: {} };
                safeSet({ conversationState });
                input.value = ''; historyIdx = -1;
                addMsg(text, 'vm-user');
                addMsg('🔄 Conversation reset. What would you like to do?', 'vm-bot', 'Reset. What would you like to do?');
                return;
            }

            if (!opts.retry && (lower === 'help' || lower === '?')) {
                input.value = ''; historyIdx = -1;
                addMsg(text, 'vm-user');
                showHelp();
                return;
            }

            // Client-side scope guard — reject obvious non-ERP queries without any API call
            if (!opts.retry && isOffTopic(text)) {
                addMsg(text, 'vm-user');
                addMsg("I'm your VasyERP assistant and can only help with ERP tasks — contacts, orders, inventory, invoices, reports, payments, and more. What would you like to do in VasyERP?", 'vm-bot');
                input.value = ''; historyIdx = -1; return;
            }

            if (!opts.retry) {
                recordCmdUse(text);
                // Save to history (Tab completion learns from it, so keep a good stretch)
                if (text !== cmdHistory[cmdHistory.length - 1]) {
                    cmdHistory.push(text);
                    if (cmdHistory.length > 200) cmdHistory.shift();
                    safeSet({ cmdHistory });
                }
                historyIdx = -1;
                input.value = '';
                disable();
                addMsg(text, 'vm-user');
                addTyping();
            }

            if (!chrome?.runtime?.sendMessage) {
                removeTyping();
                addMsg('⚠️ VasyERP extension was reloaded — please refresh this page to reconnect.', 'vm-bot vm-error');
                enable(); return;
            }

            try {
                // Understanding a command is local and fast; a service worker that hangs
                // (or an on-device model stuck loading) must never leave the box locked.
                const askOnce = ms => Promise.race([
                    chrome.runtime.sendMessage({ action:'parse_intent', text, conversationState, currentPage: location.pathname, noDashQA: !!opts.noDashQA }),
                    new Promise(res => setTimeout(() => res({ timedOut: true }), ms)),
                ]);
                let result = await askOnce(30000);
                // A busy or low-memory PC can stall the worker for tens of seconds. Asking
                // again is safe — understanding a command changes nothing — so try once more.
                if (result && result.timedOut) {
                    const t = document.getElementById('vasy-typing');
                    if (t) { t.classList.add('vm-typing-ai'); t.textContent = '⏳ Your computer is busy — still trying…'; }
                    result = await askOnce(45000);
                    if (result && result.timedOut) result = { error: 'I couldn’t get an answer — this computer seems very busy right now. Send it again in a moment.' };
                }
                if (conversationState.pendingChoice) { delete conversationState.pendingChoice; delete conversationState.choiceValues; }
                if (!result || result.error) throw new Error(result?.error || 'No response from background script');
                const intent = result.intent;

                // Additive state merge
                if (intent.newTask) {
                    conversationState = { entity: intent.entity, action: intent.action, fields: intent.fields || {} };
                } else {
                    conversationState.entity = intent.entity || conversationState.entity;
                    conversationState.action = intent.action || conversationState.action;
                    const nf = intent.fields || {};
                    Object.keys(nf).forEach(k => {
                        if (nf[k] !== null && nf[k] !== undefined && nf[k] !== '')
                            conversationState.fields[k] = nf[k];
                    });
                }
                safeSet({ conversationState });
                removeTyping();

                // Remember which language this answer came back in so the reply is
                // SPOKEN in it too, and show that it was translated on-device.
                lastReplyLang = intent._userLang || '';
                const badge = srcBadge(intent._source) + langBadge(intent._userLang);
                const icon  = srcIcon(intent._source);

                // scope enforcement (the parser's scope gate)
                if (intent.action === 'out_of_scope') {
                    conversationState = { entity: null, action: null, fields: {} };
                    safeSet({ conversationState });
                    addMsg(badge + (intent.botResponse || "I can only assist with VasyERP tasks. Please ask about contacts, orders, inventory, payments, or reports."), 'vm-bot');
                    enable(); return;
                }

                if (!intent.isReady) {
                    const am = addMsg(badge + (intent.botResponse || 'Could you give me a bit more info?'), 'vm-bot', intent.botResponse || '');
                    // e.g. the on-device model's "I read that as … — go ahead?" → Yes / No
                    if (Array.isArray(intent.choices) && intent.choices.length) attachChoices(am, intent.choices);
                    enable();
                } else if (intent.tasks && intent.tasks.length > 1) {
                    // Multi-action chain — execute sequentially
                    addSys(`${icon} ⏳ ${intent.botResponse || 'Starting ' + intent.tasks.length + '-step task…'}`);
                    executeTaskChain(intent.tasks);
                } else {
                    awaitingResult = true;
                    safeSet({ awaitingResult: true, awaitingSince: Date.now() });
                    setBusy(true);
                    startFailsafe();
                    startProgress(`⏳ ${String(intent.botResponse || 'Working on it…').replace(/<[^>]+>/g, '')}`);
                    chrome.runtime.sendMessage({
                        action: 'dispatch',
                        entity: conversationState.entity,
                        taskAction: conversationState.action,
                        fields: conversationState.fields
                    });
                }
            } catch (err) {
                removeTyping();
                if (err.message?.includes('invalidated') || err.message?.includes('Extension context')) {
                    showContextError();
                } else {
                    addMsg(`⚠️ ${err.message}`, 'vm-bot vm-error', 'Error: ' + err.message);
                }
                enable();
            }
        }

        function showHelp() {
            addMsg(`<b>Vasy AI Agent v17 — Command Examples</b><br><br>
<b>🎤 Voice:</b> Click mic · <b>⌨️</b> Alt+V toggle · <b>↑↓</b> history · type <b>reset</b> to clear<br>
<b>⇥ Tab:</b> grey text after what you type is a guess from your own past commands, names you've used and the command list — press <b>Tab</b> (or →) to take it<br>
<b>🧠 Learns as you go:</b> a wording it doesn't know is read by Chrome's on-device AI (nothing leaves this computer); it asks before acting on that reading, and once a wording works it answers it instantly next time — ⚙️ Settings shows what it learned<br>
<b>🌐 Any language:</b> speak or type in Hindi, Gujarati, Marathi, Tamil, Telugu, Bengali, Kannada,
Punjabi, Malayalam, Odia or Urdu — Vasy answers back in the same language, on your device.<br>
<b>🗣️ Voice:</b> tap the language pill beside the mic to switch · <i>Hands-free</i> listens again after each reply (say "stop listening" to end) · English and Hindi can run fully on-device<br>
<b>🖐️ Move it:</b> drag the header (or the V button) anywhere · drag the corner to resize · double-click the header to reset<br>
<b>👁️ See the page:</b> eye = see-through (Alt+G) · chevron = compact (Alt+K)<br>
<b>🪟 Console:</b> ⋯ → Open chat console (Alt+Shift+V) — type in its own window while the ERP works alongside<br><br>

<b>── CONTACTS & EMPLOYEES ──</b><br>
"Create customer Raj, mobile 9876543210, GSTIN 27AAPFU0939F1Z6"<br>
"New supplier ABC Corp, mobile 9988776655, type Wholesaler"<br>
"Add employee Priya, mobile 9988776655, role Cashier"<br>
"Edit supplier Sharma Textiles mobile 9111111111" · "Change email of customer Raj to raj@x.com"<br>
"Change price of Notebook1 to 450" · "Set mrp of PP10955 to 120"<br>
"Delete customer 9876543210" — I show you the exact record and wait for <b>yes</b><br><br>

<b>── YOUR DASHBOARD ──</b><br>
"Total sales this month" · "How did customers pay this month?" · "Who owes me money?"<br>
"Who are my champion customers?" · "Least selling products last month" · "Top expenses this month"<br>
"What is my business health score?" · "Target vs actual" · "Open targets" · "Open BHI config"<br>
<small>On the Dashboard, the chips above show questions for the tiles and panels on your screen.</small><br><br>

<b>── LOOK IT UP ──</b><br>
"How much does Gupta Stores owe?" · "Balance of Sharma Textiles" · "Stock of Notebook1"<br>
"Open invoice INV/1352" · "Print INV/1352" · "PDF of PO BIL233" · "Find customer Gupta Stores"<br>
On any invoice, bill, receipt or note: "print this" · "download pdf" · "print karo"<br><br>

<b>── SAY IT YOUR WAY ──</b><br>
"Sharma Textiles ko 500 cash de do" · "Gupta Stores se 300 mile upi" · "Notebook1 ka stock kitna hai"<br>
"Sell 2 PP10955 and 1 Notebook1 cash" — several items in one go<br>
"Paid Sharma Textiles 2000 by upi" · "Gupta Stores paid 500 cash"<br>
"Order 10 Notebook1 from Sharma Textiles at 400" · "Move 2 Notebook1 to testB"<br>
"Gupta Stores returned 1 Notebook1" · "Send back 3 Notebook1 to Sharma Textiles"<br>
"Credit note for Gupta Stores" — I list their invoices to tap<br><br>

<b>── PURCHASE CYCLE (PO → GRN → Bill → Payment) ──</b><br>
"New PO for ABC Corp, Steel Rod qty 100, price 200"<br>
"Create GRN for PO-001, supplier ABC Corp"<br>
"Supplier bill for ABC Corp, MI-002, bill date today"<br>
"Pay ABC Corp ₹20000, NEFT, bank HDFC"<br>
"Debit note / return to ABC Corp against bill B-001"<br><br>

<b>── SALES CYCLE (Order → Invoice → Challan → Receipt) ──</b><br>
"Sales order for Raj Mehta, Steel Rod qty 50"<br>
"Invoice for Raj, Steel Rod qty 10, UPI payment"<br>
"Delivery challan / DC for Raj, Steel Rod qty 10"<br>
"Received ₹10000 from Raj, UPI, ref UTR1234"<br>
"Credit note for customer Raj against invoice SI-101"<br><br>

<b>── POS (Point of Sale) ──</b><br>
"Sell Steel Rod qty 2, cash" · "Sell 3 items: Biscuit qty 5, Water qty 2, Chips qty 3, UPI"<br>
"Sell 1 PP10955 to Gupta Stores cash" — item codes are scanned like a barcode · two products with one name → tap the right one<br>
"POS sale, flat discount ₹50, customer 9876543210"<br><br>

<b>── INVENTORY ──</b><br>
"Increase stock Steel Rod by 200" · "Decrease stock Biscuit 10, damage"<br>
"Transfer Steel Rod qty 30 to Mumbai Branch"<br>
"Set opening stock Steel Rod qty 500, price 200, batch date 01/01/2025"<br>
"Material consumption Steel Rod qty 5, production"<br>
"Which stock selection method am I using?" · "Use FIFO" / "Use LIFO" · "Enable FEFO"<br><br>

<b>── PRODUCTION ──</b><br>
"Create recipe Gift Pack with 2 Notebook1 and 1 PP10955 makes 1 Hamper" · "New disassemble recipe …"<br>
"Produce 2 batches of Mix Mithai" — I fill the production run and wait for <b>yes</b> before posting<br>
"Open recipes" · "Open production"<br><br>

<b>── FINANCE & BANK ──</b><br>
"Expense ₹500 cash, office supplies" · "JV debit Sales account ₹10000"<br>
"Withdraw ₹2000 cash for Priya" · "Transfer ₹50000 HDFC to ICICI"<br>
"Open bank reconciliation" · "Reconcile bank statement this month"<br><br>

<b>── CRM, COUPONS & LOYALTY ──</b><br>
"Create coupon SUMMER10, 10% discount, valid till 31/12/2025"<br>
"Create BXGY discount: buy 2 get 1 free" · "Create membership Gold 365 days amount 999"<br>
"Set loyalty earn rate 10 points per ₹100"<br>
<small style="opacity:.75">Loyalty here is campaigns + the earn rate. Points move when you bill (POS → Redeem loyalty);
this VasyERP build has no screen for editing one customer's points.</small><br><br>

<b>── USERS & ROLES ──</b><br>
"Create a cashier role" · "Create a purchase manager role called Buying Team"<br>
"Create an accountant role" · "Create user role Manager with all permissions"<br>
<small style="opacity:.75">Job presets grant only what that job needs — never delete rights.</small><br><br>

<b>── UTILITIES ──</b><br>
"Print barcodes for Steel Rod 20 labels A4" · "Export sales to Tally"<br>
"Who changed the settings?" · "Show user activity log"<br>
"Return POS bill GGN/26-27/DLF/100079" · "Export this list to Excel"<br><br>

<b>── REPORTS (just say what you need) ──</b><br>
"Sales report today" · "GST report this month" · "P&L this financial year"<br>
"Stock summary" · "Day book today" · "Customer outstanding for Raj"<br>
"Low stock report" · "Pending purchase order" · "Trial balance"<br><br>

<b>── COMPLIANCE ──</b><br>
"Generate e-invoice" (on invoice page) · "Generate e-way bill" (on DC/invoice page)<br><br>

<b>── ASK ANYTHING ──</b><br>
"What were total sales today?" · "Which products are running out?"<br>
"Should I restock Steel Rod?" → sent to Vina, your data analyst<br><br>

<small style="opacity:.75">Anything that posts money, moves stock or needs approval is read back to you first —
you confirm before it's written. Type <b>reset</b> to start a new task.</small>`, 'vm-bot');
            enable();
        }

        // Initial chip render
        renderChips(getChips());
        ctxModule.textContent = getModuleName();
    }

    // ── Global safety net: catch any context-invalidated rejections ───────────
    window.addEventListener('unhandledrejection', e => {
        const msg = e.reason?.message || '';
        if (msg.includes('invalidated') || msg.includes('Extension context')) {
            e.preventDefault();
            const log = document.getElementById('vasy-log');
            if (log && !document.getElementById('vasy-ctx-err')) {
                const d = document.createElement('div');
                d.id = 'vasy-ctx-err';
                d.className = 'vm vm-bot vm-error';
                d.innerHTML = '⚠️ VasyERP extension was reloaded — please <b>refresh this page</b> to reconnect.';
                log.appendChild(d);
                log.scrollTop = log.scrollHeight;
            }
        }
    });

    buildUI();
    initBubble();
}
