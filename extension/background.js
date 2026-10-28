// © 2026 Moksheet Shah. All rights reserved. Shared for viewing only — no copying, modification or redistribution without written permission. See LICENSE.
'use strict';
// background.js v17.3 — VasyERP AI Agent Service Worker
// Deep upgrade: BankReconciliation, expanded prompt, better Credit/Debit Note, CRM, Reports

const ROUTES = {
    Contact:              { list: '/contact/',                      new: '/contact/new' },
    Employee:             { list: '/employee/',                     new: '/employee/new' },
    Product:              { list: '/product',                       new: '/product/new' },
    PurchaseOrder:        { list: '/purchase/order',                new: '/purchase/order/new' },
    MaterialInward:       { list: '/purchase/materialinward',       new: '/purchase/materialinward/new' },
    SupplierBill:         { list: '/purchase/bill',                 new: '/purchase/bill/new' },
    PurchaseReturn:       { list: '/purchase/debitnote',            new: '/purchase/debitnote/new' },
    SalesOrder:           { list: '/sales/order',                   new: '/sales/order/new' },
    SalesInvoice:         { list: '/sales/invoice',                 new: '/sales/invoice/new' },
    SalesReturn:          { list: '/sales/creditnote',              new: '/sales/creditnote/new' },
    SalesEstimate:        { list: '/sales/estimate',                new: '/sales/estimate/new' },
    // v9.13.0: opening stock AND stock adjustments are the "Stock IN/OUT" dialog
    // on /product/opening-stock (the old routes render "Data Not Available").
    StockAdjust:          { list: '/product/opening-stock',         new: '/product/opening-stock' },
    StockTransfer:        { list: '/stocktransfer',                 new: '/stocktransfer/new' },
    StockTransferRequest: { list: '/stocktransferrequest',          new: '/stocktransferrequest/new' },
    MaterialConsumption:  { list: '/materialconsumption',           new: '/materialconsumption/new' },
    CRMLead:              { list: '/crm/feedback',                  new: '/crm/feedback' },
    Payment:              { list: '/payment',                       new: '/payment/new' },
    Receipt:              { list: '/receipt',                       new: '/receipt/new' },
    Expense:              { list: '/expense',                       new: '/expense/new' },
    InternalTransfer:     { list: '/manager/internaltransfer',      new: '/manager/internaltransfer/new' },
    DeliveryChallan:      { list: '/sales/deliverychallan',         new: '/sales/deliverychallan/new' },
    BillOfMaterials:      { list: '/billofmaterials',               new: '/billofmaterials/new' },
    Recipe:               { list: '/recipe',                        new: '/recipe/new' },
    MaterialCreation:     { list: '/materialcreation',              new: '/materialcreation/new' },
    JournalVoucher:       { list: '/journalvoucher',                new: '/journalvoucher/new' },
    Report:               { list: '/report',                        new: '/report' },
    POSSale:              { list: '/report/pos',                    new: '/pos/new' },
    Coupon:               { list: '/coupon',                        new: '/coupon/new' },
    Membership:           { list: '/membershipmaster',              new: '/membershipmaster' },
    Discount:             { list: '/discount',                      new: '/discount/new' },
    Branch:               { list: '/branch',                        new: '/branch/new' },
    // v9.13.0 migrated Category, Brand and Department onto one React page with a
    // tab each. /department now 404s outright; /categorybrand still answers but is
    // no longer what the navigation points at, so follow the ERP's own menu.
    Category:             { list: '/item-masters',                  new: '/item-masters' },
    Brand:                { list: '/item-masters',                  new: '/item-masters' },
    OpeningStock:         { list: '/product/opening-stock',         new: '/product/opening-stock' },
    StockVerification:    { list: '/inventorytracking',             new: '/inventorytracking/new' },
    Loyalty:              { list: '/loyalty',                       new: '/loyalty' },
    Feedback:             { list: '/crm/feedback',                  new: '/crm/feedback' },
    Department:           { list: '/item-masters',                  new: '/item-masters' },
    // NEW in v9.10.0
    BankReconciliation:   { list: '/bank-reconciliation',           new: '/bank-reconciliation' },
    // ── v14.0: FULL module map (every item in VasyERP's nav tree) ────────────
    // The legacy /userrole/new carries the SAME permission matrix with stable ids
    // (View-<module>, Insert-<module>…), so granular grants are possible there and
    // not on the React rebuild at /users/user-roles/new.
    // list lives on the React page; /userrole alone redirects to /setting/general.
    // new MUST stay on the legacy page - it is the only one that renders the
    // permission matrix createUserRole() ticks.
    UserRole:             { list: '/users/user-roles',              new: '/userrole/new' },
    UnitOfMeasurement:    { list: '/unit-of-measurement',           new: '/unit-of-measurement' },
    CategoryVariant:      { list: '/category-wise-variants',        new: '/category-wise-variants' },
    B2BPriceMapping:      { list: '/customer-category-pricing',     new: '/customer-category-pricing' },
    ConsumptionType:      { list: '/consumption-types',             new: '/consumption-types' },
    PurchaseTerms:        { list: '/purchase-terms',                new: '/purchase-terms' },
    SalesTerms:           { list: '/sales-terms',                   new: '/sales-terms' },
    // v9.13.0: customer categories moved onto the Price-mapping page's
    // "Customer Categories" tab; /customer-category renders nothing now.
    CustomerCategory:     { list: '/customer-category-pricing',     new: '/customer-category-pricing' },
    EcommerceCatalog:     { list: '/ecommerce-catalog',             new: '/ecommerce-catalog' },
    Bank:                 { list: '/bank',                          new: '/bank' },
    BankTransaction:      { list: '/banktransaction',               new: '/banktransaction' },
    OwnerCashFlow:        { list: '/owner/cashflow',                new: '/owner/cashflow' },
    ManagerCashFlow:      { list: '/manager/cashflow',              new: '/manager/cashflow' },
    POSCreditNote:        { list: '/pos/creditnote',                new: '/pos/creditnote' },
    // POS returns start on the till screen, not a page of their own.
    POSReturn:            { list: '/pos/new',                       new: '/pos/new' },
    SalesRegister:        { list: '/salesregister',                 new: '/salesregister' },
    POSOrders:            { list: '/report/pos',                    new: '/report/pos' },
    AccountGroup:         { list: '/accountgroup',                  new: '/accountgroup' },
    // V9.14.0: the menu's "Account" is the redesigned tree at /chart-of-accounts (Import,
    // Export, Opening balances); the classic /account form still creates accounts.
    Account:              { list: '/chart-of-accounts',             new: '/account' },
    AcctDebitNote:        { list: '/cr-dr-notes',                   new: '/cr-dr-notes' },
    AcctCreditNote:       { list: '/cr-dr-notes',                   new: '/cr-dr-notes' },
    Storage:              { list: '/drive',                         new: '/drive' },
    BarcodeLabels:        { list: '/barcodeutility',                new: '/barcodeutility' },
    Tally:                { list: '/tally',                         new: '/tally' },
    Prefix:               { list: '/prefix',                        new: '/prefix' },
    Tax:                  { list: '/tax',                           new: '/tax' },
    PaymentTerms:         { list: '/payment-terms',                 new: '/payment-terms' },
    AdditionalCharges:    { list: '/additional-charges',            new: '/additional-charges' },
    MacBinding:           { list: '/mac-binding',                   new: '/mac-binding' },
    Integrations:         { list: '/settingnew/integrations',       new: '/settingnew/integrations' },
    Logs:                 { list: '/logs',                          new: '/logs' },
    Vina:                 { list: '/vina',                          new: '/vina' },
    // V9.14.0 pages (verified 22/10/2026)
    BHIConfig:            { list: '/bhi-config',                    new: '/bhi-config' },
    TargetVsActual:       { list: '/target-vs-actual',              new: '/target-vs-actual' },
    ComboProduct:         { list: '/combo-products',                new: '/combo-products' },
};

// ── Setup masters that follow the same "New → name (+value) → Save" shape ────
// One generic handler drives them all (content_agent: createSimpleMaster), so a
// new master page costs one line here instead of a bespoke function.
// Every VasyERP host the agent works on — SINGLE source of truth. Keep in step
// with manifest.json (content_scripts.matches, host_permissions, web_accessible).
// vasysit.com = SIT environment (live since 27/07/2026).
const VASY_HOSTS   = ['vasyerp.com', 'vasyerp.in', 'vasysit.com', 'vasy.ai'];
const VASY_HOST_RE = new RegExp(VASY_HOSTS.map(h => h.replace(/\./g, '\\.')).join('|'), 'i');

// Button/field regexes below are the REAL labels captured from expo.vasyerp.com.
const SIMPLE_MASTERS = {
    UnitOfMeasurement: { title:'Unit of Measurement', newRe:'add\\s*uom|new\\s*unit|add\\s*unit|new', nameRe:'^name|unit\\s*name', extra:null,
                         fields:[ {re:'unit\\s*code', key:'code'}, {re:'uqc', key:'uqc'}, {re:'decimal', key:'decimals'} ] },
    Tax:               { title:'Tax',                 newRe:'new\\s*tax|add\\s*tax|new',          nameRe:'tax\\s*name|name',     extra:'percent|rate|value' },
    Prefix:            { title:'Prefix',              newRe:'new\\s*prefix|add\\s*prefix|new',    nameRe:'prefix|name',          extra:null },
    PaymentTerms:      { title:'Payment Term',        newRe:'new\\s*(payment\\s*)?term|add|new',  nameRe:'term|name',            extra:'days|due' },
    AdditionalCharges: { title:'Additional Charge',   newRe:'new\\s*charge|add\\s*charge|new',    nameRe:'charge|name',          extra:'amount|value|percent' },
    ConsumptionType:   { title:'Consumption Type',    newRe:'add\\s*consumption|new\\s*(consumption\\s*)?type|new',
                         nameRe:'consumption\\s*type\\s*name|type\\s*name|name',                                                extra:null },
    CustomerCategory:  { title:'Customer Category',   newRe:'add\\s*customer\\s*categor|new\\s*categor|add\\s*categor|new',
                         nameRe:'customer\\s*categor|categor|name',                                                             extra:null,
                         tab:'customer\\s*categor' },
    AccountGroup:      { title:'Account Group',       newRe:'new\\s*(account\\s*)?group|add\\s*group|new', nameRe:'group|name',  extra:null },
    Account:           { title:'Account',             newRe:'new\\s*account|add\\s*account|new',  nameRe:'account\\s*name|name', extra:'opening|balance' },
    // Terms pages: the field is a 150-char "Term & condition *" textarea
    PurchaseTerms:     { title:'Purchase Term',       newRe:'add\\s*term|new\\s*term|new',        nameRe:'term\\s*&|term\\s*and|condition|term|name', extra:null },
    SalesTerms:        { title:'Sales Term',          newRe:'add\\s*terms|add\\s*term|new\\s*term|new', nameRe:'term\\s*&|term\\s*and|condition|term|name', extra:null },
    // Bank = "New account" button, then a multi-field form
    Bank:              { title:'Bank Account',        newRe:'new\\s*account|add\\s*bank|new\\s*bank|new', nameRe:'bank\\s*name', extra:null,
                         fields:[ {re:'account\\s*group', key:'accountGroup'}, {re:'branch\\s*name', key:'branchName'},
                                  {re:'account\\s*no', key:'accountNo'},       {re:'ifsc', key:'ifsc'},
                                  {re:'account\\s*holder', key:'holder'},      {re:'swift', key:'swift'},
                                  {re:'opening\\s*credit', key:'openingCredit'},{re:'opening\\s*debit', key:'openingDebit'} ] },
    // Department moved onto /item-masters with Category and Brand in v9.13.0 and
    // is created by createItemMaster; listing it here sent it to the old
    // one-page handler, which asked for the name all over again.
};

// ── SETTINGS CATALOGUE — captured from the live expo settings pages ──────────
// ty: t=toggle  d=dropdown  n=number  x=text
// Gives the agent exact page routing (no keyword guessing), lets it reject
// "enable <a numeric setting>" style mistakes, and lets it answer
// "what settings are there for barcodes?" with zero network calls.
const SETTINGS_INDEX = [];
(function buildSettingsIndex() {
    const add = (page, group, items) => items.forEach(([n, ty]) => SETTINGS_INDEX.push({ n, ty, page, group }));

    add('/setting/inventory', 'Defaults & Identity', [
        ['Default category','d'], ['Default brand','d'], ['Default tax','d'], ['Default unit of measure','d'],
        ['Purchase tax including','t'], ['Sales tax including','t'], ['Garment-slab tax','t'],
        ['HSN Type-wise Calculation','t'], ['HSN Type-wise Calculation Method','d'],
        ['Allow Duplication Product Names','t'], ['Multi Barcode','t'], ['Expiry','t'],
        ['Duplicate Barcode','t'], ['Bill Restriction and Warning','t'], ['Enable Multi Unit','t'],
    ]);
    add('/setting/inventory', 'Pricing & Margins', [
        ['Selling Margin %','n'], ['Enable B2B Pricing','t'], ['Retailer Margin %','n'], ['Wholesaler Margin %','n'],
        ['Allow Product Cost < Landing Cost on POS','t'], ['Membership','t'], ['Show Profit as per Costing','d'],
        ['Stock Transfer Branch','d'], ['Batch Discount On','d'], ['Stock Transfer Franchise','d'],
        ['Batch Price Tolerance','n'],
    ]);
    add('/setting/inventory', 'Stock & Movement', [
        ['Add Quantity Through','d'], ['Allow Negative Stock','t'],
        ['Manage Minimum Stock & PO Quantity','t'], ['Allow Product Delete if Stock Available','t'],
        // V9.14.0 (verified 22/10/2026): FIFO | LIFO tiles, plus First-Expired-First-Out
        ['Stock Selection Method','c'], ['Enable FEFO','t'],
    ]);
    add('/setting/inventory', 'Barcodes & Labels', [
        ['Auto Generate Barcode','t'], ['Barcode Prefix','x'], ['Barcode Series','x'], ['Barcode Length','d'],
        ['Manufacturing Date (MFG)','x'], ['Expiry Date Label','x'], ['Barcode Selling Price Label','x'],
    ]);
    add('/setting/inventory', 'Production & Unit Conversions', [
        ['Enable Product Types','t'], ['Recipe Product Search Type','t'], ['Raw Product Mapping','t'],
        ['Raw Stock Deduction','d'], ['Sell Raw Products','t'], ['Sell Semi Finished Products','t'],
        ['Sell Packaging Products','t'],
    ]);
    add('/setting/inventory', 'B2B Catalog', [ ['Allow B2B','t'] ]);

    add('/setting/purchase', 'Purchase Flow & Approvals', [
        ['File attachment mandatory','t'], ['Supplier-wise product mapping','t'],
        ['Block on credit limit exceeded','t'], ['Allow purchase order approval','t'],
        ['Merge same item on entry','t'], ['Enable OCR','t'], ['Default focus when entering a line','d'],
    ]);

    add('/setting/sales', 'Credit & Customers', [
        ['Customer-wise product mapping','t'], ['Customer-type wise calculation','t'],
    ]);
    add('/setting/sales', 'Billing & Workflow', [
        ['Allow sales new line','t'], ['Allow expense approval','t'],
        ['B2B sales — stock-out through','d'], ['Sales default focus on','d'],
        // V9.14.0 (verified 22/10/2026)
        ['Split Invoice and Bill of Supply Based on Tax Rate','t'],
    ]);
    add('/setting/sales', 'Discount Limits', [
        ['Flat discount limit — percentage (%)','n'], ['Flat discount limit — amount','n'],
    ]);

    add('/setting/pos', 'Billing & Workflow', [
        ['Start POS with','d'], ['Voice message after billing','t'], ['Voice message text','x'],
        ['Sales person','t'], ['Quantity column','t'], ['MRP column','t'], ['Tax amount','t'],
        ['Order type','t'], ['Customer details mandatory','t'],
        ['Enable online order confirmation flow','t'], ['Select tender type','d'], ['Enable image base POS','t'],
    ]);
    add('/setting/pos', 'Discounts & Pricing', [
        ['Allow user to change discount','t'], ['Allow user to change MRP','t'], ['Additional charge','t'],
        ['Additional discount','t'], ['Show Additional Discount','d'], ['Flat discount','t'],
        ['Bill discount','t'], ['Apply Coupon','t'], ['BXGY-Free product set','d'], ['Round off','t'],
        ['Coupon Show','t'], ['Flat discount limit (%)','n'], ['Flat discount limit (amount)','n'],
    ]);
    add('/setting/pos', 'Payment Methods', [
        ['Cash','t'], ['Card','t'], ['UPI','t'], ['MultiPay','t'], ['Pay Later','t'],
        ['Add Payment','t'], ['Credit Note','t'], ['Redeem Credit','t'], ['Redeem loyalty','t'],
    ]);
    add('/setting/pos', 'Receipts & Print', [
        ['Card & Print','t'], ['Cash & Print','t'], ['UPI & Print','t'], ['Hold & Print','t'],
        ['Hold Bill','t'], ['Last bill','t'], ['Allow Token Print','t'],
        ['Token Print MultiTime','d'], ['Tender Model on Cash & Print','t'],
    ]);
    add('/setting/pos', 'Returns & Exchange', [ ['Allow User to Accept Exchange of Product','t'] ]);
    add('/setting/pos', 'Display Columns', [
        ['Item Code','t'], ['Customer Details','t'], ['Orders','t'], ['View all terminal / user orders','t'],
        ['Show landing price in product details popup','t'], ['Customer Facing Display','t'],
    ]);
    add('/setting/pos', 'Security & OTP', [
        ['OTP verification on pay later','t'], ['OTP on credit note redemption','t'], ['OTP on advance payment','t'],
    ]);
    add('/setting/pos', 'Cash Drawer', [
        ['Show total cash left in drawer','t'], ['Allow manager cash flow','t'], ['Allow user for take money out','t'],
    ]);
    // Verified live 06/09/2026 — this page was never catalogued before, so these
    // three used to fall through to keyword guessing.
    add('/setting/general', 'General', [
        ['Enable Feedback Module','t'], ['Allow Roundoff','t'], ['Decimal Point','n'],
    ]);
    // Notifications is a MATRIX, not a list of switches: each event has its own
    // WhatsApp / SMS / Email column, so a name alone can't identify one control.
    // Catalogued as 'm' so the agent asks which channel instead of toggling blind.
    add('/setting/notifications', 'Notification Events', [
        ['E-Way Bill Close','m'], ['New Estimate','m'], ['Edit Estimate','m'],
        ['New Sales Order','m'], ['Edit Sales Order','m'], ['New Invoice','m'],
        ['Edit Invoice','m'], ['Delete Invoice','m'], ['Register Open','m'],
        ['Register Close','m'], ['New Delivery Challan','m'], ['Edit Delivery Challan','m'],
    ]);
})();
const NOTIFY_CHANNELS = ['WhatsApp', 'SMS', 'Email'];

// Required fields per entity — module scope so BOTH the conversational filler and
// the mid-flow AI-failure fallback can use the same truth.
const REQ_FIELDS = {
    // A product needs a cost, not just a shelf price: VasyERP derives MRP,
    // selling price and every other tier from the purchase price via margin, and
    // silently refuses the save when the derived tiers land under landing cost.
    // Asking one extra question beats a form that greys its own Save button out.
    Product:         ['productName','purchasePrice','price','category','unit'],
    // v9.13.0: a category now rolls up into a department, and the redesigned
    // dialog silently refuses Create without one.
    Category:        ['categoryName','department'],
    Coupon:          ['couponName','price'],
    BankTransaction: ['fromAccount','toAccount','amount'],
    Expense:         ['amount','partyName','account','tax'],
    Employee:        ['firstName','mobile'],
    PurchaseOrder:   ['supplierName','itemName','qty'],
    SalesOrder:      ['customerName','itemName','qty'],
    SalesInvoice:    ['customerName','itemName','qty'],
    MaterialInward:  ['supplierName'],
    SupplierBill:    ['supplierName'],
    Payment:         ['partyName','amount','paymentMode'],
    Receipt:         ['partyName','amount','paymentMode'],
    POSSale:         ['itemName','qty','paymentMode'],
    StockAdjust:     ['itemName','qty','adjustType'],
    UserRole:        ['roleName'],
    // Bank name*, Branch name* and Account no.* are all compulsory on the form
    Bank:            ['name','branchName','accountNo'],
    // V9.14.0 production run: pick a recipe; batches default to 1
    BillOfMaterials: ['recipeName'],
};
const FIELD_LABEL = {
    firstName:'name', mobile:'mobile number', role:'role', roleName:'role name',
    partyName:'party (who you paid)', account:'account / ledger', amount:'amount',
    qty:'quantity', paymentMode:'payment mode (Cash / UPI / Card)', itemName:'product',
    customerName:'customer', supplierName:'supplier', couponName:'coupon name',
    price:'price', fromAccount:'from account', toAccount:'to account',
    adjustType:'increase or decrease', password:'login password',
};
// An employee is saveable with just name + mobile. Role is optional — but it lives
// inside the login section on the redesigned page, so asking for one means asking
// for a password too. We never invent that password.
const empReady = f => !!(f && f.firstName && f.mobile && (!f.role || f.password));
// When an AI tier is unavailable MID-TASK, re-ask the missing field locally instead
// of surfacing a quota/no-key error. A half-finished task must never dead-end.
function midFlowReask(cs) {
    if (!cs || !cs.entity) return null;
    const need = (REQ_FIELDS[cs.entity] || []).find(k => !(cs.fields || {})[k]);
    return { entity: cs.entity, action: cs.action || 'create', fields: {},
        isReady: false, newTask: false, _source: 'local',
        botResponse: need
            ? `Sorry, I didn't catch that. What's the <b>${FIELD_LABEL[need] || need}</b>?`
            : `Sorry, I didn't catch that — could you say it another way?` };
}

function sNorm(x) { return String(x == null ? '' : x).toLowerCase().replace(/[^a-z0-9]/g, ''); }
function sFuzzy(a, b) {
    const na = sNorm(a), nb = sNorm(b);
    if (!na || !nb) return 0;
    if (na === nb) return 1;
    if (nb.startsWith(na) || na.startsWith(nb)) return 0.93;
    if (nb.includes(na) || na.includes(nb)) return 0.85;
    const big = s => { const m = {}; for (let i = 0; i < s.length - 1; i++) { const k = s.substr(i, 2); m[k] = (m[k]||0)+1; } return m; };
    const x = big(na), y = big(nb); let inter = 0, tx = 0, ty = 0;
    for (const k in x) { tx += x[k]; if (y[k]) inter += Math.min(x[k], y[k]); }
    for (const k in y) ty += y[k];
    return (2 * inter) / ((tx + ty) || 1);
}
// Best catalogue entry for a spoken setting name (null when nothing is close).
function findSetting(name) {
    let best = null, bestSc = 0, runnerSc = 0;
    for (const s of SETTINGS_INDEX) {
        const sc = sFuzzy(name, s.n);
        if (sc > bestSc) { runnerSc = bestSc; bestSc = sc; best = s; }
        else if (sc > runnerSc) runnerSc = sc;
    }
    if (bestSc < 0.62) return null;
    return { ...best, score: bestSc, ambiguous: (bestSc - runnerSc) < 0.05 && bestSc < 0.95 };
}

// Chrome just started: begin loading the on-device model now (≈1 min cold, once), so
// the first unfamiliar wording of the day isn't the one that waits for it.
if (chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(() => { setTimeout(() => { try { aiWarmIfRoomy(); } catch (e) {} }, 15000); });

chrome.runtime.onInstalled.addListener(() => {
    console.log('[Vasy AI Agent] installed.');
    // v17 has no AI service: forget a Gemini key and the phrases earlier versions
    // learned from Gemini answers, so neither lingers in the browser's storage.
    try { chrome.storage.local.remove(['geminiApiKey', 'vasyPhrases']); } catch (e) {}
    // Warm Chrome's on-device language models so the FIRST non-English command
    // doesn't pay the download wait. Entirely best-effort and silent.
    try {
        if (typeof LanguageDetector !== 'undefined') {
            LanguageDetector.availability()
                .then(a => { if (a === 'downloadable') return LanguageDetector.create(); })
                .catch(() => {});
        }
    } catch (e) {}
});

// ── Flight log — the last 150 steps the worker took, with times ───────────────
// A task that "just hangs" leaves no error anywhere; this says where it stopped
// (parse, navigation, injection, the page's ack) and whether the worker itself was
// blocked. Kept in storage.session so it survives the worker being stopped.
// Read it with chrome.runtime.sendMessage({ action: 'flight_log' }).
const _flight = [];
let _flightTimer = null;
function fl(...a) {
    _flight.push(new Date().toISOString().slice(11, 23) + ' ' + a.join(' '));
    if (_flight.length > 150) _flight.splice(0, _flight.length - 150);
    if (!_flightTimer) _flightTimer = setTimeout(() => {
        _flightTimer = null;
        try { chrome.storage.session.set({ vasyFlight: _flight }); } catch (e) {}
    }, 500);
}
try { chrome.storage.session.get(['vasyFlight']).then(r => { if (r && Array.isArray(r.vasyFlight)) _flight.unshift(...r.vasyFlight.slice(-100)); }).catch(() => {}); } catch (e) {}
fl('worker started');
// A blocked event loop is the one stall nothing else would show
let _hbLast = Date.now();
setInterval(() => { const now = Date.now(), lag = now - _hbLast - 1000; if (lag > 1500) fl('worker was blocked', lag + 'ms'); _hbLast = now; }, 1000);

// A risky action is filled in but deliberately unsaved, waiting for "yes".
// (Policy: posts money / moves stock / changes tax-numbering config / approvals.)
// It is mirrored to storage.session: an MV3 worker is stopped after ~30 s idle,
// and a user who reads the summary for a minute used to say "yes" to a worker
// that had forgotten the question — the "yes" went to the AI and nothing saved.
let _pendingSave = null;
const PENDING_TTL = 10 * 60 * 1000;
const _pendingStore = (chrome.storage && chrome.storage.session) || null;
const _pendingReady = (async () => {
    try { if (_pendingStore) { const r = await _pendingStore.get('vasyPendingSave'); if (r && r.vasyPendingSave && !_pendingSave) _pendingSave = r.vasyPendingSave; } } catch (e) {}
})();
function setPendingSave(v) {
    _pendingSave = v || null;
    try { if (_pendingStore) (v ? _pendingStore.set({ vasyPendingSave: v }) : _pendingStore.remove('vasyPendingSave')); } catch (e) {}
}
function pendingLive() {
    if (_pendingSave && Date.now() - _pendingSave.time > PENDING_TTL) setPendingSave(null);
    return _pendingSave;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    // ── Vasy Console (console.html) ─────────────────────────────────────────
    if (msg.action === 'open_console')      { openConsole().then(() => sendResponse({ ok: true })).catch(e => sendResponse({ ok: false, error: e.message })); return true; }
    if (msg.action === 'console_status')    { consoleStatus().then(sendResponse); return true; }
    if (msg.action === 'console_command')   { consoleCommand(msg.text).then(sendResponse); return true; }
    if (msg.action === 'console_focus_erp') { consoleErpTab(false).then(async t => { if (t) { await chrome.tabs.update(t.id, { active: true }); await chrome.windows.update(t.windowId, { focused: true }); } sendResponse({ ok: !!t }); }); return true; }
    if (msg.action === 'console_open_erp')  { consoleErpTab(true).then(t => sendResponse({ ok: !!t })); return true; }
    if (msg.action === 'console_tile')      { consoleTile(sender.tab && sender.tab.windowId, msg.screen).then(sendResponse); return true; }
    if (msg.action === 'bubble_echo') return;   // for the console page, not for us

    // content_agent held a risky save back and is waiting for confirmation
    if (msg.action === 'pending_save') {
        setPendingSave({ task: msg.task, url: msg.url, tabId: sender.tab?.id, time: Date.now() });
        return;
    }

    // Parse a command — async, must return true to keep channel open
    if (msg.action === 'parse_intent') {
        const tabId = sender.tab?.id, pt0 = Date.now();
        fl('parse', JSON.stringify(String(msg.text || '').slice(0, 50)));
        _pendingReady.then(() => parseCommand(msg.text, msg.conversationState, msg.currentPage, { tabId, noDashQA: !!msg.noDashQA }))
            .then(intent => {
                fl('parsed', (intent && intent.entity) || '-', (intent && intent._source) || '', (Date.now() - pt0) + 'ms');
                try { rememberParse(tabId, msg.text, intent); } catch (e) {}
                // Track mid-task state so it can be healed if the bubble loses it
                try {
                    if (intent && intent.entity && !intent.isReady && intent.action !== 'out_of_scope' && intent.action !== 'chat') {
                        const base = (!intent.newTask && msg.conversationState) ? msg.conversationState : { fields: {} };
                        _lastCs = { state: { entity: intent.entity, action: intent.action || base.action,
                                             fields: { ...(base.fields || {}), ...(intent.fields || {}) } }, time: Date.now() };
                    } else if (intent && intent.isReady) {
                        _lastCs = { state: null, time: 0 };   // task dispatched — nothing to heal
                    }
                } catch (e) {}
                sendResponse({ intent });
            })
            .catch(err  => { fl('parse failed', err.message); sendResponse({ error: err.message }); });
        return true;
    }

    // Dispatch a task: navigate to the right URL then inject content_agent.js
    if (msg.action === 'dispatch') {
        const dispatchTabId = sender.tab?.id;
        fl('dispatch', msg.entity || '-', msg.taskAction || '');
        handleDispatch(msg, dispatchTabId).catch(err => {
            fl('dispatch failed', err.message);
            if (dispatchTabId) {
                chrome.tabs.sendMessage(dispatchTabId, {
                    action: 'agent_result', status: 'error',
                    message: 'Navigation error: ' + (err.message || 'Unknown error. Please try again.')
                }).catch(() => {});
            }
        });
    }

    // Navigate to a specific URL then inject a script (used by edit flow)
    if (msg.action === 'inject_on_navigate') {
        handleInjectOnNavigate(msg, sender.tab?.id);
    }

    // content_agent's "nothing came back" guard: is a page hand-off still under way?
    if (msg.action === 'nav_pending') {
        const t = sender.tab && _navBusy.get(sender.tab.id);
        sendResponse({ pending: !!(t && Date.now() - t < 30000) });
        return true;
    }

    // A document's print view / PDF, opened beside the ERP tab
    if (msg.action === 'open_print') {
        openPrintTab(msg, sender.tab).then(sendResponse).catch(e => sendResponse({ ok: false, error: e.message }));
        return true;
    }

    // Forward agent_result from content_agent back to the bubble on the same tab
    if (msg.action === 'agent_result') {
        if (sender.tab?.id) {
            // Cancel backup success detection — content_agent.js got there first
            chrome.storage.local.remove('pendingDispatch');
            try { learnOutcome(sender.tab.id, msg.status, msg); } catch (e) {}
            chrome.tabs.sendMessage(sender.tab.id, msg).catch(() => {});
        }
    }

    // ── On-device AI + learning: status for the popup / bubble settings ──────
    if (msg.action === 'ai_status') {
        (async () => { await _learnReady;
            sendResponse({ ai: await aiAvailability(), off: await aiOff(), warm: !!_aiBase, learned: learnedCount(),
                           mem: await memInfo(), keepsWarm: await aiRoomy() }); })();
        return true;
    }
    if (msg.action === 'ai_warm') { aiWarmIfRoomy(); return; }     // the chat box opened — get the model ready (if there's room)
    if (msg.action === 'flight_log') { sendResponse({ log: _flight.slice() }); return true; }
    if (msg.action === 'ai_set') {                                 // { off: bool } — the user's on/off switch
        chrome.storage.local.set({ vasyAIOff: !!msg.off }).then(() => {
            if (msg.off && _aiBase) { try { _aiBase.destroy(); } catch (e) {} _aiBase = null; }
            _aiState = { v: 'unknown', t: 0 };
            sendResponse({ ok: true });
        });
        return true;
    }
    // Both wait for the stored memory to load: on a freshly woken worker, editing the
    // empty placeholder would save over everything learned (or the load would undo a forget).
    if (msg.action === 'learn_forget') {
        (async () => { await _learnReady;
            _learn = { phrases: {}, examples: [] }; _nluIndex = null; saveLearn();
            _learnPending.clear(); _learnOrigin.clear();
            sendResponse({ ok: true, learned: learnedCount() });
        })();
        return true;
    }
    // What Vasy learned, newest first — for the popup's list (and removing one wording)
    if (msg.action === 'learn_list') {
        (async () => { await _learnReady;
            const items = (_learn.examples || []).slice().sort((a, b) => (b.t || 0) - (a.t || 0)).slice(0, 60)
                .map(x => ({ u: x.u, task: nluHuman(x.e), replay: !!(_learn.phrases || {})[x.u] }));
            sendResponse({ items });
        })();
        return true;
    }
    if (msg.action === 'learn_remove') {
        (async () => { await _learnReady;
            const k = String(msg.u || '');
            _learn.examples = (_learn.examples || []).filter(x => x.u !== k);
            if (_learn.phrases) delete _learn.phrases[k];
            _nluIndex = null; saveLearn();
            sendResponse({ ok: true, learned: learnedCount() });
        })();
        return true;
    }
});

const docRefFromTitle = t => {
    const head = String(t || '').split('|')[0].trim();
    return /^[A-Z][A-Z0-9\/\-]*\d[A-Z0-9\/\-]*$/i.test(head) && head.length <= 24 ? head : null;
};
// ── Backup success detection via page navigation ──────────────────────────────
// When VasyERP does a full page reload after save, content_agent.js's watchResult
// dies. This listener detects the resulting URL change and sends a success message.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url) return;
    try {
        const path = new URL(tab.url).pathname;
        // Ignore navigation to form pages (no save happened yet)
        if (path.endsWith('/new') || /\/edit\/|\/\d+\/edit/.test(path)) return;
        const stored = await chrome.storage.local.get(['pendingDispatch', 'awaitingResult']);
        if (!stored.awaitingResult) return; // no active task
        const pd = stored.pendingDispatch;
        if (!pd || pd.tabId !== tabId) return;
        if (Date.now() - pd.time > 120000) { chrome.storage.local.remove('pendingDispatch'); return; }
        // Check if new URL is on the expected list/view page for this entity
        if (!path.startsWith(pd.listPath.replace(/\/$/, ''))) return;
        chrome.storage.local.remove('pendingDispatch');
        // A contact saved as the wrong TYPE lands on the right list root
        // (/contact/…) but the wrong branch. That is not a success: a supplier
        // saved as a customer never appears on a purchase order.
        if (pd.expectPath && !path.startsWith(pd.expectPath)) {
            const got = (path.match(/\/contact\/(\w+)/) || [])[1] || 'another type';
            chrome.tabs.sendMessage(tabId, { action: 'agent_result', status: 'error',
                title: 'Saved as the wrong type',
                message: `The contact was saved, but under <b>${got}</b> instead of <b>${pd.expectPath.split('/')[2]}</b>. ` +
                         `Open it and change its type, or it won't appear where you need it.` }).catch(() => {});
            return;
        }
        setTimeout(async () => {
            // Name the document that was just created. A chained next step
            // ("…then receive it") needs THAT document, not whichever open one
            // happens to be first — the saved record's own page carries its
            // number in the tab title.
            let docRef = null;
            try { const t = await chrome.tabs.get(tabId); docRef = docRefFromTitle(t.title); } catch (e) {}
            // A warning VasyERP raised on the form (e.g. uncleared bills) must not
            // vanish just because the save navigated away from it.
            let note = null;
            try { note = (await chrome.storage.local.get(['vasyPendingNote'])).vasyPendingNote || null;
                  chrome.storage.local.remove('vasyPendingNote'); } catch (e) {}
            try { learnOutcome(tabId, 'success'); } catch (e) {}
            chrome.tabs.sendMessage(tabId, {
                action: 'agent_result', status: 'success',
                // a confirmed delete/deactivate that reloads the list is not a "save"
                title: /^(Delete|Deactivate)$/.test(pd.entity) ? `Record ${pd.entity === 'Delete' ? 'deleted' : 'deactivated'}`
                     : pd.kind === 'edit' ? `${pd.entity} updated`
                     : docRef ? `${pd.entity} ${docRef} saved` : `${pd.entity} Saved`,
                message: (/^(Delete|Deactivate)$/.test(pd.entity) ? 'VasyERP confirmed it and reloaded the list.'
                     : pd.kind === 'edit' ? 'VasyERP saved your change.'
                     : docRef ? `Created <b>${docRef}</b>.` : 'Record created successfully.') +
                         (note ? `<br><small>⚠️ ${note}</small>` : ''),
                docRef, docUrl: tab.url,
            }).catch(() => {});
        }, 2000);
    } catch {}
});

// ── Vasy Console: a command window that drives the ERP tab ──────────────────
// The console never parses anything itself. It hands text to the bubble in the
// ERP tab, which runs it exactly as if typed there, and the bubble echoes its
// messages back. So the console behaves identically, follow-ups included.
const ERP_URLS = ['*://*.vasyerp.com/*', '*://*.vasyerp.in/*', '*://*.vasysit.com/*', '*://*.vasy.ai/*'];
const isErpUrl = u => /^https?:\/\/([^/]+\.)?(vasyerp\.com|vasyerp\.in|vasysit\.com|vasy\.ai)\//i.test(u || '');
async function consoleErpTab(create) {
    const st = await chrome.storage.local.get(['vasyConsoleTab', 'vasyErpOrigin']);
    if (st.vasyConsoleTab) {
        try { const t = await chrome.tabs.get(st.vasyConsoleTab); if (isErpUrl(t.url)) return t; } catch (e) {}
    }
    const tabs = (await chrome.tabs.query({ url: ERP_URLS })).filter(t => isErpUrl(t.url) && !/landing\.html/.test(t.url));
    tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
    if (tabs[0]) { await chrome.storage.local.set({ vasyConsoleTab: tabs[0].id }); return tabs[0]; }
    if (!create || !st.vasyErpOrigin) return null;
    const wins = await chrome.windows.getAll({ windowTypes: ['normal'] });
    const t = wins.length ? await chrome.tabs.create({ windowId: wins[0].id, url: st.vasyErpOrigin + '/dashboard', active: true })
                          : (await chrome.windows.create({ url: st.vasyErpOrigin + '/dashboard', type: 'normal' })).tabs[0];
    await chrome.storage.local.set({ vasyConsoleTab: t.id });
    return t;
}
async function pingBubble(tabId) {
    try { return await chrome.tabs.sendMessage(tabId, { action: 'console_ping' }); } catch (e) { return null; }
}
async function consoleStatus() {
    const t = await consoleErpTab(false);
    if (!t) return { ok: false };
    const p = await pingBubble(t.id);
    // Chrome throttles a tab that isn't the front tab of its window (timers fire
    // about once a minute), which makes every step crawl — tell the console.
    let minimized = false;
    try { minimized = (await chrome.windows.get(t.windowId)).state === 'minimized'; } catch (e) {}
    return { ok: true, tabId: t.id, windowId: t.windowId, url: t.url, title: t.title, active: !!t.active, minimized,
             module: p && p.module, busy: !!(p && p.busy), ready: !!p, loggedOut: /\/login/i.test(t.url || '') };
}
async function consoleCommand(text) {
    const t = await consoleErpTab(false);
    if (!t) return { ok: false, error: 'No VasyERP tab is open. Open VasyERP and sign in first.' };
    if (/\/login/i.test(t.url || '')) return { ok: false, error: 'The VasyERP tab is on the sign-in page. Sign in there, then send the command again.' };
    // A background tab or a minimized window has its timers throttled (after a few
    // minutes, to about one a minute), so every step of the task would crawl. The
    // user just asked the ERP to act: make its tab the visible one, without taking
    // keyboard focus away from the console.
    try {
        if (!t.active) await chrome.tabs.update(t.id, { active: true });
        const w = await chrome.windows.get(t.windowId);
        if (w.state === 'minimized') await chrome.windows.update(t.windowId, { state: 'normal' });
    } catch (e) {}
    // The tab may be mid-navigation from the previous step: wait for its bubble.
    for (let i = 0; i < 20; i++) {
        try {
            const r = await chrome.tabs.sendMessage(t.id, { action: 'console_command', text });
            if (r) return r;
        } catch (e) {}
        await new Promise(res => setTimeout(res, 750));
    }
    return { ok: false, error: "The VasyERP tab didn't answer. If it's still loading, wait a moment and send it again." };
}
async function openConsole() {
    const url = chrome.runtime.getURL('console.html');
    const st = await chrome.storage.local.get(['vasyConsoleWin']);
    if (st.vasyConsoleWin) {
        try { await chrome.windows.update(st.vasyConsoleWin, { focused: true }); return; } catch (e) {}
    }
    // Open next to the window the user is in, and give the ERP the rest.
    let cur = null;
    try { cur = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }); } catch (e) {}
    const W = 460;
    const opts = { url, type: 'popup', width: W, height: cur ? cur.height : 820 };
    if (cur) { opts.left = cur.left; opts.top = cur.top; }
    const w = await chrome.windows.create(opts);
    await chrome.storage.local.set({ vasyConsoleWin: w.id });
    if (cur && cur.state === 'normal' && cur.width > W + 640) {
        try { await chrome.windows.update(cur.id, { left: cur.left + W, width: cur.width - W }); } catch (e) {}
    }
}
async function consoleTile(consoleWin, scr) {
    const t = await consoleErpTab(false);
    if (!t || !consoleWin || !scr) return { ok: false };
    const W = Math.min(480, Math.round(scr.w * 0.32));
    try {
        await chrome.windows.update(consoleWin, { state: 'normal', left: scr.left, top: scr.top, width: W, height: scr.h });
        await chrome.windows.update(t.windowId, { state: 'normal', left: scr.left + W, top: scr.top, width: scr.w - W, height: scr.h });
        await chrome.tabs.update(t.id, { active: true });
        return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
}
if (chrome.windows && chrome.windows.onRemoved) chrome.windows.onRemoved.addListener(async id => {
    const st = await chrome.storage.local.get(['vasyConsoleWin']);
    if (st.vasyConsoleWin === id) chrome.storage.local.remove('vasyConsoleWin');
});
if (chrome.commands && chrome.commands.onCommand) {
    chrome.commands.onCommand.addListener(cmd => { if (cmd === 'open-console') openConsole(); });
}

// Map URL paths to entity + available actions — built once, not per-call
const PAGE_CONTEXT_MAP = {
        '/contact':                   { entity:'Contact',              actions:'create,search,edit,delete,list',          hint:'Contact list — customer/supplier management' },
        '/employee':                  { entity:'Employee',             actions:'create,search,edit,delete,list',          hint:'Employee list — staff management' },
        '/product':                   { entity:'Product',              actions:'create,search,edit,delete,list',          hint:'Product catalogue' },
        '/product/setup-opening-stock':{ entity:'OpeningStock',        actions:'create',                                  hint:'Opening stock setup — set initial inventory quantities' },
        '/product/stock':             { entity:'StockAdjust',          actions:'create',                                  hint:'Stock adjustment — increase or decrease stock' },
        '/purchase/order':            { entity:'PurchaseOrder',        actions:'create,search,edit,delete,list',          hint:'Purchase orders page' },
        '/purchase/materialinward':   { entity:'MaterialInward',       actions:'create,search,edit,list',                 hint:'Material inward / goods receipt page' },
        '/purchase/bill':             { entity:'SupplierBill',         actions:'create,search,edit,list',                 hint:'Supplier bills / vendor invoice page' },
        '/purchase/debitnote':        { entity:'PurchaseReturn',       actions:'create,search,list',                      hint:'Purchase return / debit note page' },
        '/sales/order':               { entity:'SalesOrder',           actions:'create,search,edit,delete,list',          hint:'Sales orders page' },
        '/sales/invoice':             { entity:'SalesInvoice',         actions:'create,search,edit,list,generate',        hint:'Sales invoice page — can also generate E-Invoice or E-Way Bill' },
        '/sales/creditnote':          { entity:'SalesReturn',          actions:'create,search,list',                      hint:'Sales return / credit note page' },
        '/sales/estimate':            { entity:'SalesEstimate',        actions:'create,search,edit,list',                 hint:'Sales estimate / quotation page' },
        '/sales/deliverychallan':     { entity:'DeliveryChallan',      actions:'create,search,edit,list,generate',        hint:'Delivery challan page — can also generate E-Way Bill' },
        '/payment':                   { entity:'Payment',              actions:'create,search,list',                      hint:'Outward payment page — payments to suppliers' },
        '/receipt':                   { entity:'Receipt',              actions:'create,search,list',                      hint:'Inward receipt page — receipts from customers' },
        '/expense':                   { entity:'Expense',              actions:'create,search,list',                      hint:'Expense recording page' },
        '/manager/internaltransfer':  { entity:'InternalTransfer',     actions:'create,search,list',                      hint:'Internal cash/bank transfer page' },
        '/journalvoucher':            { entity:'JournalVoucher',       actions:'create,search,list',                      hint:'Journal voucher page' },
        '/stocktransfer':             { entity:'StockTransfer',        actions:'create,search,list',                      hint:'Inter-branch stock transfer page' },
        '/stocktransferrequest':      { entity:'StockTransferRequest', actions:'create,search,list',                      hint:'Stock transfer request page' },
        '/materialconsumption':       { entity:'MaterialConsumption',  actions:'create,list',                             hint:'Material consumption / production page' },
        '/materialcreation':          { entity:'MaterialCreation',     actions:'create,list',                             hint:'Material creation (finished goods) page' },
        '/billofmaterials':           { entity:'BillOfMaterials',      actions:'create,list',                             hint:'Bill of materials / recipe master page' },
        '/recipe':                    { entity:'Recipe',               actions:'create,list',                             hint:'Recipe management page' },
        '/inventorytracking':         { entity:'StockVerification',    actions:'create,list',                             hint:'Stock verification / physical count page' },
        '/pos':                       { entity:'POSSale',              actions:'create,list',                             hint:'POS terminal — point of sale, walk-in customers' },
        '/report/pos':                { entity:'POSOrders',            actions:'list',                                    hint:'POS order list — every counter bill, searchable' },
        // Verified live: loyalty moved OUT of /crm, and the page is a Campaign list
        // + a "Point Setup" tab (Amount = Point earn rate). There is no per-customer
        // points table here, so 'adjust' was never a real action.
        '/loyalty':                   { entity:'Loyalty',              actions:'earnrate,list',                           hint:'Loyalty campaigns + Point Setup (how many points per rupee spent)' },
        '/crm/feedback':              { entity:'Feedback',             actions:'search,list',                             hint:'Customer feedback / CRM leads page' },
        '/coupon':                    { entity:'Coupon',               actions:'create,list',                             hint:'Coupon master page' },
        '/discount':                  { entity:'Discount',             actions:'create,list',                             hint:'Discount master page' },
        '/membershipmaster':          { entity:'Membership',           actions:'create,list',                             hint:'Membership plan master page' },
        '/branch':                    { entity:'Branch',               actions:'create,list',                             hint:'Branch / outlet management page' },
        '/item-masters':              { entity:'Category',             actions:'create,list',                             hint:'Item masters — Department / Category / Brand tabs on one page, each with its own New button' },
        '/categorybrand':             { entity:'Category',             actions:'create,list',                             hint:'Category and brand master page' },
        '/department':                { entity:'Department',           actions:'create,list',                             hint:'Department master page' },
        '/report':                    { entity:'Report',               actions:'fetch',                                   hint:'Reports hub — all sales, purchase, inventory, finance and GST reports' },
        // Real route carries a hyphen — the old key never matched, so page context
        // never fired here.
        '/bank-reconciliation':       { entity:'BankReconciliation',   actions:'view,list',                               hint:'Bank Reconciliation — per-account Bank vs Ledger balance; reconciling needs a statement import' },
        '/dashboard':                 { entity:null,                   actions:'any',                                     hint:'Dashboard Overview — KPI tiles (Total Sales, Total Invoice, Sold Qty, Customers, Sales/Purchase Return, Total Purchase, Bills, Suppliers, Paid, Expenses, Products, Stock Qty/Value, Cash in Hand, Avg Profit Margin, Avg Cart Value, Avg Bill No, Bank Accounts) and panels (Sales & Purchase Trend, Payment Mode Distribution, Receivables and Payables, Customer Insight segments, Sales Breakdown, Best/Least Selling, Top Expenses, Top Coupons). Questions about these are PageQA. User can also ask for any action.' },
        // ── v14.0: remaining modules ─────────────────────────────────────────
        '/users/user-roles':          { entity:'UserRole',             actions:'create,list',                             hint:'User roles — permission matrix per module' },
        '/unit-of-measurement':       { entity:'UnitOfMeasurement',    actions:'create,list',                             hint:'Unit of measurement master (Pcs, Box, Kg…)' },
        '/category-wise-variants':    { entity:'CategoryVariant',      actions:'create,list',                             hint:'Category-wise variant options master' },
        '/customer-category-pricing': { entity:'B2BPriceMapping',      actions:'create,list',                             hint:'B2B product price mapping — customer-specific pricing' },
        '/consumption-types':         { entity:'ConsumptionType',      actions:'create,list',                             hint:'Consumption type master (wastage, production…)' },
        '/purchase-terms':            { entity:'PurchaseTerms',        actions:'create,list',                             hint:'Purchase terms & conditions master' },
        '/sales-terms':               { entity:'SalesTerms',           actions:'create,list',                             hint:'Sales terms & conditions master' },
        '/customer-category':         { entity:'CustomerCategory',     actions:'create,list',                             hint:'Customer category master (wholesale, retail…)' },
        // Recon 06/09/2026: MUI tabs "All Products" / "Showing Products", one table
        // of PRODUCT NAME + a HIDE/SHOW checkbox per row, 149k products. Publishing
        // is deliberately NOT automated yet: the header checkbox is a select-all over
        // the page, and the product search could not be driven reliably — a wrong
        // click here changes a live storefront.
        '/ecommerce-catalog':         { entity:'EcommerceCatalog',     actions:'list',                                    hint:'eCommerce catalog — All Products vs Showing Products, each row has a Hide/Show toggle' },
        '/bank':                      { entity:'Bank',                 actions:'create,list',                             hint:'Bank account master' },
        '/banktransaction':           { entity:'BankTransaction',      actions:'create,list',                             hint:'Bank transactions — deposits, withdrawals, transfers' },
        '/owner/cashflow':            { entity:'OwnerCashFlow',        actions:'list',                                    hint:'Owner cash flow view' },
        '/manager/cashflow':          { entity:'ManagerCashFlow',      actions:'list',                                    hint:'Manager cash flow view' },
        '/pos/creditnote':            { entity:'POSCreditNote',        actions:'list',                                    hint:'POS credit notes — Credits Used / Credits Remaining per customer (read-only list)' },
        '/salesregister':             { entity:'SalesRegister',        actions:'list',                                    hint:'POS registers — open/close cash register sessions' },
        '/report/pos':                { entity:'POSOrders',            actions:'list',                                    hint:'POS orders list' },
        '/accountgroup':              { entity:'AccountGroup',         actions:'create,list',                             hint:'Account group master (chart of accounts grouping)' },
        '/account':                   { entity:'Account',              actions:'create,list',                             hint:'Account ledger master (chart of accounts)' },
        '/cr-dr-notes':               { entity:'AcctCreditNote',       actions:'create,list',                             hint:'ACCOUNTING credit / debit notes (journal-side) — one combined page with a New Note button; different from the purchase debit note and sales credit note documents' },
        '/drive':                     { entity:'Storage',              actions:'list',                                    hint:'File storage / documents' },
        '/barcodeutility':            { entity:'BarcodeLabels',        actions:'print,list',                              hint:'Barcode / label printing — queue products, pick print type (UPS/A4/A5) + template' },
        '/tally':                     { entity:'Tally',                actions:'list',                                    hint:'Export data to Tally' },
        '/prefix':                    { entity:'Prefix',               actions:'create,list',                             hint:'Document number prefix master' },
        '/tax':                       { entity:'Tax',                  actions:'create,list',                             hint:'Tax rate master (GST slabs)' },
        '/payment-terms':             { entity:'PaymentTerms',         actions:'create,list',                             hint:'Payment terms master (Net 30…)' },
        '/additional-charges':        { entity:'AdditionalCharges',    actions:'create,list',                             hint:'Additional charges master (freight, packing…)' },
        '/mac-binding':               { entity:'MacBinding',           actions:'list',                                    hint:'MAC address binding — device access control' },
        '/setting/notifications':     { entity:'Setting',              actions:'toggle',                                  hint:'Notification settings switches' },
        '/settingnew/integrations':   { entity:'Integrations',         actions:'list',                                    hint:'Apps & integrations page' },
        '/logs':                      { entity:'Logs',                 actions:'list',                                    hint:'Activity logs — who did what, when' },
        '/vina':                      { entity:'Vina',                 actions:'ask',                                     hint:'VinaAI — data-backed advisory chatbot (analysis and recommendations)' },
        '/bhi-config':                { entity:'BHIConfig',            actions:'list',                                    hint:'BHI Config — how each outlet’s Business Health Index is scored' },
        '/target-vs-actual':          { entity:'TargetVsActual',       actions:'list',                                    hint:'Target vs Actual — sales targets per period, global or per outlet' },
        '/combo-products':            { entity:'ComboProduct',         actions:'list',                                    hint:'Combo products — bundles, their price, savings and margin' },
        '/setting/pos':               { entity:'Setting',              actions:'toggle,check,set',                        hint:'POS settings — switch a POS option on or off, or check it' },
        '/setting/inventory':         { entity:'Setting',              actions:'toggle,check,set',                        hint:'Items settings — stock, batches (FIFO/LIFO, FEFO), barcodes, production' },
        '/setting/sales':             { entity:'Setting',              actions:'toggle,check,set',                        hint:'Sales settings — billing workflow, split invoice by tax rate, discount limits' },
        '/setting/purchase':          { entity:'Setting',              actions:'toggle,check,set',                        hint:'Purchase settings — approvals, attachments, OCR' },
        '/setting/general':           { entity:'Setting',              actions:'toggle,check,set',                        hint:'General settings / My Profile — round-off, decimals, feedback module' },
        '/changepassword':            { entity:null,                   actions:'navigate',                                hint:'Change Password — you type it; the agent never handles passwords' },
        '/chart-of-accounts':         { entity:'Account',              actions:'list',                                    hint:'Chart of Accounts — ledgers and groups; Import uploads accounts from Excel' },
};

// ── Module names for pure navigation (most specific first; full-match only) ──
// [entity, name pattern, action, extra fields, what to say]
const NAV_NAMES = [
    ['StockTransferRequest', /^(?:stock\s+)?transfer\s+requests?$/],
    ['StockTransfer',        /^(?:stock|branch)\s+transfers?$/],
    ['InternalTransfer',     /^internal\s+(?:cash\s+)?transfers?$/],
    ['BankTransaction',      /^(?:bank|cash)\s+(?:transactions?|transfers?)$|^bank\s*\/\s*cash\s+transfers?$/],
    ['BankReconciliation',   /^(?:bank\s+)?reconcil(?:iation|e)$|^bank\s+recon$/, 'view'],
    ['Bank',                 /^(?:banks?|bank\s+accounts?|bank\s+master)$/],
    ['UserRole',             /^(?:user\s+)?roles?$/],
    ['Contact',              /^(?:suppliers?|vendors?)$/, 'list', { contactType: 'Supplier' }],
    ['Contact',              /^transport(?:ers?)?$/, 'list', { contactType: 'Transport' }],
    ['Contact',              /^(?:customers?|clients?)$/, 'list', { contactType: 'Customer' }],
    ['Contact',              /^contacts?$/],
    ['Employee',             /^(?:employees?|staff|users?)$/],
    ['POSCreditNote',        /^pos\s+credit\s*notes?$/],
    ['POSOrders',            /^pos\s+(?:orders?|bills?)$/],
    ['AcctDebitNote',        /^(?:account(?:ing|s)?\s+debit\s+notes?|cr\s*[-\/&]?\s*dr\s+notes?|credit\s*[-\/&]\s*debit\s+notes?)$/],
    ['AcctCreditNote',       /^account(?:ing|s)?\s+credit\s+notes?$/],
    ['PurchaseReturn',       /^(?:debit\s+notes?|purchase\s+returns?)$/],
    ['SalesReturn',          /^(?:credit\s+notes?|sales\s+returns?)$/],
    ['PurchaseOrder',        /^(?:purchase\s+orders?|po)$/],
    ['MaterialInward',       /^(?:material\s+inwards?|grns?|goods\s+(?:receipts?|inwards?))$/],
    ['SupplierBill',         /^(?:(?:supplier|purchase|vendor)\s+bills?|bills?)$/],
    ['SalesOrder',           /^sales\s+orders?$/],
    ['SalesInvoice',         /^(?:sales\s+|tax\s+)?invoices?$/],
    ['SalesEstimate',        /^(?:estimates?|quotations?|quotes?|proforma(?:\s+invoices?)?)$/],
    ['DeliveryChallan',      /^(?:delivery\s+)?challans?$/],
    ['MaterialConsumption',  /^(?:material\s+)?consumptions?$/],
    ['MaterialCreation',     /^material\s+creations?$/],
    ['BillOfMaterials',      /^(?:bill\s+of\s+materials?|boms?|production(?:\s+runs?)?)$/],
    ['Recipe',               /^recipes?$/],
    ['JournalVoucher',       /^(?:journal\s+(?:vouchers?|entries|entry)|jvs?)$/],
    ['Payment',              /^(?:(?:supplier\s+)?payments?|payment\s+out)$/],
    ['Receipt',              /^(?:(?:customer\s+)?receipts?|payment\s+in)$/],
    ['Expense',              /^expenses?$/],
    ['Coupon',               /^coupons?$/],
    ['Membership',           /^memberships?(?:\s+plans?)?$/],
    ['Discount',             /^(?:discounts?|schemes?)$/],
    ['Branch',               /^(?:branch(?:es)?|outlets?|locations?)$/],
    ['Category',             /^(?:categor(?:y|ies)|item\s+masters?)$/],
    ['Brand',                /^brands?$/],
    ['Department',           /^departments?$/],
    ['StockVerification',    /^(?:stock\s+verifications?|physical\s+(?:stock|count)|stock\s+count)$/],
    ['Loyalty',              /^loyalty(?:\s+points)?$/],
    ['Feedback',             /^(?:customer\s+)?feedbacks?$/],
    ['CRMLead',              /^(?:crm|leads?|crm\s+leads?)$/],
    ['UnitOfMeasurement',    /^(?:units?(?:\s+of\s+measurements?)?|uoms?)$/],
    ['CategoryVariant',      /^(?:category\s*wise\s+variants?|variants?)$/],
    ['B2BPriceMapping',      /^(?:customer\s+category\s+pric(?:ing|es)|b2b\s+(?:price|pricing)(?:\s+mapping)?|category\s+pricing)$/],
    ['ConsumptionType',      /^consumption\s+types?$/],
    ['PurchaseTerms',        /^purchase\s+terms?$/],
    ['SalesTerms',           /^sales\s+terms?$/],
    ['EcommerceCatalog',     /^e-?commerce(?:\s+catalog(?:ue)?)?$/],
    ['OwnerCashFlow',        /^owner\s+cash\s*flow$/],
    ['ManagerCashFlow',      /^(?:manager\s+)?cash\s*flow$/],
    ['SalesRegister',        /^sales\s+register$/],
    ['AccountGroup',         /^account\s+groups?$/],
    ['Account',              /^(?:chart\s+of\s+accounts?|accounts?)$/],
    ['Storage',              /^(?:drive|storage|documents?)$/],
    ['BarcodeLabels',        /^(?:barcodes?(?:\s+utility)?|(?:barcode\s+)?labels?)$/],
    ['Prefix',               /^prefix(?:es)?$/],
    ['Tax',                  /^(?:tax(?:es)?(?:\s+master)?|gst\s+(?:rates?|slabs?))$/],
    ['PaymentTerms',         /^payment\s+terms?$/],
    ['AdditionalCharges',    /^additional\s+charges?$/],
    ['MacBinding',           /^mac\s+binding$/],
    ['Integrations',         /^(?:integrations?|apps?\s*(?:&|and)\s*integrations?)$/],
    ['Logs',                 /^(?:(?:activity|audit)\s+)?logs?$/, 'view'],
    ['BHIConfig',            /^(?:bhi\s+config(?:uration)?|configure\s+bhi|business\s+health\s+(?:config|settings?|setup))$/],
    ['TargetVsActual',       /^(?:targets?(?:\s+vs\.?\s+actuals?)?|sales\s+targets?|target\s+vs\.?\s+actual\s+page)$/],
    ['ComboProduct',         /^(?:combo(?:\s+products?)?s?|product\s+combos?|bundles?)$/],
    ['RawNav',               /^(?:pos\s+settings?|settings?\s+(?:for\s+)?pos)$/,                 'navigate', { path: '/setting/pos' }, 'POS settings'],
    ['RawNav',               /^(?:items?\s+settings?|inventory\s+settings?|stock\s+settings?)$/, 'navigate', { path: '/setting/inventory' }, 'Items settings'],
    ['RawNav',               /^(?:sales\s+settings?|invoice\s+settings?)$/,                      'navigate', { path: '/setting/sales' }, 'Sales settings'],
    ['RawNav',               /^purchase\s+settings?$/,                                            'navigate', { path: '/setting/purchase' }, 'Purchase settings'],
    ['RawNav',               /^(?:general\s+settings?|my\s+profile|profile)$/,                    'navigate', { path: '/setting/general' }, 'General settings'],
    ['RawNav',               /^change\s+password$/,                                               'navigate', { path: '/changepassword' }, 'Change Password — type the new password yourself; I never handle passwords'],
    ['Product',              /^(?:products?|items?|catalog(?:ue)?)$/],
    ['Setting',              /^settings?$/],
    [null,                   /^(?:dashboard|home)$/],
];
const NAV_LABEL = {
    POSCreditNote: 'POS credit notes', POSOrders: 'POS orders', B2BPriceMapping: 'customer category pricing',
    AcctDebitNote: 'accounting debit notes', AcctCreditNote: 'accounting credit notes', Account: 'the chart of accounts',
    Storage: 'Drive', Setting: 'settings', Logs: 'the activity logs', BankReconciliation: 'bank reconciliation',
    CategoryVariant: 'category-wise variants', OwnerCashFlow: 'owner cash flow', ManagerCashFlow: 'manager cash flow',
    Integrations: 'integrations', MacBinding: 'MAC binding', Loyalty: 'loyalty', CRMLead: 'CRM leads',
    StockVerification: 'stock verification', UnitOfMeasurement: 'units of measurement', Category: 'item masters',
};
function pureNav(raw) {
    // V9.14.0: the Chart of Accounts takes an Excel upload — open it and point at Import
    if (/^(?:please\s+)?(?:import|upload|bulk\s+(?:upload|import|create))\s+(?:the\s+|my\s+)?(?:chart\s+of\s+accounts?|accounts?|ledgers?)(?:\s+(?:from|via|using|with)\s+(?:an?\s+)?(?:excel|xlsx?|sheet|spreadsheet|file))?\s*$/i.test(String(raw || '').trim())) {
        return { entity: 'Account', action: 'list', newTask: true, isReady: true, _source: 'local',
            fields: { note: 'Use <b>Import</b> (top right) to upload your Excel of accounts — I can’t attach files for you. <b>Export</b> gives you the column layout to start from.' },
            botResponse: 'Opening the Chart of Accounts…' };
    }
    // "change my password" — open the page only; the user types the password, never the agent
    if (/^(?:please\s+)?(?:change|reset|update)\s+(?:my\s+)?(?:login\s+)?password$/i.test(String(raw || '').trim().replace(/[.!?]+$/, ''))) {
        return { entity: 'RawNav', action: 'navigate', newTask: true, isReady: true, _source: 'local',
                 fields: { path: '/changepassword', label: 'Change Password', hint: 'type the new password yourself; I never handle passwords' },
                 botResponse: 'Opening Change Password — type the new password yourself; I never handle passwords…' };
    }
    const m = String(raw || '').trim().replace(/[.!?]+$/, '')
        .match(/^(?:please\s+|pls\s+)?(?:open|show(?:\s+me)?|view|display|go\s+to|goto|navigate\s+to|take\s+me\s+to|see|list)\s+(?:(?:the|all|my|our)\s+)*(.+)$/i);
    if (!m) return null;
    const rest = m[1].trim().toLowerCase();
    const tries = [rest, rest.replace(/\s+(?:list|page|screen|module|section|menu|tab|register|master)$/i, '')];
    for (const cand of tries) {
        for (const [entity, re, action, extra, label] of NAV_NAMES) {
            if (re.test(cand)) {
                const name = label ? label : !entity ? 'the dashboard'
                           : extra && extra.contactType ? `${extra.contactType.toLowerCase()}s`
                           : NAV_LABEL[entity] || `${nluHuman(entity)} list`;
                // A raw page link carries its readable name, so the reply after loading says
                // "POS settings is open", not "/setting/pos is open"
                const named = entity === 'RawNav' && label ? { label: label.split(' — ')[0], hint: label.split(' — ')[1] || '' } : {};
                return { entity, action: action || 'list', newTask: true, isReady: true, _source: 'local',
                         fields: { ...(extra || {}), ...named }, botResponse: `Opening ${name}…` };
            }
        }
    }
    return null;
}

// ── V9.14.0 settings, as people say them ─────────────────────────────────────
// "use LIFO" · "switch to FIFO" · "which stock selection method am I using" ·
// "enable split invoice by tax rate" — the catalogue names are a mouthful.
function settingShortcut(raw) {
    let desired = null, name = null, value = null;
    const fl = raw.match(/\b(?:use|switch\s+to|change\s+to|move\s+to|set\s+(?:the\s+)?(?:stock\s+)?(?:selection|deduction|issue|batch)(?:\s+(?:method|rule))?\s+(?:to\s+)?|make\s+it)\s*(fifo|lifo)\b/i)
            || raw.match(/^\s*(fifo|lifo)\s*(?:please|karo|kar\s*do|chahiye)?\s*$/i);
    if (fl) { desired = 'set'; name = 'Stock Selection Method'; value = fl[1].toUpperCase(); }
    else if (/\b(?:which|what)\b.*\b(?:stock\s+(?:selection|deduction|issue)\s+method|fifo|lifo)\b|\bfifo\s+or\s+lifo\b/i.test(raw)) { desired = 'check'; name = 'Stock Selection Method'; }
    else if (/\bsplit\b.*\b(?:invoices?|bills?)\b.*\btax\s*rates?\b/i.test(raw) && /\b(?:enable|disable|turn|switch|is|check|on|off)\b/i.test(raw)) {
        desired = /\b(?:enable|disable|turn|switch)\b/i.test(raw) ? (/\b(?:disable|off)\b/i.test(raw) ? 'off' : 'on') : 'check';
        name = 'Split Invoice and Bill of Supply Based on Tax Rate';
    }
    if (!name) return null;
    const hit = findSetting(name) || { n: name, page: '/setting/inventory', group: '', ty: 't' };
    const pages = ['/setting/pos', '/setting/inventory', '/setting/general', '/setting/sales', '/setting/purchase'].filter(p => p !== hit.page);
    return { entity: 'Setting', action: 'toggle', newTask: true, isReady: true, _source: 'local',
        fields: { settingName: hit.n, desired, ...(value ? { settingValue: value } : {}), firstPage: hit.page, pages, group: hit.group, kind: hit.ty },
        botResponse: desired === 'check' ? `Checking "${hit.n}"…` : desired === 'set' ? `Setting "${hit.n}" → ${value}…` : `Flipping "${hit.n}" ${desired.toUpperCase()}…` };
}

// ── Recipes (V9.14.0 form: Inputs consumed per batch → Outputs, Assemble/Disassemble) ──
// "2 Notebook1 and 1 PP10955" / "Notebook1 x2, PP10955" → [{name, qty}]
function recipeLines(s) {
    return String(s || '').split(/\s*(?:,|;|\band\b|\+|&)\s*/i).map(x => x.trim()).filter(Boolean).map(x => {
        let m = x.match(/^(\d+(?:\.\d+)?)\s*(?:x|×|pcs?|units?|nos?|kgs?)?\s+(.+)$/i);
        if (m) return { name: m[2].trim(), qty: m[1] };
        m = x.match(/^(.+?)\s*(?:x|×|qty)\s*(\d+(?:\.\d+)?)$/i);
        return m ? { name: m[1].trim(), qty: m[2] } : { name: x, qty: null };
    }).filter(l => /[a-z0-9]/i.test(l.name));
}
// "create recipe Gift Pack with 2 Notebook1 and 1 PP10955 makes 1 Hamper"
// "create recipe for PP10955 from 2 Notebook1"  ·  "new disassemble recipe Split: 1 Hamper makes 2 Notebook1"
const RECIPE_MAKES = /\s*(?:\bmakes?\b|\bmaking\b|\bgives?\b|\bproduces?\b|\byields?\b|\bto\s+make\b|=>|→)\s*/i;
function parseRecipeText(raw) {
    const type = /\b(?:dis|un)assembl/i.test(raw) ? 'Disassemble' : /\bassembl/i.test(raw) ? 'Assemble' : null;
    const body = raw.replace(/^.*?\brecipes?\b\s*/i, '');
    const mk = body.split(RECIPE_MAKES);
    const head = mk[0], outS = mk.slice(1).join(' and ');
    const inM = head.match(/^(.*?)\s*(?:\b(?:with|from|using|uses|needs|consumes)\b|:)\s*(.+)$/i);
    const nameS = (inM ? inM[1] : head).trim();
    const forM = nameS.match(/^(?:for|called|named)\s+(.+)$/i);
    const name = (forM ? forM[1] : nameS).replace(/[:\-–,]+\s*$/, '').trim();
    const inputs = recipeLines(inM ? inM[2] : '');
    let outputs = recipeLines(outS);
    if (!outputs.length && /^for\s/i.test(nameS) && name) outputs = [{ name, qty: null }];   // "recipe for PP10955 …" makes PP10955
    return { name, type, inputs, outputs };
}
const recipeSay = ls => ls.map(l => `${l.qty || 1} × ${l.name}`).join(', ');
function recipeIntent(f, newTask) {
    const ready = !!(f.recipeName && (f.inputs || []).length && (f.outputs || []).length);
    return { entity:'Recipe', action:'create', newTask, isReady: ready, _source:'local', fields: f,
        botResponse: !f.recipeName ? 'What should the recipe be called?'
                   : !(f.inputs || []).length ? `What goes into <b>${f.recipeName}</b> per batch? e.g. "2 Notebook1 and 1 PP10955"`
                   : !(f.outputs || []).length ? `What does one batch of <b>${f.recipeName}</b> make? e.g. "makes 1 Gift Hamper"`
                   : `Recipe ${f.recipeName}${f.recipeType === 'Disassemble' ? ' (disassemble)' : ''}: ${recipeSay(f.inputs)} → ${recipeSay(f.outputs)}…` };
}

// ── Local NLU: handle ~75% of commands with zero API calls ───────────────────
// Returns an intent object or null (→ the scope gate and classifier tiers).
// ONLY returns non-null when confidence is HIGH (all required fields present
// or a clear single missing field to ask for). Never guesses.
function tryLocalParse(text, conversationState, currentPage) {
    const raw  = text.trim();
    const t    = raw.toLowerCase();

    // ── Field extractors ──────────────────────────────────────────────────────
    const mobRe   = /\b([6-9]\d{9})\b/;
    const getMob  = s => (s.match(mobRe)||[])[1] || null;
    const getAmt  = s => {
        const m = s.match(/(?:₹|rs\.?\s*)(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s*(?:₹|rs\b)/i);
        if (m) return parseFloat((m[1]||m[2]).replace(/,/g,''));
        return null;
    };
    // Most people type "collect 5000 from Gupta Stores", with no ₹ anywhere.
    // Only money contexts may use this — a bare number in a stock sentence is a
    // quantity, so the caller opts in rather than this firing everywhere.
    const getAmtLoose = s => {
        const explicit = getAmt(s);
        if (explicit != null) return explicit;
        // skip anything that is clearly not money: phone numbers, percentages,
        // document numbers, dates.
        const m = String(s).match(/(?:^|\s)(\d{1,3}(?:,\d{2,3})+|\d{2,8})(?:\.\d{1,2})?(?=\s|$)/);
        if (!m) return null;
        const raw = m[1].replace(/,/g, '');
        if (raw.length >= 10) return null;                       // phone number
        if (/%\s*$/.test(String(s).slice(0, m.index + m[0].length + 1))) return null;
        return parseFloat(raw + (m[0].match(/\.\d{1,2}$/) || [''])[0]);
    };
    // A rate is almost never typed with a currency symbol on a document line —
    // people write "20 Cotton Kurta at 450", "@450", "rate 450". getAmt() insisted
    // on a ₹ or "rs", so the rate was dropped, the line saved with a blank Unit
    // Cost, and every document downstream inherited a zero value: the PO, the
    // GRN, the supplier bill, and finally a payment of 0.00 against a bill the
    // ERP had already marked PAID.
    const getRate = s => {
        const m = String(s).match(/(?:\b(?:at|rate|price|each|per\s*(?:unit|pc|piece))\b|@)\s*:?\s*₹?\s*([\d,]+(?:\.\d+)?)/i);
        if (m) return parseFloat(m[1].replace(/,/g, ''));
        return getAmt(s);
    };
    const getQty  = s => {
        const m = s.match(/\bqty?\s*:?\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:qty|units?|pcs?|pieces?|nos?)\b/i);
        return m ? parseFloat(m[1]||m[2]) : null;
    };
    // Merchants say "20 Cotton Kurta", not "item Cotton Kurta qty 20". When the
    // keyword extractors find nothing, read a bare "<number> <words>" run as
    // quantity + product. Scanning only AFTER the party name keeps supplier
    // names and PO numbers out of it, and the 1-6 digit bound means a 10-digit
    // phone number can never be mistaken for a quantity.
    const qtyItemTail = (src, party) => {
        let str = String(src || '');
        if (party) {
            const i = str.toLowerCase().indexOf(String(party).toLowerCase());
            if (i >= 0) str = str.slice(i + String(party).length);
        }
        const m = str.match(/\b(\d{1,6}(?:\.\d+)?)\s+([A-Za-z][A-Za-z0-9\s\-']{1,40}?)(?=\s+(?:at|for|rs|price|each|per|with|rate)\b|\s*[@₹]|[,.]|$)/i);
        if (!m) return {};
        const name = m[2].trim().replace(/\s+(?:pcs?|pieces?|nos?|units?)$/i, '').trim();
        if (!name || /^\d+$/.test(name)) return {};
        return { tailQty: parseFloat(m[1]), tailItem: name };
    };
    const getPay  = s =>
        /\bupi\b|\bpaytm\b|\bg\s*pay\b|\bgoogle\s*pay\b|\bphone\s*pe\b|\bbhim\b/i.test(s)?'UPI':/\bcash\b/i.test(s)?'Cash':
        /\bneft|rtgs|imps\b/i.test(s)?'Bank':/\bcheque|check\b/i.test(s)?'Cheque':
        /\bcard\b/i.test(s)?'Card':null;
    // Extract a name following a keyword — stops at comma, mobile/phone, or line end
    const NAME_STOPWORDS = /^(?:contact|contacts|customer|customers|client|clients|supplier|suppliers|vendor|vendors|employee|new|details?|account|party|person)$/i;
    const nameAfter = (src, kwRe) => {
        // Names may contain digits ("Diwali10", "v1300") — but never be ONLY digits.
        const m = src.match(new RegExp(
            // The stop-list also has to cover the payment mode, or "collect 5000
            // from Gupta Stores cash" saves a customer called "Gupta Stores cash".
            String.raw`(?:${kwRe})\s+([A-Za-z0-9][A-Za-z0-9 .&'-]{1,40}?)(?:\s*,|\s+(?:mobile|mob|ph\b|phone|email|gstin|role|amount|price|worth|value|percent\w*|₹|rs\.|qty|qty\b|\d{10}|cash|upi|paytm|gpay|card|cheque|check|neft|rtgs|imps|bank|online|bill|invoice|grn|against|voucher|via|through|by(?=\s+(?:cash|upi|card|cheque|check|neft|rtgs|imps|bank|online|g\s*pay|gpay|paytm|phone\s*pe)))\b|\s+[\d,]{2,}(?:\.\d+)?(?=\s|$)|$)`, 'i'
        ));
        if (!m) return null;
        const nm = m[1].trim();
        if (NAME_STOPWORDS.test(nm) || /^\d+$/.test(nm)) return null;
        return nm;
    };

    // What comes back on a return, wherever the sentence puts it:
    //   "… bill BIL657 1 Notebook1"  — after the document number
    //   "return 1 Notebook1 to …"    — between the verb and the party
    const returnLine = (src, refM) => {
        const tail = refM ? src.slice(src.indexOf(refM[0]) + refM[0].length) : '';
        let m = tail.match(/^\s*(?:,|and|for|of|with)?\s*(\d{1,6}(?:\.\d+)?)\s*(?:x\s+|pcs?\s+|nos?\s+|units?\s+)?([A-Za-z][A-Za-z0-9\s\-']{0,40}?)\s*$/i);
        if (m) return { qty: parseFloat(m[1]), item: m[2].trim() };
        m = tail.match(/^\s*(?:,|and|for|of|with)?\s*([A-Za-z][A-Za-z0-9\s\-']{0,40}?)\s+(?:qty\s*)?(\d{1,6}(?:\.\d+)?)\s*$/i);
        if (m && !/^(qty|quantity)$/i.test(m[1].trim())) return { qty: parseFloat(m[2]), item: m[1].trim() };
        m = src.match(/\breturn(?:ing|ed)?\s+(\d{1,6}(?:\.\d+)?)\s*(?:x\s+|pcs?\s+|nos?\s+|units?\s+)?([A-Za-z][A-Za-z0-9\s\-']{0,40}?)\s+(?:back\s+)?(?:to|from)\s+[A-Za-z]/i);
        if (m) return { qty: parseFloat(m[1]), item: m[2].trim() };
        return null;
    };

    const today    = new Date();
    const ddmmyyyy = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    const todayStr = ddmmyyyy(today);
    const firstOfMonth = (d=today) => `01/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    const fy = today.getMonth()>=3 ? today.getFullYear() : today.getFullYear()-1;

    // Date range helper from period keywords
    const dateRange = s => {
        if (/\btoday\b/.test(s))       return { fromDate:todayStr,           toDate:todayStr };
        if (/\byesterday\b/.test(s))   { const y=new Date(today); y.setDate(y.getDate()-1); const ds=ddmmyyyy(y); return { fromDate:ds, toDate:ds }; }
        if (/\bthis\s+month\b/.test(s)) return { fromDate:firstOfMonth(),     toDate:todayStr };
        if (/\blast\s+month\b/.test(s)) {
            const lm1=new Date(today.getFullYear(),today.getMonth()-1,1);
            const lmN=new Date(today.getFullYear(),today.getMonth(),0);
            return { fromDate:ddmmyyyy(lm1), toDate:ddmmyyyy(lmN) };
        }
        if (/\bthis\s+(?:fy|year|financial)/.test(s)) return { fromDate:`01/04/${fy}`, toDate:todayStr };
        return { fromDate:null, toDate:null };
    };

    // ── 0-url. A VasyERP link in the message → open that page ────────────────
    // e.g. "https://uat2.vasyerp.com/inventorytracking/new , it is done here"
    {
        const um = raw.match(new RegExp(`https?://[^\\s,]*(?:${VASY_HOST_RE.source})[^\\s,]*`, 'i'));
        if (um) {
            try {
                const u = new URL(um[0]);
                return { entity:'RawNav', action:'navigate', newTask:true, isReady:true,
                    fields:{ path: u.pathname + u.search },
                    botResponse:`Opening ${u.pathname}…` };
            } catch (e) { /* malformed URL — let the other tiers try */ }
        }
    }

    // ── 0. CONVERSATION FILL — user is answering a bot question mid-task ────────
    // Handles short replies like "tony", "9834076771", "Manager" that have no
    // ERP keyword but are clearly field values for the ongoing task.
    const cs = conversationState || {};

    // ── 0-choice. Answer to a "which one?" — fills exactly the ambiguous field ─
    // (the bubble cleared it and named it in cs.pendingChoice). Anything that is
    // clearly a new command or a cancel falls through to the normal tiers.
    // When the offered answers are known, the reply must match one of them —
    // "how much does Gupta Stores owe" sent while a "which product?" was open
    // used to become a product called that.
    const nrm = x => String(x || '').toLowerCase().replace(/#[a-z]?\d+$/i, '').replace(/[^a-z0-9]/g, '');
    const matchesOffer = !Array.isArray(cs.choiceValues) || !cs.choiceValues.length
        || cs.choiceValues.some(v => { const a = nrm(v), b = nrm(raw); return a && b && (a === b || a.includes(b) || b.includes(a)); });
    if (cs.entity && cs.pendingChoice && raw.trim() && raw.trim().length <= 140 && matchesOffer
        && !/^(cancel|stop|reset|no|start over)$/i.test(raw.trim())
        && !/^(create|add|new|make|sell|record|pay|collect|show|open|delete|edit)\b/i.test(raw.trim())) {
        const v = raw.trim().replace(/^[^\w\d#₹]+\s*/, '');
        return { entity: cs.entity, action: cs.action || 'create', newTask: false, isReady: true, _source: 'local',
                 fields: { [cs.pendingChoice]: v },
                 botResponse: `Using ${v.replace(/\s*#[a-z]?\d+$/i, '')}…` };   // shown as a plain status line
    }

    // ── 0-yes. CONFIRM / CANCEL a held-back risky save ───────────────────────
    // Must be the very first check: "yes" means nothing else while a save waits.
    {
        const pend = pendingLive();
        if (pend) {
            if (/^\s*(?:yes|y|ya|yeah|yep|ok|okay|confirm(?:ed)?|save|save\s*it|do\s*it|go\s*ahead|proceed|approve|sure|haan|ha)\s*[.!]*\s*$/i.test(raw)) {
                return { entity:'ConfirmSave', action:'confirm', newTask:false, isReady:true,
                    fields:{ task: pend.task },
                    botResponse: pend.task === 'Delete' ? 'Deleting it…' : pend.task === 'Deactivate' ? 'Deactivating it…' : `Saving the ${nluHuman(pend.task)}…` };
            }
            if (/^\s*(?:no|n|nope|cancel|stop|don'?t|abort|discard|leave\s*it|forget\s*it)\s*[.!]*\s*$/i.test(raw)) {
                setPendingSave(null);
                return { entity:null, action:'chat', newTask:false, isReady:false, fields:{},
                    botResponse:`Cancelled — I left the <b>${nluHuman(pend.task)}</b> form filled in but unsaved. Nothing was written to your books.` };
            }
        }
    }

    // ── 0-rcp. RECIPE follow-ups — answering "what goes into it?" / "what does it make?"
    if (cs.entity === 'Recipe' && !cs.pendingChoice && raw.trim()
        && !/^(?:create|add|new|sell|record|pay|collect|show|open|list|delete|edit|cancel|stop|reset|start\s+over|what|how|which|why|who|where|find|search|print|download)\b|\?\s*$/i.test(raw.trim())
        && !/\b(?:stock|balance|ledger|outstanding|report)\s+(?:of|for)\b|\bowes?\b|\b(?:kitna|batao|dikhao|kholo)\b/i.test(raw)) {
        const f = { ...(cs.fields || {}) }, s = raw.trim();
        let took = true;
        if (!f.recipeName) f.recipeName = s.replace(/^(?:call\s+it|name\s+it|it'?s|called|named)\s+/i, '');
        else if (!(f.inputs || []).length) {
            const parts = s.split(RECIPE_MAKES);
            f.inputs = recipeLines(parts[0].replace(/^(?:it\s+)?(?:uses?|needs?|takes?|consumes?)\s+/i, ''));
            if (parts.length > 1) f.outputs = recipeLines(parts.slice(1).join(' and '));
        } else if (!(f.outputs || []).length) f.outputs = recipeLines(s.replace(/^(?:it\s+)?(?:makes?|gives?|produces?|yields?)\s+/i, ''));
        else took = false;
        if (took) return recipeIntent(f, false);
    }

    // ── 0-vr. READ VINA'S ANSWER — follow-up after asking it ─────────────────
    // "it answered check now" / "read vina's answer" / "what did vina say"
    if (/\b(?:it\s+)?answered\b|\bread\s+(?:it|the\s+answer|vina)|\bwhat\s+did\s+vina\s+say\b|\bcheck\s+(?:it\s+)?now\b/i.test(t)
        && !/\b(create|add|new|make)\b/.test(t)) {
        return { entity:'VinaRead', action:'read', newTask:false, isReady:true, fields:{},
            botResponse:'Reading Vina’s answer off the page…' };
    }

    // ── 0-teach. USER IS TEACHING A FIELD RULE — acknowledge, don't parse ─────
    // "Select Party* is compulsory field so is Account* remember it next time"
    if (/\b(?:is|are)\s+(?:a\s+)?(?:compulsory|mandatory|required)\b/i.test(t)
        || /\bremember\s+(?:it|this|that)\b/i.test(t)) {
        const fieldsM = raw.match(/([A-Z][A-Za-z ()%.\/&-]{2,30}\*)/g);
        const named = fieldsM ? [...new Set(fieldsM.map(s => s.trim()))] : [];
        try {
            chrome.storage.local.get(['vasyFieldNotes'], r => {
                const notes = r.vasyFieldNotes || [];
                notes.unshift({ note: raw.slice(0, 200), fields: named, at: new Date().toISOString() });
                chrome.storage.local.set({ vasyFieldNotes: notes.slice(0, 50) });
            });
        } catch (e) {}
        return { entity:null, action:'chat', newTask:false, isReady:false, fields:{}, _source:'local',
            botResponse: named.length
                ? `Noted — ${named.map(f => `<b>${f}</b>`).join(' and ')} ${named.length>1?'are':'is'} compulsory. I've saved that and I'll ask for ${named.length>1?'them':'it'} up front instead of failing at save.`
                : `Noted — I've saved that rule and will ask for those fields up front.` };
    }

    // ── 0-appr. APPROVE / REJECT a stock transfer request ────────────────────
    if (/\b(approve|reject|accept|decline)\b/i.test(t) && /\b(?:stf?req|st-?req|transfer)\b/i.test(t)) {
        const refM = raw.match(/\b(ST[-\s]?FREQ?\s?\d+|STFREQ\d+|ST-?REQ\d+)\b/i)
                  || raw.match(/\btransfer\s*(?:no\.?|number|request)?\s*#?([A-Z]*\d[\w-]*)\b/i);
        const decision = /reject|decline/i.test(t) ? 'reject' : 'approve';
        if (refM) {
            return { entity:'TransferApproval', action:'approve', newTask:true, isReady:true,
                fields:{ transferNo: refM[1].toUpperCase().replace(/\s+/g,''), decision },
                botResponse:`Opening ${refM[1].toUpperCase()} to ${decision}…` };
        }
    }

    // ── 0-cont. "continue" / "go ahead" — resume, never refuse ───────────────
    if (/^\s*(?:continue|go\s+ahead|proceed|carry\s+on|resume|next)\s*[.!]*\s*$/i.test(raw)) {
        if (cs.entity) return { entity: cs.entity, action: cs.action, fields: {}, isReady: false, newTask: false,
            botResponse: `Continuing your <b>${cs.entity}</b> task — answer my last question above, or add the missing detail.` };
        return { entity: null, action: 'chat', fields: {}, isReady: false, newTask: false,
            botResponse: `All caught up ✅ Give me the next command — e.g. <i>"create customer Raj Sharma"</i> or <i>"total sales today"</i>.` };
    }

    // ── 0a. BATCH SELECTION — user is choosing a batch number for POS ─────────
    if (cs.entity === 'POSSale' && cs.action === 'batch_select') {
        const batchNum = parseInt(
            (t.match(/\b(?:batch|lot|b|option|no\.?)\s*(\d+)\b/i)||[])[1] ||
            (raw.trim().match(/^(\d+)$/) || [])[1] || '0'
        );
        if (batchNum > 0) {
            return { entity:'POSSale', action:'select_batch', newTask:false,
                fields:{ batchChoice: String(batchNum) }, isReady:true,
                botResponse:`Selecting batch ${batchNum}…` };
        }
    }

    if (cs.entity && cs.action === 'create') {
        const ent = cs.entity;
        const f   = { ...(cs.fields || {}) };

        // Bare mobile number → fill mobile/customerMobile
        const mobFill = getMob(t);
        if (mobFill && /^[6-9]\d{9}$/.test(raw.trim()) && !f.mobile && !f.customerMobile) {
            const key = ent === 'Loyalty' ? 'customerMobile' : 'mobile';
            const nf  = { ...f, [key]: mobFill };
            const rdy = (ent === 'Contact'  && nf.firstName) ||
                        (ent === 'Employee' && empReady(nf)) ||
                        (ent === 'Loyalty');
            return { entity:ent, action:'create', newTask:false, fields:{ [key]:mobFill },
                isReady:!!rdy,
                botResponse: rdy ? `Creating ${ent}…` : `Thanks! What's the name?` };
        }

        // Name reply → fill firstName (mobile NOT required for contacts). Handles a
        // bare name ("Raj Kumar") OR a combined reply ("Raj Kumar, mobile 9876543210").
        if ((ent === 'Contact' || ent === 'Employee') && !f.firstName) {
            const mob = getMob(t);
            // Take the leading alphabetic part before any comma / "mobile" keyword / digits.
            const nameM = raw.match(/^\s*([A-Za-z][A-Za-z .'‑-]{0,40}?)(?:\s*,|\s+(?:mobile|mob|ph|phone|email|no\.?)\b|\s+\d|\s*$)/i);
            let nm = nameM ? nameM[1].trim() : null;
            if (nm && NAME_STOPWORDS.test(nm)) nm = null;
            if (nm && nm.split(/\s+/).length <= 5) {
                const parts     = nm.split(/\s+/);
                const firstName = parts[0];
                const lastName  = parts.slice(1).join(' ') || null;
                // Employee needs BOTH Mobile No.* and Role* (mandatory on the form) —
                // ask for the mobile first, since skipping it fails at save.
                const haveMob   = !!(mob || f.mobile);
                const needMobile = ent === 'Employee' && !haveMob;
                // Role is optional; a role already named without a password is what
                // blocks the save, so ask for that instead.
                const needPass   = ent === 'Employee' && f.role && !f.password;
                const isSupplier = ent === 'Contact' && f.contactType === 'Supplier';
                return { entity:ent, action:'create', newTask:false,
                    fields: { firstName, ...(lastName ? { lastName } : {}),
                              ...(mob && !f.mobile ? { mobile: mob } : {}),
                              ...(isSupplier ? { companyName: nm } : {}) },
                    isReady: !needMobile && !needPass,
                    botResponse: needMobile ? `${firstName}'s mobile number?`
                        : needPass ? `What password should ${firstName} log in with?`
                        : `Creating ${ent === 'Contact' ? (f.contactType || 'Contact') : 'employee'} ${firstName}…` };
            }
        }

        // Bare company name for Supplier when firstName+mobile set but companyName missing
        if (ent === 'Contact' && f.contactType === 'Supplier' && f.mobile && f.firstName && !f.companyName) {
            if (/^[A-Za-z][A-Za-z0-9 .&',\-]{0,50}$/.test(raw) && raw.trim().split(/\s+/).length <= 6) {
                return { entity:'Contact', action:'create', newTask:false,
                    fields: { companyName: raw.trim() },
                    isReady: true,
                    botResponse: `Creating supplier ${raw.trim()}…` };
            }
        }

        // Bare role ("purchase manager") → fill role. Mobile is NOT required to
        // recognise the answer — demanding it here sent role replies to the cloud.
        if (ent === 'Employee' && f.firstName && !f.role) {
            if (/^[A-Za-z][A-Za-z\s/&.-]{0,34}$/.test(raw.trim())) {
                const role = raw.trim();
                const nf   = { ...f, role };
                return { entity:'Employee', action:'create', newTask:false,
                    fields: { role }, isReady: empReady(nf),
                    botResponse: !f.mobile ? `Got it — ${role}. What's ${f.firstName}'s mobile number?`
                               : !f.password ? `Got it — ${role}. What password should ${f.firstName} log in with?`
                               : `Creating employee ${f.firstName} (${role})…` };
            }
        }

        // Password reply mid-flow. Only ever accepted when WE asked for one (a role
        // is pending) — so an arbitrary message is never stored as a credential.
        if (ent === 'Employee' && f.firstName && f.role && !f.password) {
            const pw = raw.trim().replace(/^(?:password|pass)\s+(?:is\s+)?/i, '').trim();
            if (pw && pw.length >= 4 && pw.length <= 40 && !/\s/.test(pw)) {
                const nf = { ...f, password: pw };
                return { entity:'Employee', action:'create', newTask:false,
                    fields: { password: pw }, isReady: empReady(nf),
                    botResponse: !f.mobile ? `Thanks. What's ${f.firstName}'s mobile number?`
                                           : `Creating employee ${f.firstName} (${f.role})…` };
            }
        }

        // Payment mode answer → fill paymentMode when party+amount exist
        const pmFill = getPay(t);
        if (pmFill && (ent === 'Payment' || ent === 'Receipt' || ent === 'Expense') &&
            !f.paymentMode && /^(cash|upi|neft|rtgs|imps|cheque|check|card|bank)$/i.test(t.trim())) {
            const rdy = (ent === 'Payment' && f.partyName && f.amount) ||
                        (ent === 'Receipt' && f.partyName && f.amount) ||
                        (ent === 'Expense' && f.amount);
            return { entity:ent, action:'create', newTask:false,
                fields: { paymentMode: pmFill }, isReady: !!rdy,
                botResponse: rdy ? `Recording ${ent}…` : `Amount?` };
        }

        // POS payment mode reply — user chose payment after item+qty were collected
        if (ent === 'POSSale' && f.itemName && f.qty && !f.paymentMode) {
            const pm = getPay(t);
            if (pm) {
                return { entity:'POSSale', action:'create', newTask:false,
                    fields:{ paymentMode: pm }, isReady: true,
                    botResponse:`Selling ${f.itemName} qty ${f.qty} via ${pm}…` };
            }
            if (/\bmulti(?:pay|ple|payment)?\b/i.test(t)) {
                return { entity:'POSSale', action:'create', newTask:false,
                    fields:{ paymentMode: 'Cash' }, isReady: true,
                    botResponse:`Processing POS sale…` };
            }
        }

        // Mid-flow document selection: "select BIL173" / "use PO-105" while a
        // GRN or Supplier Bill is in progress → fill the doc ref and re-dispatch.
        if ((ent === 'MaterialInward' || ent === 'SupplierBill') && /\b(select|choose|use|pick|take)\b/i.test(t)) {
            const docM = raw.match(/\b((?:BIL{1,2}|PO|GRN|MI|INV)[-#]?\d+[\w\-]*)\b/i) || raw.match(/\b([A-Z]{2,6}[-#]?\d{2,})\b/i);
            if (docM) {
                const ref = docM[1].toUpperCase();
                const key = ent === 'MaterialInward' ? 'poNumber' : 'miNumber';
                return { entity:ent, action:'create', newTask:false,
                    fields:{ [key]: ref }, isReady:true,
                    botResponse:`Selecting ${ref}…` };
            }
        }

        // ── Generic conversational field-filler — keeps multi-field tasks LOCAL ──
        // Answers like "5", "ABC Traders", "cash" for an in-progress create task are
        // mapped to the next missing required field.
        const REQ = REQ_FIELDS;
        // A fresh command is never a field value. "sell 1 PP10955 cash" sent after a
        // "product not found" was swallowed as a product NAMED that whole sentence.
        const isPivot = /\b(create|add|new|make|register|list|show|search|find|edit|update|delete|remove|open|navigate|report|sell|pay|collect|receive|record|book|raise|transfer|adjust|generate|print|export|issue|return|approve|reject|purchase|invoice)\b/i.test(t)
                     || /^(what|what's|whats|how|who|which|tell|give)\b/i.test(raw.trim())
                     // lookups and Hinglish commands are new requests, never a field answer
                     || /\b(?:stock|balance|outstanding|owe|ledger)\s+(?:of|for)\b|\b(?:balance|stock|baki|hisaab)\s+(?:batao|dikhao|kitna)|\b(?:kholo|becho|mangwao|bhejo|de\s+do)\s*$/i.test(raw.trim());
        if (REQ[ent] && !isPivot) {
            const next = REQ[ent].find(k => !f[k]);
            if (next) {
                let val = null;
                if (next === 'qty')              val = getQty(t) || (/^\d+(?:\.\d+)?$/.test(raw.trim()) ? Number(raw.trim())
                                                       : (raw.match(/\b(\d+(?:\.\d+)?)\s*(?:is\s+(?:the\s+)?qty|qty)|qty\s*(?:is\s*)?(\d+(?:\.\d+)?)/i) || []).slice(1).find(Boolean) || null);
                else if (next === 'amount' || next === 'price' || next === 'purchasePrice' || next === 'mrp')
                                                 val = getRate(raw) || (/^\d+(?:\.\d+)?$/.test(raw.trim()) ? Number(raw.trim()) : null);
                else if (next === 'paymentMode') val = getPay(t);
                else if (next === 'mobile')      val = getMob(t) || (/^\+?\d[\d\s-]{8,14}$/.test(raw.trim()) ? raw.trim().replace(/[\s-]/g,'') : null);
                else if (next === 'adjustType')  val = /\b(increase|add|top.?up|inward)\b/i.test(t) ? 'Increase'
                                                     : /\b(decrease|reduce|write.?off|damage|scrap|outward)\b/i.test(t) ? 'Decrease' : null;
                else { // text fields: supplierName / customerName / partyName / itemName
                    const clean = raw.trim().replace(/^[\s,]+|[\s,]+$/g, '');
                    // Asked for the ITEM but the reply names a SUPPLIER ("from/form X",
                    // "supplier is X") → the earlier "supplier" was really the item. Swap.
                    const swapM = next === 'itemName' && f.supplierName
                        && clean.match(/^(?:from|form|supplier(?:\s+is)?)[:\s]+(.{2,50})$/i);
                    if (swapM) {
                        return { entity: ent, action: cs.action || 'create', newTask: false,
                            fields: { supplierName: swapM[1].trim(), itemName: f.supplierName },
                            isReady: !REQ[ent].some(k => !( { ...f, supplierName: swapM[1].trim(), itemName: f.supplierName }[k] )),
                            botResponse: `Got it — supplier <b>${swapM[1].trim()}</b>, item <b>${f.supplierName}</b>.` +
                                         (f.qty ? '' : ' Quantity?') , _source: 'local' };
                    }
                    if (clean && clean.length <= 60 && /[A-Za-z0-9]/.test(clean)) val = clean;
                }
                if (val != null && val !== '') {
                    const nf = { ...f, [next]: val };
                    const stillMissing = REQ[ent].find(k => !nf[k]);
                    const PROMPT = {
                        supplierName:'Supplier name?', customerName:'Customer name?', partyName:'Party name?',
                        itemName:'Which product?', qty:'Quantity?', amount:'Amount?',
                        paymentMode:'Payment mode? Cash / UPI / Card', adjustType:'Increase or Decrease?',
                        productName:'What is the product called?',
                        purchasePrice:'What do you <b>pay</b> for it? (purchase price — VasyERP works the other prices out from this)',
                        price:'And what do you <b>sell</b> it for?',
                        category:'Which category does it go in?',
                        unit:'Which <b>unit</b> is it sold in? (PCS, kg, BOX… — compulsory)',
                        tax:'Which <b>GST</b> applies? (e.g. "18", or "0" for none — compulsory)',
                        roleName:'What should the role be called?',
                        branchName:'Which <b>branch</b> is the account at? (Branch name is compulsory)',
                        accountNo:'And the <b>account number</b>? (compulsory)',
                    };
                    return { entity:ent, action:'create', newTask:false,
                        fields:{ [next]: val }, isReady: !stillMissing,
                        botResponse: stillMissing ? (PROMPT[stillMissing] || `What is the ${stillMissing}?`) : `Working on ${ent}…` };
                }
            }
        }
    }

    // ── 0n. PURE NAVIGATION — "open debit notes", "show recipes", "go to user roles"
    // The whole message must be a nav verb + ONE module name (+ "list"/"page"), so
    // "open debit note for Sharma" still reaches the create rules. Without this the
    // late nav table lost to every create rule ("open payments" asked for a party).
    {
        const nav = pureNav(raw);
        if (nav) return nav;
        // V9.14.0 settings in the words people use — ahead of the page-question
        // tier, which otherwise takes "which stock selection method am I using?"
        const ss = settingShortcut(raw);
        if (ss) return ss;
    }

    // ── 0u. FLOW QUESTIONS — answered from the graph, no page, no network ────
    // "what's the purchase flow", "what comes after a GRN", "what do I need for
    // an invoice". These used to fall through to the cloud tier or get refused.
    {
        const wantsFlow = /\b(?:flow|process|steps?|sequence|procedure|cycle)\b/i.test(t)
                       || /\bwhat(?:'s| is| comes)?\s+(?:next|after)\b/i.test(t)
                       || /\bhow\s+(?:do|does|can)\s+(?:i|we|you)\s+(?:raise|make|do|run|complete)\b/i.test(t)
                       // "what do I need for an invoice" is a requirements
                       // question, not a request to go and fetch a report.
                       || /\bwhat\s+(?:do|does)\s+(?:i|we|you)\s+need\b/i.test(t)
                       || /\bwhat(?:'s| is)?\s+(?:required|needed|mandatory|compulsory)\b/i.test(t);
        if (wantsFlow) {
            // Answer about the SPECIFIC document when one is named — "what do I
            // need for a POS sale" wants the till gate, not the whole sales
            // chain. Only fall back to the chain when the question is about the
            // process itself ("what's the purchase flow").
            const asksChain = /\b(?:flow|process|chain|cycle|steps?|sequence|procedure|end\s*to\s*end)\b/i.test(t);
            if (!asksChain) {
                // SCORE every document rather than taking the first whose label
                // shares a word. "POS sale" and "sales invoice" both contain a
                // word from "Sales Order", so first-match answered both with the
                // wrong document. Count how much of each label the question
                // actually contains, and demand a clear winner.
                // Match on STEMS, not raw words. canonicalize() runs before this
                // and normalises "sale" to "sales", so a label word like "sale"
                // stops matching the very sentence that contains it — which is
                // how "what do I need for a POS sale" ended up answered with the
                // sales chain. Trimming a trailing s on both sides makes the
                // comparison immune to that, and to ordinary plurals.
                const stem = w => w.replace(/s$/, '');
                const toks = new Set(String(t).toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
                    .split(/\s+/).filter(Boolean).map(stem));
                const flat = ' ' + [...toks].join(' ') + ' ';
                let bestEnt = null, bestScore = 0, runner = 0;
                for (const [ent, f] of Object.entries(ERP_FLOW)) {
                    const words = flowLabel(ent).toLowerCase().replace(/[()\/]/g, ' ').split(/\s+/)
                        .filter(w => w.length >= 3 && !/^(and|the|to|from|of)$/i.test(w));
                    if (!words.length) continue;
                    let hit = 0;
                    for (const w of words) if (toks.has(stem(w))) hit += w.length;
                    if (!hit) continue;
                    // the whole label appearing in order is the strongest signal
                    const phrase = words.map(stem).join(' ');
                    if (flat.includes(' ' + phrase + ' ')) hit += 20;
                    if (hit > bestScore) { runner = bestScore; bestScore = hit; bestEnt = ent; }
                    else if (hit > runner) runner = hit;
                }
                if (bestEnt && bestScore > runner) {
                    const f = ERP_FLOW[bestEnt];
                    const bits = [`<b>${f.label}</b>`];
                    if (f.parent) bits.push(`comes after the <b>${flowLabel(f.parent)}</b>, which it must be raised against`);
                    if (f.optionalParent && !f.parent) bits.push(`can be raised against the <b>${flowLabel(f.optionalParent)}</b> or on its own`);
                    if (f.gate) bits.push(`needs ${f.gate}`);
                    if (f.needs) bits.push(`needs ${f.needs}`);
                    if (f.next) bits.push(`and is followed by the <b>${flowLabel(f.next)}</b>`);
                    return { entity:null, action:'chat', fields:{}, isReady:false, newTask:false, _source:'local',
                        botResponse: bits.join(' — ') + '.' };
                }
            }
            const chain = (CHAIN_WORDS.find(([re]) => re.test(t)) || [])[1];
            if (chain) {
                return { entity:null, action:'chat', fields:{}, isReady:false, newTask:false, _source:'local',
                    botResponse:`The <b>${chain}</b> chain in VasyERP:<br>${describeChain(chain)}<br>` +
                        `<small>Say any step and I'll open it — I link each document to the one before it, ` +
                        `and I won't save a step whose parent is missing.</small>` };
            }
            // "what comes after X" for a specific document
            for (const [ent, f] of Object.entries(ERP_FLOW)) {
                const words = flowLabel(ent).replace(/[()\/]/g, ' ').split(/\s+/)
                    .filter(w => w.length >= 3 && !/^(and|the|to|from|of)$/i.test(w));
                if (!words.some(w => new RegExp('\\b' + w + '\\b', 'i').test(t))) continue;
                const bits = [`<b>${f.label}</b>`];
                if (f.parent) bits.push(`comes after the <b>${flowLabel(f.parent)}</b>, which it must be raised against`);
                if (f.optionalParent && !f.parent) bits.push(`can be raised against the <b>${flowLabel(f.optionalParent)}</b> or on its own`);
                if (f.gate) bits.push(`needs ${f.gate}`);
                if (f.needs) bits.push(`needs ${f.needs}`);
                if (f.next) bits.push(`and is followed by the <b>${flowLabel(f.next)}</b>`);
                return { entity:null, action:'chat', fields:{}, isReady:false, newTask:false, _source:'local',
                    botResponse: bits.join(' — ') + '.' };
            }
        }
    }

    // ── 0t. REPORT BY NAME — matched against the URL table's own vocabulary ──
    // Placed ahead of the document patterns on purpose: "pending sales orders"
    // is a report, but the sales-order rule below would happily open a blank
    // order form for it. Anything with a create verb is left well alone.
    {
        const isDoing = /\b(?:create|add|new|make|raise|issue|record|enter|post|pay|sell|collect|receive|transfer|adjust|approve|reject|delete|remove|edit|update)\b/i.test(t);
        // Containing a report's name is not the same as asking for it. "stock
        // adjustment notebook 5 increase" contains the alias "stock adjustment"
        // and is plainly a command, so also require either a viewing verb, a
        // reporting noun, or that the name is most of what was said.
        const viewish = /\b(?:show|view|open|get|give|fetch|display|pull|print|download|export|list|see|check)\b/i.test(t)
                     || /\b(?:report|register|summary|statement|ledger|book|analysis|outstanding|balance\s*sheet|profit\s+(?:and|&)\s+loss|p\s*&\s*l|trial\s+balance|gstr\s*-?\s*\d)\b/i.test(t);
        if (!isDoing) {
            // Stem both sides so singular/plural never decides the match —
            // "pending sales orders" has to reach "pending sales order".
            const st = w => w.replace(/s$/, '');
            const flat = ' ' + String(t).toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
                .split(/\s+/).filter(Boolean).map(st).join(' ') + ' ';
            let alias = null;
            for (const name of REPORT_NAMES) {
                const stemmed = name.split(/\s+/).map(st).join(' ');
                if (!flat.includes(' ' + stemmed + ' ')) continue;
                if (!alias || name.length > alias.length) alias = name;
            }
            const msgTokens = flat.trim().split(/\s+/).filter(Boolean).length || 1;
            const aliasTokens = alias ? alias.split(/\s+/).length : 0;
            // The redesigned dashboard answers these directly (Best/Least Selling,
            // top customers panels) — the report only when a report is asked for.
            const dashFirst = alias && /^(?:best|least)\s+selling|^top\s+customer|^category\s+(?:wise\s+)?sales/.test(alias)
                           && !/\b(?:report|register|summary|statement|analysis|detailed)\b/i.test(t);
            if (alias && !dashFirst && (viewish || aliasTokens / msgTokens >= 0.6)) {
                const range = dateRange(t) || {};
                const acct = ledgerAccount(raw, alias);
                return { entity:'Report', action:'fetch', newTask:true, isReady:true, _source:'local',
                    fields:{ reportType: alias, fromDate: range.fromDate || null, toDate: range.toDate || null,
                             ...(acct ? { account: acct } : {}) },
                    botResponse:`Opening the <b>${alias}</b> report…` };
            }
        }
    }

    // ── 0v. VINA AI — advisory questions our agent can't ACT on ──────────────
    // Division of labour: we DO things (create/edit/pay/read the screen), Vina
    // ANALYSES data and recommends. Anything asking for judgement goes to Vina,
    // and its product suggestions can be turned into a real PO afterwards.
    {
        // Turn Vina's answer into a purchase order — must beat pattern 9a
        if (/\b(?:create|make|raise)\s+(?:a\s+)?(?:purchase\s+order|po)\b.*\b(?:from|using|with|out\s+of)\s+(?:vina|this\s+list|these|that\s+list|the\s+list)\b/i.test(t)
            || /\bpo\s+from\s+vina\b/i.test(t)) {
            return { entity:'VinaPO', action:'convert', newTask:true, isReady:true, fields:{},
                botResponse:'Reading Vina’s suggestions off the page…' };
        }
        const explicitVina = /\bask\s+vina\b|\bvina\b/i.test(t);
        const advisory =
            /\b(?:should\s+i|shall\s+i|do\s+you\s+(?:recommend|suggest)|recommend|suggest|advice|advise|any\s+ideas?)\b/i.test(t)
            || /\bwhich\s+(?:products?|items?|brands?|suppliers?)\b.*\b(?:buy|stock|order|purchase|sell|focus)\b/i.test(t)
            || /\bwhat\s+(?:should|to)\b.*\b(?:buy|stock|order|sell|price)\b/i.test(t)
            || /\bwhy\s+(?:are|is|did|has|have)\b.*\b(?:sales?|profit|stock|margin|revenue|customers?)\b/i.test(t)
            || /\bhow\s+(?:can|do)\s+i\s+(?:improve|increase|reduce|grow|boost|cut)\b/i.test(t);
        if (explicitVina || advisory) {
            const qM = raw.match(/\bask\s+vina\s+(?:that\s+|about\s+)?(.+)$/i);
            const question = (qM ? qM[1] : raw).trim();
            return { entity:'Vina', action:'ask', newTask:true, isReady:true,
                fields:{ question },
                botResponse:`That's an analysis question — handing it to <b>VinaAI</b>, your data analyst…` };
        }
    }

    // ── 0b-print. "print this" / "download the pdf" / "print karo" on a document's
    // own page (/sales/invoice/<id>, /purchase/bill/<id>, /receipt/<id> …).
    {
        const pg = typeof currentPage === 'string' ? currentPage : '';
        const s = raw.trim().replace(/[.!?]+$/, '');
        if (/^\/(?:sales|purchase)\/\w+\/\d+\/?$|^\/(?:payment|receipt|stocktransfer)\/\d+\/?$/.test(pg)
            && (/^(?:please\s+)?(?:print|download|share)(?:\s+(?:this|it|that|the|a|me|copy|bill|invoice|document|doc|order|note|receipt|challan|estimate|pdf|as))*$/i.test(s)
                || /^(?:(?:give|send|show)\s+me\s+)?(?:the\s+)?pdf(?:\s+(?:of\s+)?(?:this|it))?$/i.test(s)
                || /^(?:ise|isko|iska|ye|yeh)?\s*(?:print|pdf)\s+(?:karo|kar\s*do|nikalo|chahiye|bhejo)$/i.test(s))) {
            const pdf = /\b(?:download|share|pdf)\b/i.test(s);
            return { entity:'PrintDoc', action:'print', newTask:true, isReady:true, _source:'local',
                fields: pdf ? { pdf: true } : {}, botResponse: pdf ? 'Opening the PDF…' : 'Opening the print view…' };
        }
    }

    // ── 0b-look. LOOK THINGS UP — open a document, find a contact, a party's
    // balance, stock of an item. Without an AI key every one of these ended in
    // "which one — contact, sales invoice or credit note?".
    if (!(conversationState && conversationState.entity)
        || /\b(?:stock|balance|outstanding|owe|ledger)\s+(?:of|for)\b|^(?:open|show|view|print|find|search|how\s+(?:much|many))\b|\b(?:kholo|batao|dikhao)\b/i.test(raw)) {
        // Document words → module, and this account's number prefixes when no word is given
        const DOCS = [
            [/\b(?:sales\s+)?invoices?\b|\btax\s+invoice\b/, 'SalesInvoice'], [/\bpurchase\s+orders?\b|\bpo\b/, 'PurchaseOrder'],
            [/\bmaterial\s+inward\b|\bgrn\b|\bgoods\s+receipt\b/, 'MaterialInward'], [/\bsupplier\s+bills?\b|\bpurchase\s+bills?\b/, 'SupplierBill'],
            [/\bsales\s+orders?\b|\bso\b/, 'SalesOrder'], [/\bestimates?\b|\bquotations?\b|\bquotes?\b/, 'SalesEstimate'],
            [/\bdelivery\s+challans?\b|\bchallans?\b|\bdc\b/, 'DeliveryChallan'], [/\bcredit\s+notes?\b|\bsales\s+returns?\b/, 'SalesReturn'],
            [/\bdebit\s+notes?\b|\bpurchase\s+returns?\b/, 'PurchaseReturn'], [/\bpayments?\b/, 'Payment'], [/\breceipts?\b/, 'Receipt'],
            [/\bstock\s+transfers?\b/, 'StockTransfer'], [/\bbills?\b/, 'SupplierBill'],
        ];
        const PREFIX = [[/^INV/i, 'SalesInvoice'], [/^MI\d/i, 'MaterialInward'], [/^CRD/i, 'SalesReturn'], [/^DC\d/i, 'DeliveryChallan'],
                        [/^PAY/i, 'Payment'], [/^(?:REC|RCP)/i, 'Receipt'], [/^EST/i, 'SalesEstimate'], [/^STF/i, 'StockTransfer']];
        const docRe = /^(?:please\s+)?(open|show|view|display|find|search|get|pull\s+up|print|download|pdf)\s+(?:me\s+)?(?:the\s+)?(.*?)\s*#?\s*((?=[A-Za-z\/\-]*\d)[A-Za-z][A-Za-z0-9]*(?:[\/\-][A-Za-z0-9]+)*)\s*(?:pdf|as\s+pdf)?\s*$/i;
        let dm = raw.match(docRe);
        if (dm && dm[2] !== undefined) {
            const words = dm[2].toLowerCase(), ref = dm[3].toUpperCase();
            let type = (DOCS.find(([re]) => re.test(words)) || [])[1] || null;
            if (!type && !words.trim()) type = (PREFIX.find(([re]) => re.test(ref)) || [])[1] || null;
            // "find customer X" is a contact, not a document; leave it to the contact rule
            if (type && !/\b(?:customer|client|supplier|vendor|product|item)\b/.test(words)) {
                const pdf = /^(?:download|pdf)$/i.test(dm[1]) || /\bpdf\b/i.test(raw);
                const print = pdf || /^print$/i.test(dm[1]);
                return { entity:'OpenDoc', action:'open', newTask:true, isReady:true, _source:'local',
                    fields:{ docType: type, docNumber: ref, ...(print ? { print: true } : {}), ...(pdf ? { pdf: true } : {}) },
                    botResponse:`${print ? 'Opening' : 'Finding'} ${ref}…` };
            }
        }
        // "search product Notebook1" / "find item Blue Pen" / "look up product PP10955"
        const prodM = raw.match(/^(?:please\s+)?(?:find|search(?:\s+for)?|look\s+up|lookup)\s+(?:the\s+)?(?:products?|items?)\s+(.+?)\s*$/i);
        if (prodM && !/\b(?:list|all)\b/i.test(prodM[1])) {
            return { entity:'Product', action:'search', newTask:true, isReady:true, _source:'local',
                fields:{ searchQuery: prodM[1].trim() }, botResponse:`Looking up ${prodM[1].trim()}…` };
        }
        // "find customer Gupta Stores" / "search supplier Sharma" / "show customer 98…"
        let cm = raw.match(/^(?:please\s+)?(?:find|search(?:\s+for)?|look\s+up|lookup|show|open)\s+(?:the\s+)?(customer|client|supplier|vendor|transporter)s?\s+(.+?)\s*$/i);
        if (cm && !/\b(?:list|all)\b/i.test(cm[2])) {
            return { entity:'Contact', action:'search', newTask:true, isReady:true, _source:'local',
                fields:{ searchQuery: cm[2].trim(), contactType: /supplier|vendor/i.test(cm[1]) ? 'Supplier' : /transport/i.test(cm[1]) ? 'Transport' : 'Customer' },
                botResponse:`Looking up ${cm[2].trim()}…` };
        }
        // a party's balance — "how much does Gupta Stores owe", "balance of X", "do I owe Sharma Textiles"
        let pm = raw.match(/^(?:what(?:'s|\s+is)\s+(?:the\s+)?|show\s+(?:me\s+)?(?:the\s+)?|check\s+(?:the\s+)?)?(?:balance|outstanding|due(?:\s+amount)?|dues|pending\s+amount|ledger)\s+(?:of|for)\s+(?:customer\s+|supplier\s+)?(.+?)\s*\??\s*$/i)
              || raw.match(/^how\s+much\s+(?:does|do|did)\s+(.+?)\s+(?:owe|have\s+to\s+pay)(?:\s+(?:me|us))?\s*\??\s*$/i)
              || raw.match(/^how\s+much\s+(?:do\s+)?(?:i|we)\s+(?:owe|have\s+to\s+pay)\s+(?:to\s+)?(.+?)\s*\??\s*$/i)
              || raw.match(/^(?:is|are)\s+(.+?)\s+(?:due|pending|owing)\s*\??\s*$/i)
              || raw.match(/^(.+?)(?:'s)?\s+(?:balance|outstanding|dues|ledger)\s*\??\s*$/i)
              // "what is Sharma Textiles pending" · "how much is pending from Gupta Stores"
              || raw.match(/^(?:what(?:'s|\s+is)\s+|how\s+much\s+is\s+)(.+?)\s+(?:pending|due|outstanding)\s*\??\s*$/i)
              || raw.match(/^(?:what(?:'s|\s+is)\s+|how\s+much\s+is\s+)?(?:pending|due|outstanding)\s+(?:from|with|to)\s+(.+?)\s*\??\s*$/i)
              // Hinglish: "Sharma Textiles ka kitna baki hai" · "Gupta Stores ka hisaab batao" ·
              // "Gupta Stores se kitna lena hai" · "Sharma Textiles ko kitna dena hai"
              || raw.match(/^(.+?)\s+(?:ka|ki|ke)\s+(?:kitna\s+|kitne\s+)?(?:baki|baaki|bakaya|udhaar|udhar|hisaab|hisab|khata|balance|due|pending)(?:\s+(?:kitna|kitne))?(?:\s+(?:hai|hain|he|batao|bataao|dikhao))?\s*\??\s*$/i)
              || raw.match(/^(.+?)\s+(?:se|say)\s+(?:kitna|kitne)\s+(?:paise\s+|paisa\s+)?(?:lena|lene)\s+(?:hai|he|hain)\s*\??\s*$/i)
              || raw.match(/^(.+?)\s+(?:ko|ku)\s+(?:kitna|kitne)\s+(?:paise\s+|paisa\s+)?(?:dena|dene)\s+(?:hai|he|hain)\s*\??\s*$/i);
        if (pm && !/^(?:my|the|total|all|today|bank|cash|opening|closing|stock|customer|supplier|account|aaj|kal|is|iss|mera|meri|mere|hamara|hamari|sab|sabka|kul)\b/i.test(pm[1].trim())
               && !/\b(?:report|sheet|book|register|trial)\b/i.test(pm[1])) {
            const who = pm[1].trim().replace(/^(?:customer|supplier)\s+/i, '').replace(/\s+(?:ka|ki|ke)$/i, '');
            const ledger = /\bledger\b/i.test(raw);
            return { entity:'PartyBalance', action:'view', newTask:true, isReady:true, _source:'local',
                fields:{ partyName: who, ...(ledger ? { ledger: true } : {}) },
                botResponse:`Checking ${who}'s balance…` };
        }
        // stock of an item — "stock of Notebook1", "how many PP10955 do I have", "Notebook1 stock"
        let sm = raw.match(/^(?:what(?:'s|\s+is)\s+(?:the\s+)?|show\s+(?:me\s+)?(?:the\s+)?|check\s+(?:the\s+)?)?(?:stock|qty|quantity|inventory)\s+(?:of|for)\s+(.+?)\s*\??\s*$/i)
              || raw.match(/^how\s+(?:many|much)\s+(.+?)\s+(?:do\s+(?:i|we)\s+have|(?:is|are)\s+(?:there\s+)?(?:in\s+stock|left|available))(?:\s+in\s+stock)?\s*\??\s*$/i)
              || raw.match(/^(?:is|are)\s+(.+?)\s+(?:in\s+stock|available)\s*\??\s*$/i)
              // "what's left of notebook1 (in the store)" · "how much notebook1 is remaining"
              || raw.match(/^(?:what(?:'s|\s+is)\s+|how\s+(?:many|much)\s+(?:is\s+|are\s+)?)?(?:left|remaining|balance)\s+(?:of|in)\s+(.+?)(?:\s+(?:in|at)\s+(?:the\s+)?(?:store|shop|godown|warehouse|stock))?\s*\??\s*$/i)
              || raw.match(/^how\s+(?:many|much)\s+(.+?)\s+(?:is|are)\s+(?:left|remaining)(?:\s+(?:in|at)\s+(?:the\s+)?(?:store|shop|godown|warehouse|stock))?\s*\??\s*$/i)
              || raw.match(/^(?!(?:do|does|is|are|any|how)\s)([A-Za-z][\w .\-]{1,40}?)\s+stock\s*\??\s*$/i)
              // "any notebook1 sitting in the godown" · "is there any PP10955 left" · "do we have Notebook1 in stock"
              || raw.match(/^(?:any|is\s+there\s+(?:any\s+)?|are\s+there\s+(?:any\s+)?)(.+?)\s+(?:sitting|lying|kept|left|remaining|available|in\s+stock)(?:\s+around)?(?:\s+(?:in|at)\s+(?:the\s+|my\s+|our\s+)?(?:godown|store|shop|warehouse|stock|inventory))?\s*\??\s*$/i)
              || raw.match(/^do\s+(?:i|we)\s+(?:still\s+)?have\s+(?:any\s+)?(.+?)\s+(?:in\s+stock|left|(?:in|at)\s+(?:the\s+)?(?:godown|store|shop|warehouse))\s*\??\s*$/i)
              // Hinglish: "notebook1 kitna bacha hai" · "kitna notebook1 pada hai" · "notebook1 ka stock kitna hai"
              || raw.match(/^(.+?)\s+(?:kitna|kitne|kitni)\s+(?:bacha|bache|bachi|pada|pade|padi|stock\s+(?:me\s+|mein\s+)?)(?:\s*(?:hai|hain|he))?\s*\??\s*$/i)
              || raw.match(/^(?:kitna|kitne|kitni|how\s+(?:much|many))\s+(.+?)\s+(?:bacha|bache|bachi|pada|pade|padi)(?:\s+(?:hai|hain|he))?\s*\??\s*$/i)
              || raw.match(/^(.+?)\s+ka\s+stock(?:\s+(?:kitna|kya)\s+(?:hai|he))?\s*\??\s*$/i);
        if (sm && !/^(?:please\s+)?(?:enable|disable|turn|switch|allow|toggle|activate|deactivate|hide|set|is\s+\w+\s+(?:on|off))\b/i.test(raw)
               && !/\b(?:negative|setting|switch)\b/i.test(sm[1])
               // money / documents are never "an item": "do we have pending bills", "bank me kitna pada hai"
               && !/\b(?:bills?|invoices?|orders?|payments?|dues?|customers?|suppliers?|money|balance|pending|sales?|purchases?|returns?|expenses?|receipts?|vouchers?|bank|cash|paisa|paise|rupaye|profit|munafa|bikri|kharcha|udhaar|udhar|baki|baaki|khata|hisaab|hisab)\b/i.test(sm[1])
               && !/^(?:low|my|total|all|the|out\s+of|opening|closing|negative|dead|zero)\b/i.test(sm[1].trim())
               && !/\b(?:report|movement|summary|register|transfer|adjustment|verification|value)\b/i.test(sm[1])) {
            return { entity:'StockQuery', action:'view', newTask:true, isReady:true, _source:'local',
                fields:{ itemName: sm[1].trim() }, botResponse:`Checking stock of ${sm[1].trim()}…` };
        }
        // the till: closing it needs the cashier's own cash count
        if (/^(?:please\s+)?(?:close|end|shut)\s+(?:the\s+|my\s+)?(?:sales\s+)?(?:register|till|shift|counter|day)\b/i.test(raw)) {
            return { entity:'SalesRegister', action:'list', newTask:true, isReady:true, _source:'local', fields:{ note: 'close' },
                botResponse:`Opening the sales register — closing the till needs your cash count, so you confirm it there.` };
        }
    }

    // ── 0c. PAGE / DASHBOARD / REPORT Q&A ────────────────────────────────────
    // "total sales yesterday", "best selling this month", "my Total Products",
    // "switch FY to 2024-25" → content_agent drives the dashboard period picker /
    // FY dropdown and reads the answer off the page. Zero AI calls.
    {
        const DASH_METRIC_RE = /\b(total\s+(sales(\s+returns?)?|invoices?|customers?|suppliers?|purchases?(\s+returns?)?|bills?|products?|expenses?|paid)|sold\s+(qty|quantity)|purchase\s+(qty|quantity)|to\s+(pay|receive)|stock\s+(qty|quantity|value)|cash\s+in\s+hand|gross\s+(profit|margin)|avg\.?\s+(profit\s+margin|cart\s+value|bills?)|average\s+(profit|cart|basket|bills?)|profit\s+margin|basket\s+size|bank\s+accounts?|vip\s+customers?|risk\s+customers?|lost\s+customers?|regular\s+customers?|top\s+(\d+\s+)?(customers?|expenses?|coupons?)|(best|least)\s+selling|today'?s?\s+(receivable|payable)|login\s+log|category\s+sales|announcements?|payment\s+modes?|mode\s+of\s+payment|how\s+(?:did|do)\s+(?:customers?|people)\s+pay|receivables?|payables?|who\s+owes|ageing|aging|customer\s+(?:insight|segments?)|champions?|loyal\s+customers?|at\s+risk|hibernating|can'?t\s+lose|needs\s+attention|potential\s+loyalists?|promising\s+customers?|sales\s+breakdown|category[\s-]*wise|sales\s+(?:vs|versus|and)\s+purchases?|sales\s+trend|purchase\s+trend|slow[\s-]*moving|fast[\s-]*moving|avg\.?\s+bill\s+(?:no|number|count)|cart\s+value|business\s+health|\bbhi\b|health\s+(?:index|indicator|score)|how\s+healthy|targets?\s+(?:vs\.?|versus|and)\s+actuals?|top\s+products?)\b/i;
        // Date periods → daterangepicker's exact data-range-key values
        const PERIODS = [
            [/\byesterday\b/i,                                   'Yesterday'],
            [/\btoday\b/i,                                       'Today'],
            [/\bthis\s+week\b/i,                                 'This Week'],
            [/\blast\s+week\b/i,                                 'Last Week'],
            [/\blast\s+month\b|\bprevious\s+month\b/i,            'Last Month'],
            [/\bthis\s+month\b/i,                                'This Month'],
            [/\blast\s+15\s+days\b/i,                            'Last 15 Days'],
            [/\b(last\s+30\s+days|past\s+month)\b/i,             'Last 30 Days'],
            [/\bthis\s+quarter\b/i,                              'This Quarter'],
            [/\blast\s+quarter\b/i,                              'Last Quarter'],
            [/\b(this\s+(financial\s+year|fy|year)|current\s+fy)\b/i, 'This Financial Year'],
            [/\b(last\s+(financial\s+year|fy|year)|previous\s+fy)\b/i,'Last Financial Year'],
        ];
        // "today's payable/receivable" are dashboard TABLE NAMES, not date periods —
        // don't let the word "today" hijack them into a period switch.
        const isNamedTodayTable = /today'?s?\s+(payable|receivable)/i.test(t);
        const period = isNamedTodayTable ? null : ((PERIODS.find(([re]) => re.test(t)) || [])[1] || null);
        // Explicit FY year → header FY dropdown ("fy 2024-25", "financial year 2024")
        const fyM = t.match(/\b(?:fy|financial\s+year)\s*(?:to\s*)?(20\d{2})(?:\s*[-\/]\s*(?:20)?(\d{2}))?/i);
        const fySwitch = fyM ? `${fyM[1]}-${fyM[2] ? (fyM[2].length === 2 ? '20' + fyM[2] : fyM[2]) : String(Number(fyM[1]) + 1)}` : null;
        const fyCommand = fySwitch && /\b(change|switch|set|go\s+to|use)\b/i.test(t);

        const qaCue = /^(what|what's|whats|how\s+(much|many)|who|whose|which|show|tell|give|list|any|my)\b/i.test(raw.trim()) || /\?\s*$/.test(raw.trim());
        const metricCue = /\b(sales?|purchases?|profit|loss|margin|revenue|turnover|customers?|suppliers?|products?|stock|invoices?|bills?|expenses?|receivables?|payables?|to\s+pay|to\s+receive|outstanding|due|cash|bank|top|best|least|selling|announcements?|version|gross|avg|average|cart|basket|qty|sold|receivable|payable)\b/i.test(t);
        const actionCue = /\b(create|add|make|sell|edit|update|delete|remove|generate|record|adjust|increase|decrease|collect|pay|paid|receive|received|transfer|move|order|return)\b/i.test(t)
                       && !/^(how|what|which|who|whom|when|where|did|do|does|is|are)\b/i.test(raw.trim())   // a question about paying is not a payment
                       && !fyCommand; // "set FY…" is ours, not a create action
        const isDashMetric = DASH_METRIC_RE.test(t);
        const shortPhrase  = raw.trim().split(/\s+/).length <= 10;
        // "is <X> switch on?" is a SETTINGS question (pattern 9s), not page Q&A
        const settingCue = /\b(switch|setting|enabled?|disabled?)\b/i.test(t);
        // On the dashboard, a "show/what/which…" question is about what's on it —
        // including panels VasyERP adds later that no vocabulary here knows yet.
        const onDash = /^\/dashboard/.test(typeof currentPage === 'string' ? currentPage : '');
        // a re-ask after the dashboard reader found nothing for this question skips this tier
        if (!_parseFlags.noDashQA && !actionCue && !settingCue && (fyCommand || (qaCue && metricCue) || (isDashMetric && shortPhrase) || (metricCue && period && shortPhrase)
                                          || (onDash && qaCue && shortPhrase && !/\b(?:report|setting|vina)\b/i.test(t)))) {
            return { entity:'PageQA', action:'query', newTask:true, isReady:true,
                fields:{ question: raw.trim(), wantsDashboard: isDashMetric || !!period || !!fySwitch,
                         ...(period ? { period } : {}), ...(fySwitch ? { fySwitch } : {}) },
                botResponse: fyCommand ? `📅 Switching to FY ${fySwitch}…` : '🔎 Fetching it live…' };
        }
    }

    // ── 0b. MULTI-ACTION: create customer + POS sale ─────────────────────────
    // "create customer XYZ 9876543210 and sell him shinchan mouse pad 2 cash"
    const andSellM = raw.match(
        /\b(?:create|add|new)\s+(?:a\s+)?(?:customer|client)\s+([A-Za-z][A-Za-z .']{0,40}?)(?:\s+(\d{10}))?\s+and\s+(?:sell|pos\s+sale?|add)\s+(?:him|her|them)?\s*(.+?)(?:\s+(?:via|with|payment|pay(?:ment\s+mode)?)\s+(.+?))?$/i
    );
    if (andSellM) {
        const custName  = andSellM[1]?.trim();
        const custMob   = andSellM[2] || getMob(t);
        const itemPart  = andSellM[3]?.trim() || '';
        const payPart   = andSellM[4] || '';
        const pm        = getPay(payPart + ' ' + itemPart);
        const q         = getQty(itemPart) || 1;
        const itemName  = itemPart.replace(/\b\d+\s*(?:pc|units?|nos?|qty|pieces?)\b/i,'').replace(/\b(cash|upi|card|neft|cheque)\b/i,'').trim();
        const parts     = (custName||'').split(/\s+/);
        return { entity:'Contact', action:'create', newTask:true, isReady:true,
            tasks:[
                { entity:'Contact', action:'create', fields:{ firstName:parts[0]||null, lastName:parts.slice(1).join(' ')||null, contactType:'Customer', mobile:custMob } },
                { entity:'POSSale', action:'create', fields:{ itemName, qty:q, paymentMode:pm||'Cash', customerName:custName, customerMobile:custMob } }
            ],
            fields:{ firstName:parts[0]||null, contactType:'Customer', mobile:custMob },
            botResponse:`Creating customer ${custName||''} then selling ${itemName||'product'}…` };
    }

    // ── 0m. SETUP MASTERS — one generic shape for every "New → name → Save"
    // page (UOM, Tax, Prefix, Payment Terms, Charges, Account, Bank…). Runs
    // BEFORE Contact so "create customer category Wholesale" isn't read as a
    // customer named "category Wholesale".
    {
        const SETUP = [
            ['UnitOfMeasurement', 'unit\\s+of\\s+measurement|uom|unit'],
            ['CustomerCategory',  'customer\\s+categor(?:y|ies)'],
            ['ConsumptionType',   'consumption\\s+type'],
            ['AccountGroup',      'account\\s+group'],
            ['PaymentTerms',      'payment\\s+term'],
            ['PurchaseTerms',     'purchase\\s+term'],
            ['SalesTerms',        'sales\\s+term'],
            ['AdditionalCharges', 'additional\\s+charge|extra\\s+charge'],
            ['Prefix',            'prefix'],
            ['Tax',               'tax(?:\\s+rate|\\s+slab)?'],
            ['Bank',              'bank(?:\\s+account)?'],
            ['Account',           'account(?:\\s+ledger)?|ledger'],
        ];
        for (const [entity, kw] of SETUP) {
            const re = new RegExp(`\\b(?:create|add|new)\\s+(?:a\\s+|an\\s+)?(?:${kw})\\b`, 'i');
            if (!re.test(t)) continue;
            // "bank reconciliation" / "bank transaction" are their own flows, not the Bank master
            if (entity === 'Bank' && /reconcil|transaction|transfer|deposit|withdraw/i.test(t)) break;
            let nm    = nameAfter(raw, kw);
            const pct = (raw.match(/\b(\d+(?:\.\d+)?)\s*%/) || [])[1] || null;
            // Trailing bare number ("create tax GST 18") counts as the value
            const bare = (raw.match(/\s(\d+(?:\.\d+)?)\s*$/) || [])[1] || null;
            const val = pct || getAmt(raw) || bare;
            const spec = SIMPLE_MASTERS[entity];
            if (entity === 'UnitOfMeasurement') {
                // "create uom Crate uqc OTH" — the GST unit code travels separately
                const uq = raw.match(/\buqc(?:\s+code)?\s+([A-Za-z]{2,5}(?:-[A-Za-z ]+)?)\b/i);
                if (uq) {
                    if (nm) nm = nm.replace(/\s+uqc\b.*$/i, '').trim();
                    return { entity, action:'create', newTask:true, fields:{ ...(nm ? { name: nm } : {}), uqc: uq[1].toUpperCase() },
                             isReady: !!nm, botResponse: nm ? `Creating unit “${nm}” (UQC ${uq[1].toUpperCase()})…` : 'Unit name?' };
                }
            }
            if (entity === 'Bank') {
                // "create bank account HDFC Current branch Andheri account no 50100123"
                const brM = raw.match(/\bbranch(?:\s+name)?\s+([A-Za-z][A-Za-z0-9 .&'\-]{1,40}?)(?=\s+(?:a\/c|ac|account|acc|ifsc|holder)\b|\s*,|\s*$)/i);
                const acM = raw.match(/\b(?:a\/c|ac|acc(?:ount)?)\s*(?:no\.?|number|#)?\s*[:#]?\s*(\d{6,20})\b/i) || raw.match(/\b(\d{9,20})\b/);
                const ifM = raw.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/i);
                let bn = nm ? nm.replace(/\s+branch\b.*$/i, '').replace(/\s+(?:a\/c|ac|account)\b.*$/i, '').trim() : nm;
                const f = { ...(bn ? { name: bn } : {}), ...(brM ? { branchName: brM[1].trim() } : {}),
                            ...(acM ? { accountNo: acM[1] } : {}), ...(ifM ? { ifsc: ifM[1].toUpperCase() } : {}) };
                const need = !bn ? 'Bank name?' : !f.branchName ? `Which <b>branch</b> is ${bn} at? (Branch name is compulsory)`
                           : !f.accountNo ? `And the <b>account number</b> for ${bn}? (compulsory)` : null;
                return { entity, action:'create', newTask:true, fields: f, isReady: !need,
                         botResponse: need || `Creating bank account “${bn}” (${f.branchName}, a/c ${f.accountNo})…` };
            }
            // "create payment term Net 45": the number is part of the name AND the
            // number of days — a term called just "Net" is not what was asked for.
            if (nm && bare && /Terms$/.test(entity) && !new RegExp('\\b' + bare + '\\b').test(nm)) nm = nm + ' ' + bare;
            return { entity, action:'create', newTask:true,
                fields:{ ...(nm ? { name: nm } : {}), ...(val ? { value: String(val) } : {}) },
                isReady: !!nm,
                botResponse: nm ? `Creating ${spec.title} “${nm}”${val ? ` (${val})` : ''}…`
                                : `${spec.title} name?` };
        }
    }

    // A number right after a contact's name is part of it — "Test Vendor 837",
    // "Shop 24" — unless it is the 10-digit mobile or a quantity/amount.
    const withNum = (src, nm) => {
        if (!nm) return nm;
        const i = src.indexOf(nm); if (i < 0) return nm;
        const m = src.slice(i + nm.length).match(/^\s+(\d{1,5})(?=\s|,|$)(?!\s*(?:%|percent|days?|rs\b|₹|pcs?\b|qty|units?\b|kg\b))/i);
        return m ? nm + ' ' + m[1] : nm;
    };

    // ── 1. CONTACT — create customer ─────────────────────────────────────────
    if (/\b(?:create|add|new)\s+(?:a\s+)?(?:new\s+)?(?:customer|client)\b(?!\s+(?:invoices?|receipts?|returns?|orders?|ledger|outstanding|categor(?:y|ies)|feedback|payments?|credit|debit)\b)/.test(t)) {
        const name   = withNum(raw, nameAfter(raw, 'customer|client'));
        const mobile = getMob(t);
        const gstin  = (raw.match(/\b(\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z])\b/i)||[])[1]||null;
        const parts  = (name||'').split(/\s+/);
        return { entity:'Contact', action:'create', newTask:true, fields:{ firstName:parts[0]||null, lastName:parts.slice(1).join(' ')||null, contactType:'Customer', mobile, gstin },
            isReady:!!name, botResponse:!name?"What's the customer's name?":`Creating customer ${name}…` };
    }

    // ── 2. CONTACT — create supplier ─────────────────────────────────────────
    // "create supplier bill / payment / return …" is a document, not a contact
    if (/\b(?:create|add|new)\s+(?:a\s+)?(?:new\s+)?(?:supplier|vendor)\b(?!\s+(?:bills?|payments?|returns?|invoices?|orders?|ledger|outstanding|credit|debit)\b)/.test(t)) {
        const name   = withNum(raw, nameAfter(raw, 'supplier|vendor'));
        const mobile = getMob(t);
        const parts  = (name||'').split(/\s+/);
        return { entity:'Contact', action:'create', newTask:true, fields:{ firstName:parts[0]||null, lastName:parts.slice(1).join(' ')||null, companyName:name||null, contactType:'Supplier', mobile },
            isReady:!!name, botResponse:!name?"What's the supplier/business name?":`Creating supplier ${name}…` };
    }

    // ── 3. EMPLOYEE — create ─────────────────────────────────────────────────
    if (/\b(?:create|add|new)\s+(?:a\s+)?employee\b/.test(t)) {
        const name   = nameAfter(raw, 'employee');
        const mobile = getMob(t);
        const roleM  = raw.match(/\brole\s+(?:of\s+|as\s+)?([A-Za-z][A-Za-z\s]{1,25}?)(?=\s*,|\s+(?:user\s*name|username|login|password|pass|mobile|and)\b|$)/i);
        const role   = roleM ? roleM[1].trim() : null;
        // Role lives inside the login section on the redesigned Employee page, so a
        // role implies a login. Capture the credentials the user dictated; NEVER
        // invent a password — createEmployee asks for one instead.
        const userM  = raw.match(/\b(?:user\s*name|username|login)\s+(?:is\s+)?([A-Za-z0-9._@-]{2,40})/i);
        const passM  = raw.match(/\b(?:password|passcode|pass)\s+(?:is\s+)?(\S{4,40})/i);
        const username = userM ? userM[1].trim() : null;
        const password = passM ? passM[1].trim() : null;
        const parts  = (name||'').split(/\s+/);
        return { entity:'Employee', action:'create', newTask:true,
            fields:{ firstName:parts[0]||null, lastName:parts.slice(1).join(' ')||null, mobile, role,
                     ...(username?{username}:{}), ...(password?{password}:{}) },
            isReady:!!(name&&mobile&&(!role||password)),
            botResponse:!name?'Employee name?':!mobile?`${parts[0]}'s mobile?`
                       :(role&&!password)?`What password should ${parts[0]} log in with? <small>(a role needs a login)</small>`
                       :`Creating employee ${name}…` };
    }

    // ── 3x. POS RETURN — look the bill up before returning it ────────────────
    // "return pos bill GGN/26-27/DLF/100079" / "what's on bill X"
    // ── RETURNS: which way are the goods moving? ─────────────────────────────
    // Goods going back TO a supplier is a debit note (purchase return); goods
    // coming back FROM a customer is a credit note (sales return). Both sentences
    // say "return" and both quote a bill number, so the preposition and the party
    // are the only reliable signal — and getting it backwards posts the money to
    // the wrong side of the ledger. canonicalize() has already folded
    // "purchase return" to "debit note" and "sales return" to "credit note".
    if (/\bdebit\s*note\b/.test(t) ||
        (/\breturn\b/.test(t) && /\b(?:to|from)\s+(?:the\s+)?(?:supplier|vendor)\b/.test(t)) ||
        (/\breturn\b/.test(t) && /\b(?:goods?|items?|material|stock|parts?)\b/.test(t) && /\bto\s+[A-Za-z]/.test(t)) ||
        /\breturn(?:ing)?\s+\d{1,6}(?:\.\d+)?\s*[A-Za-z][\w\-' ]{0,40}?\s+(?:back\s+)?to\s+(?!stock\b|inventory\b|warehouse\b|store\b)[A-Za-z]/i.test(raw)) {
        let party = nameAfter(raw, '(?:back\\s+)?to') || nameAfter(raw, 'for') || nameAfter(raw, 'from');
        // "for Gupta Stores 1 Notebook1 m" — party, then qty + product
        let rItem = null, rQty = null;
        if (party) {
            const sp = party.match(/^(.*?[A-Za-z.])\s+(\d{1,6}(?:\.\d+)?)\s+([A-Za-z][A-Za-z0-9\s\-']{0,40})$/);
            if (sp) { party = sp[1].trim(); rQty = parseFloat(sp[2]); rItem = sp[3].trim(); }
        }
        const refM  = raw.match(/\b(?:bill|invoice|grn|po)\s*(?:no\.?|number)?\s*[:#]?\s*([\w\/-]{3,30})/i)
                   || raw.match(/\b((?:BIL|PO|GRN|MI)[-#]?\w*\d+[\w-]*)\b/i);
        const ref   = refM ? refM[1].trim().toUpperCase() : null;
        if (!rItem) { const rl = returnLine(raw, refM); if (rl) { rItem = rl.item; rQty = rl.qty; } }
        return { entity:'PurchaseReturn', action:'create', newTask:true,
            fields:{ ...(party?{supplierName:party}:{}), ...(ref?{billNumber:ref}:{}),
                     ...(rItem?{itemName:rItem}:{}), ...((getQty(t)||rQty)?{qty:getQty(t)||rQty}:{}) },
            isReady: !!party,      // no bill named → the form lists this supplier's bills as taps
            botResponse: !party ? 'Which supplier are the goods going back to?'
                       : !ref   ? `Opening a debit note to ${party} — I'll list their bills to pick from…`
                       : `Raising a debit note to ${party} against ${ref}…` };
    }
    if (/\bcredit\s*note\b/.test(t) ||
        (/\breturn(?:ed)?\b/.test(t) && /\bfrom\s+(?:the\s+)?(?:customer|buyer|client)\b/.test(t))) {
        let party = nameAfter(raw, 'from') || nameAfter(raw, 'for');
        // "for Gupta Stores 1 Notebook1 m" — party, then qty + product
        let rItem = null, rQty = null;
        if (party) {
            const sp = party.match(/^(.*?[A-Za-z.])\s+(\d{1,6}(?:\.\d+)?)\s+([A-Za-z][A-Za-z0-9\s\-']{0,40})$/);
            if (sp) { party = sp[1].trim(); rQty = parseFloat(sp[2]); rItem = sp[3].trim(); }
        }
        const refM  = raw.match(/\b(?:invoice|bill)\s*(?:no\.?|number)?\s*[:#]?\s*([\w\/-]{3,30})/i)
                   || raw.match(/\b((?:INV|TEST)[-#]?\w*\d+[\w-]*)\b/i);
        const ref   = refM ? refM[1].trim().toUpperCase() : null;
        if (!rItem) { const rl = returnLine(raw, refM); if (rl) { rItem = rl.item; rQty = rl.qty; } }
        return { entity:'SalesReturn', action:'create', newTask:true,
            fields:{ ...(party?{customerName:party}:{}), ...(ref?{invoiceNumber:ref}:{}),
                     ...(rItem?{itemName:rItem}:{}), ...((getQty(t)||rQty)?{qty:getQty(t)||rQty}:{}) },
            isReady: !!party,      // no invoice named → the form lists this customer's invoices as taps
            botResponse: !party ? 'Which customer is returning?'
                       : !ref   ? `Opening a credit note for ${party} — I'll list their invoices to pick from…`
                       : `Raising a credit note for ${party} against ${ref}…` };
    }

    // The supplier- and customer-return rules above already claimed anything with
    // a direction, so what reaches here is either explicitly about the counter or
    // names no party at all — and a bare "refund bill 123" is a counter refund.
    if ((/\breturn\b|\brefund\b/.test(t)) && /\bpos\b|\bbill\b|\breceipt\b|\bcounter\b|\btill\b/.test(t)) {
        const refM = raw.match(/\b([A-Z]{2,}[\w\/-]*\d{2,})\b/)
                  || raw.match(/\b(?:bill|receipt|invoice)\s*(?:no\.?|number)?\s*[:#]?\s*([\w\/-]{4,30})/i);
        const ref = refM ? refM[1].trim() : null;
        return { entity:'POSReturn', action:'lookup', newTask:true,
            fields:{ ...(ref ? { billNumber: ref } : {}) },
            isReady: !!ref,
            botResponse: ref ? `Looking up POS bill ${ref}…` : 'Which POS bill number? (it\'s on the receipt)' };
    }

    // ── 3y. LOGS (/logs) — five tabs, read-only audit trail ──────────────────
    // "who changed the settings" / "show user activity log" / "sms log"
    if (/\blogs?\b/.test(t) || /\bwho\s+(?:changed|enabled|disabled|logged\s*in|did)\b/.test(t)) {
        const LT = [[/setting|switch|config/i,'settings'], [/user\s*activity|login|logged\s*in|staff|who\s+did/i,'user activity'],
                    [/system|error/i,'system'], [/loyalty|points?/i,'loyalty'], [/sms|message/i,'sms']];
        const lt = (LT.find(([re]) => re.test(t)) || [])[1] || null;
        return { entity:'Logs', action:'view', newTask:true,
            fields:{ ...(lt ? { logType: lt } : {}), question: raw },
            isReady: true,
            botResponse: lt ? `Opening the ${lt} log…` : 'Opening Logs…' };
    }

    // ── 3z. TALLY EXPORT (/tally) — 14 datasets, each a "Download XML" ───────
    // "export sales to tally" / "download ledgers tally xml"
    if (/\btally\b/.test(t)) {
        const dsM = raw.match(/\b(?:export|download|send|push|get)\s+(?:the\s+)?([A-Za-z][A-Za-z ]{2,28}?)\s+(?:to|into|for|from)?\s*tally\b/i)
                 || raw.match(/\btally\s+(?:xml\s+)?(?:for|of)\s+([A-Za-z][A-Za-z ]{2,28})/i);
        const ds = dsM ? dsM[1].replace(/\b(data|xml|file)\b/ig, '').trim() : null;
        return { entity:'Tally', action:'export', newTask:true,
            fields:{ ...(ds ? { dataset: ds } : {}) },
            isReady: true,
            botResponse: ds ? `Exporting ${ds} to Tally…` : 'Opening the Tally export page…' };
    }

    // ── 3a. BARCODE / LABEL PRINTING (/barcodeutility) ───────────────────────
    // "print barcodes for shinchan mouse pad 20 labels print type A4"
    if (/\b(?:print|generate|make)\b/.test(t) && /\bbarcodes?\b|\blabels?\b/.test(t)
        && !/\bsettings?\b|\bprefix\b|\bauto\s*generate\b/.test(t)) {
        const itemM = raw.match(/\b(?:for|of)\s+([A-Za-z0-9][A-Za-z0-9 \-]{1,40}?)(?=\s+(?:\d|qty|labels?|print\s*type|on\s+a4|template)|\s*$)/i);
        const qty   = getQty(t) || (raw.match(/\b(\d+)\s*labels?\b/i) || [])[1] || null;
        const ptM   = raw.match(/\b(?:print\s*type\s*|on\s+)?\b(\d\s*ups|a4|a5)\b/i);
        const tplM  = raw.match(/\btemplate\s+([A-Za-z0-9][A-Za-z0-9 _\-]{1,30})/i);
        const srcM  = raw.match(/\bfrom\s+(purchase|stock\s*transfer|material\s*creation|bill\s*of\s*materials?)\b/i);
        return { entity:'BarcodeLabels', action:'print', newTask:true,
            fields:{ ...(itemM?{itemName:itemM[1].trim()}:{}), ...(qty?{qty:String(qty)}:{}),
                     ...(ptM?{printType:ptM[1].replace(/\s+/g,' ').toUpperCase()}:{}),
                     ...(tplM?{template:tplM[1].trim()}:{}), ...(srcM?{source:srcM[1]}:{}) },
            isReady: true,
            botResponse: itemM ? `Queueing labels for ${itemM[1].trim()}…` : 'Opening Barcode / Labels…' };
    }

    // ── 3b. LOYALTY EARN RATE — the one thing the Loyalty page really configures
    // "set loyalty earn rate 10 points per 100" / "1 point for every 50 rupees"
    if (/\bloyalty\b|\bpoints?\b/.test(t) &&
        /\b(?:earn(?:ing)?\s*rate|points?\s+per|points?\s+for\s+(?:every|each)|per\s+rupee)\b/.test(t)) {
        const m = raw.match(/(\d+(?:\.\d+)?)\s*points?\s*(?:per|for|=|:)\s*(?:every\s+|each\s+)?(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)/i)
               || raw.match(/(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:rupees?)?\s*(?:=|per|for)\s*(\d+(?:\.\d+)?)\s*points?/i);
        const pt  = m ? m[1] : null, amt = m ? m[2] : null;
        return { entity:'Loyalty', action:'earnrate', newTask:true,
            fields:{ ...(pt?{earnPoint:pt}:{}), ...(amt?{earnAmount:amt}:{}) },
            isReady: !!(pt && amt),
            botResponse: (pt && amt) ? `Setting the earn rate: ${pt} point${pt==='1'?'':'s'} per ₹${amt}…`
                                     : 'Tell me the rate, e.g. <i>"10 points per ₹100"</i>.' };
    }

    // ── 4. LOYALTY — check points ────────────────────────────────────────────
    if (/\b(?:check|view|see|show)\s+(?:loyalty\s+)?points?\s+(?:for|of)\b/.test(t) || /\bcheck\s+(?:loyalty|points?)\b/.test(t)) {
        const mobile = getMob(t);
        return { entity:'Loyalty', action:'check', newTask:true, fields:{ customerMobile:mobile },
            isReady:!!mobile, botResponse:!mobile?"Which customer's mobile?":`Checking points for ${mobile}…` };
    }

    // ── 5. LOYALTY — add points ──────────────────────────────────────────────
    if (/\b(?:add|give|earn|credit)\s+\d+\s+(?:loyalty\s+)?points?\b/.test(t)) {
        const mobile = getMob(t);
        const pts    = parseInt((t.match(/(\d+)\s+(?:loyalty\s+)?points?/)||[])[1]);
        return { entity:'Loyalty', action:'adjust', newTask:true, fields:{ customerMobile:mobile, points:pts||null, adjustType:'Add' },
            isReady:!!(mobile&&pts), botResponse:!mobile?'Customer mobile?':!pts?'How many points?':`Adding ${pts} points to ${mobile}…` };
    }

    // ── 6. LOYALTY — deduct points ───────────────────────────────────────────
    if (/\b(?:deduct|remove|redeem|subtract)\s+\d+\s+(?:loyalty\s+)?points?\b/.test(t)) {
        const mobile = getMob(t);
        const pts    = parseInt((t.match(/(\d+)\s+(?:loyalty\s+)?points?/)||[])[1]);
        return { entity:'Loyalty', action:'adjust', newTask:true, fields:{ customerMobile:mobile, points:pts||null, adjustType:'Deduct' },
            isReady:!!(mobile&&pts), botResponse:!mobile?'Customer mobile?':!pts?'How many points?':`Deducting ${pts} points from ${mobile}…` };
    }

    // ── 7. STOCK ADJUST ──────────────────────────────────────────────────────
    // Strip the command words and whatever is left is "<product> <qty>" in either
    // order. The old capture began right after the word "stock", so "stock
    // adjustment Notebook1 2 increase" produced a product called "adjustment
    // Notebook1" and no quantity at all.
    const adjustItemQty = (src) => {
        let rest = ' ' + String(src) + ' ';
        const byM = rest.match(/\bby\s+(\d+(?:\.\d+)?)\b/i);
        let q = byM ? parseFloat(byM[1]) : getQty(rest);
        rest = rest.replace(/\b(?:by\s+)?\d+(?:\.\d+)?\s*(?:qty|units?|pcs?|pieces?|nos?)\b/gi, ' ')
                   .replace(/\b(?:qty|quantity)\s*:?\s*\d+(?:\.\d+)?\b/gi, ' ')
                   .replace(/\bby\s+\d+(?:\.\d+)?\b/gi, ' ')
                   .replace(/\b(?:please|pls|create|do|make|new|record|an?|the)\b/gi, ' ')
                   .replace(/\bstock\s+(?:adjustments?|adjust)\b|\badjust(?:ment)?\s+stock\b/gi, ' ')
                   .replace(/\b(?:increase|decrease|reduce|add|remove|topup|top.up|write.?off|damaged?|scrap)\b/gi, ' ')
                   .replace(/\bstock\b|\b(?:of|for|in)\b/gi, ' ');
        if (q == null) {
            // a standalone number (never the digits inside "Notebook1")
            const nm = rest.match(/(?:^|\s)(\d+(?:\.\d+)?)(?=\s|$)(?![\s\S]*(?:^|\s)\d+(?:\.\d+)?(?:\s|$))/);
            if (nm) { q = parseFloat(nm[1]); rest = rest.replace(new RegExp('(^|\\s)' + nm[1].replace('.', '\\.') + '(?=\\s|$)'), ' '); }
        }
        const item = rest.replace(/\s+/g, ' ').trim() || null;
        return { item, q: q || null };
    };
    // Both word orders are natural: "increase stock of X by 5" and
    // "stock adjustment increase X by 5". Only the first used to match.
    if (/\b(?:increase|topup|top.up)\s+stock\b/.test(t) ||
        /\bstock\s+(?:adjustment|adjust)\b.*\b(?:increase|add|topup|top.up)\b/.test(t)) {
        const { item, q } = adjustItemQty(raw);
        return { entity:'StockAdjust', action:'create', newTask:true, fields:{ itemName:item, qty:q, adjustType:'Increase' },
            isReady:!!(item&&q), botResponse:!item?'Which product?':!q?`Increase ${item} by how much?`:`Increasing ${item} by ${q}…` };
    }
    if (/\b(?:decrease|reduce|writeoff|damage|scrap)\s+stock\b/.test(t) ||
        /\bstock\s+(?:adjustment|adjust)\b.*\b(?:decrease|reduce|remove|writeoff|scrap)\b/.test(t)) {
        const { item, q } = adjustItemQty(raw);
        return { entity:'StockAdjust', action:'create', newTask:true, fields:{ itemName:item, qty:q, adjustType:'Decrease' },
            isReady:!!(item&&q), botResponse:!item?'Which product?':!q?`Decrease ${item} by how much?`:`Decreasing ${item} by ${q}…` };
    }

    // ── 9. POS SALE ──────────────────────────────────────────────────────────
    if (/\b(?:sell|pos\s+sale?|new\s+(?:pos\s+)?sale)\b/.test(t)) {
        // Two tenders ("split cash 50 upi 40") need the till's Multiple Pay screen;
        // posting it as one mode would put the money in the wrong place.
        const modes = (t.match(/\b(?:cash|upi|card|paytm|gpay|cheque|neft|credit|pay\s*later)\b/g) || []).filter((v, i, a) => a.indexOf(v) === i);
        if (/\bsplit\b|\bmultiple\s+pay/.test(t) || modes.length > 1) {
            return { entity:null, action:'chat', newTask:true, isReady:false, fields:{},
                botResponse:`A split payment needs VasyERP's <b>Multiple Pay (F12)</b> screen, which I don't drive yet — I haven't sold anything. ` +
                            `Ring it up on the till, or send it with one payment mode.` };
        }
        const pm = getPay(t);
        let q    = getQty(t);   // "qty 2" / "2 pcs" forms
        let item = null, m;
        // Word order A: "sell notebook1s qty 2"
        if ((m = raw.match(/\b(?:sell|pos\s+sale?|sale)\s+([A-Za-z][A-Za-z0-9\s\-]{1,40}?)\s+(?:qty|quantity)\s*:?\s*(\d+(?:\.\d+)?)/i))) {
            item = m[1].trim(); q = q || parseFloat(m[2]);
        // Word order B: "sell 2 notebook1s cash" — leading number IS the qty
        } else if ((m = raw.match(/\b(?:sell|pos\s+sale?|sale)\s+(\d+(?:\.\d+)?)\s+([A-Za-z][A-Za-z0-9\s\-]{1,40}?)(?:\s+(?:cash|upi|card|paytm|gpay|g\s*pay|phone\s*pe|bhim|via|with|payment)|\s*$)/i))) {
            q = q || parseFloat(m[1]); item = m[2].trim();
        // Word order C: "sell [to Ramesh] shinchan mouse pad blue 2 cash" —
        // TRAILING qty before the payment word (customer only with "to")
        } else if ((m = raw.match(/\b(?:sell|pos\s+sale?)\s+(?:to\s+([A-Za-z][A-Za-z .']{2,30}?)\s+)?(.+?)\s+(\d+(?:\.\d+)?)\s*(?:qty)?\s*(?:cash|upi|card)\s*$/i))) {
            item = m[2].trim(); q = q || parseFloat(m[3]);
            if (m[1]) var _posCust = m[1].trim();
        // Word order D: "sell on pos notebook1 s" (no qty in sentence)
        } else if ((m = raw.match(/\b(?:sell|pos\s+sale?)\s+(?:on\s+pos\s+|at\s+pos\s+|pos\s+)?([A-Za-z][A-Za-z0-9\s\-]{1,40}?)(?:\s+(?:cash|upi|card)|\s*$)/i))) {
            item = m[1].trim();
        }
        if (item) item = item.replace(/^(?:on|at)\s+pos\s+/i, '').replace(/\b(cash|upi|card|paytm|gpay|phone\s*pe|bhim)\b\s*$/i, '').trim() || null;
        // Fallback self-repair (when the C split misses): a trailing number on the
        // item IS the qty, and a leading "to <name>" is the customer.
        if (item) {
            const tq = item.match(/^(.+?)\s+(\d+(?:\.\d+)?)$/);
            if (tq && !q) { item = tq[1].trim(); q = parseFloat(tq[2]); }
            const tc = item.match(/^to\s+(.+)$/i);
            if (tc) item = tc[1].trim();   // product fuzzy self-corrects extra name tokens
            // "sell 1 PP10955 to Ramesh cash": an item CODE never contains " to ", so
            // what follows it is the customer. (A NAME can — "ready to eat noodles" —
            // so for names the POS handler lets the catalogue decide.)
            const tcode = typeof _posCust === 'undefined' && item.match(/^([A-Za-z0-9\-_.\/]*\d[A-Za-z0-9\-_.\/]*)\s+to\s+([A-Za-z][A-Za-z .']{1,40})$/i);
            if (tcode) { item = tcode[1]; var _posCust = tcode[2].trim(); }
            // "sell 1 PP10955 to 9822220001 cash" — the customer by mobile number
            const tmob = typeof _posCust === 'undefined' && item.match(/^(.+?)\s+(?:to|for)\s+(?:customer\s+)?([6-9]\d{9})$/i);
            if (tmob) { item = tmob[1].trim(); var _posCust = tmob[2]; }
        }
        const custM = getMob(t);
        return { entity:'POSSale', action:'create', newTask:true,
            fields:{ itemName:item, qty:q, paymentMode:pm||null,
                     ...(typeof _posCust !== 'undefined' && _posCust ? { customerName: _posCust } : {}),
                     ...(custM?{customerMobile:custM}:{}) },
            isReady:!!(item&&q&&pm),
            botResponse:!item?'Which product to sell?':!q?`Quantity of ${item}?`:!pm?`Payment mode? Cash / UPI / Card`:`Selling ${item} qty ${q} via ${pm}…` };
    }

    // ── 9a. PURCHASE ORDER ───────────────────────────────────────────────────
    if (/\b(?:create|add|new)\s+(?:a\s+)?(?:purchase\s+order|po)\b/.test(t) ||
        (/\b(?:purchase\s+order|po)\b/.test(t) && /\bfor\s+[A-Za-z]/i.test(t))) {
        const supM  = raw.match(/\b(?:for|from|form|to)\s+([A-Za-z][A-Za-z\s.&\-']{1,40}?)(?=\s+(?:item|product|of|for\b|\d))/i)
                   || raw.match(/\b(?:for|from|form|to)\s+([A-Za-z][A-Za-z\s.&\-']{1,40}?)(?:\s*$)/i);
        const supplier = supM ? supM[1].trim() : null;
        const itemM = raw.match(/\b(?:item|product|of)\s+([A-Za-z][A-Za-z0-9\s\-]{1,40}?)(?:\s+qty|\s+\d|$)/i)
                   || (supM && /\bfrom|\bform/i.test(supM[0]) ? raw.match(/\bfor\s+([A-Za-z][A-Za-z0-9\s\-]{1,40}?)(?:\s+qty|\s+\d|\s*$)/i) : null);
        const tail  = qtyItemTail(raw, supplier);
        const item  = itemM ? itemM[1].trim() : (tail.tailItem || null);
        const qty   = getQty(t) || tail.tailQty || null;
        const price = getRate(raw);
        return { entity:'PurchaseOrder', action:'create', newTask:true,
            fields:{ supplierName:supplier, itemName:item, qty, ...(price?{price}:{}) },
            isReady:!!(supplier&&item&&qty),
            botResponse:!supplier?'Supplier name?':!item?`Item to order from ${supplier}?`:!qty?`Quantity of ${item}?`:`Creating PO for ${supplier}…` };
    }

    // ── 9b. MATERIAL INWARD / GRN ────────────────────────────────────────────
    if (/\b(?:create|add|new|record)\s+(?:a\s+)?(?:material\s+inward|grn|goods?\s+receipt)\b/.test(t) ||
        (/\b(?:material\s+inward|grn|goods?\s+receipt)\b/.test(t) && /\b(?:for|from)\s+[A-Za-z]/i.test(t)) ||
        // "receive goods against PO BIL214" — the PO already names the supplier
        (/\breceiv\w*\s+(?:the\s+)?(?:goods?|items?|material|stock|delivery)\b/.test(t) && /\b(?:against|for|of)\s+(?:po|purchase\s+order)\b|\b(?:BIL{1,2}|PO)[-#]?\d+/i.test(raw))) {
        // Goods come FROM a supplier as often as they are booked FOR one.
        const supM  = raw.match(/\b(?:for|from)\s+([A-Za-z][A-Za-z\s.&\-']{1,40}?)(?=\s+(?:po|purchase\s+order|\d|,)|$)/i);
        const supplier = supM ? supM[1].trim() : null;
        // Doc ref with keyword ("PO 123") OR bare VasyERP-style number ("BIL173")
        const poM   = raw.match(/\b(?:po|purchase\s+order)[-\s#]?([\w\-]+)\b/i)
                   || raw.match(/\b((?:BIL{1,2}|PO|GRN)[-#]?\d+[\w\-]*)\b/i);
        const poNumber = poM ? poM[1].toUpperCase() : null;
        return { entity:'MaterialInward', action:'create', newTask:true,
            fields:{ ...(supplier?{supplierName:supplier}:{}), ...(poNumber?{poNumber}:{}) },
            // the PO fixes the supplier, so a PO number alone is enough
            isReady:!!(supplier || poNumber),
            botResponse:(!supplier && !poNumber)?'Supplier name for this GRN — or the PO number it is against?'
                       :`Creating GRN ${supplier?`for ${supplier}`:''}${poNumber?` against PO ${poNumber}`:''}…` };
    }

    // ── 9c. SUPPLIER BILL ────────────────────────────────────────────────────
    if (/\b(?:create|add|new)\s+(?:a\s+)?(?:supplier\s+bill|vendor\s+bill|purchase\s+bill)\b/.test(t) ||
        (/\b(?:supplier\s+bill|vendor\s+bill|purchase\s+bill)\b/.test(t) && /\bfor\s+[A-Za-z]/i.test(t)) ||
        // "book supplier bill against MI215" / "bill GRN MI215"
        (/\b(?:book|raise|enter|record|make)\s+(?:the\s+|a\s+)?(?:supplier\s+|vendor\s+|purchase\s+)?bill\b/.test(t) && /\b(?:grn|mi|material\s+inward)[-\s#]?\w*\d/i.test(raw))) {
        const supM  = raw.match(/\bfor\s+([A-Za-z][A-Za-z\s.&\-']{1,40}?)(?=\s+(?:grn|mi|material\s+inward|\d|,)|$)/i);
        const supplier = supM ? supM[1].trim() : null;
        // "MI215" is the whole number; "GRN 215" / "material inward MI215" name it
        const miM   = raw.match(/\b((?:MI|GRN)[-#]?\d+[\w\-]*)\b/i)
                   || raw.match(/\b(?:grn|material\s+inward)[-\s#]?(?:no\.?\s*)?([\w\-]*\d[\w\-]*)\b/i);
        const miNumber = miM ? miM[1].toUpperCase() : null;
        return { entity:'SupplierBill', action:'create', newTask:true,
            fields:{ ...(supplier?{supplierName:supplier}:{}), ...(miNumber?{miNumber}:{}) },
            // the GRN fixes the supplier, so a GRN number alone is enough
            isReady:!!(supplier || miNumber),
            botResponse:(!supplier && !miNumber)?'Supplier name for this bill — or the GRN it is against?'
                       :`Creating bill ${supplier?`for ${supplier}`:''}${miNumber?` against GRN ${miNumber}`:''}…` };
    }

    // ── 9d. SALES ORDER ──────────────────────────────────────────────────────
    if (/\b(?:create|add|new)\s+(?:a\s+)?sales?\s+order\b/.test(t) ||
        (/\bsales?\s+order\b/.test(t) && /\bfor\s+[A-Za-z]/i.test(t))) {
        // The name has to stop before a document reference too, or "for Gupta
        // Stores SO POS22" reads the customer as "Gupta Stores SO POS22" and
        // matches no contact at all.
        const custM = raw.match(/\b(?:for|from|to)\s+([A-Za-z][A-Za-z\s.&\-']{1,40}?)(?=\s+(?:item|product|of|against|so\b|order\b|challan\b|dc\b|est\b|estimate\b|\d))/i)
                   || raw.match(/\b(?:for|from|to)\s+([A-Za-z][A-Za-z\s.&\-']{1,40}?)(?:\s*$)/i);
        const customer = custM ? custM[1].trim() : null;
        const itemM = raw.match(/\b(?:item|product|of)\s+([A-Za-z][A-Za-z0-9\s\-]{1,40}?)(?:\s+qty|\s+\d|$)/i);
        const tail  = qtyItemTail(raw, customer);
        const item  = itemM ? itemM[1].trim() : (tail.tailItem || null);
        const qty   = getQty(t) || tail.tailQty || null;
        const price = getRate(raw);
        return { entity:'SalesOrder', action:'create', newTask:true,
            fields:{ customerName:customer, itemName:item, qty, ...(price?{price}:{}) },
            isReady:!!(customer&&item&&qty),
            botResponse:!customer?'Customer name?':!item?`Item for ${customer}?`:!qty?`Quantity of ${item}?`:`Creating sales order for ${customer}…` };
    }

    // ── 9sl. SETTINGS DISCOVERY — answer from the catalogue, no page needed ──
    // "what settings are there for barcodes" / "list pos payment settings"
    if (/\b(what|which|list|show|tell me)\b/i.test(raw) && /\bsettings?\b/i.test(t)
        && !/\benable|disable|turn\s+(on|off)|set\b/i.test(t)) {
        const TOPICS = [
            [/barcode|label/i,                        'Barcodes & Labels'],
            [/payment|tender|upi|card|pay\s*later/i,  'Payment Methods'],
            [/discount|pricing|margin/i,              null],
            [/print|receipt/i,                        'Receipts & Print'],
            [/otp|security/i,                         'Security & OTP'],
            [/drawer|cash\s*drawer/i,                 'Cash Drawer'],
            [/stock|movement|negative/i,              'Stock & Movement'],
            [/production|raw|recipe|unit\s*conversion/i,'Production & Unit Conversions'],
            [/column|display/i,                       'Display Columns'],
            [/b2b/i,                                  null],
            [/approval|attachment|ocr/i,              'Purchase Flow & Approvals'],
            [/return|exchange/i,                      'Returns & Exchange'],
            [/default|identity|tax|hsn/i,             'Defaults & Identity'],
        ];
        const pageM = /\bpos\b|point of sale/i.test(t) ? '/setting/pos'
                    : /\bpurchase\b/i.test(t)          ? '/setting/purchase'
                    : /\bsales\b/i.test(t)             ? '/setting/sales'
                    : /\bitem|inventory|product/i.test(t) ? '/setting/inventory' : null;
        const topic = (TOPICS.find(([re]) => re.test(t)) || [])[1];
        let rows = SETTINGS_INDEX;
        if (pageM) rows = rows.filter(s => s.page === pageM);
        if (topic) rows = rows.filter(s => s.group === topic);
        else if (!pageM) {
            // No page and no known group — try matching the group name loosely
            const gm = [...new Set(SETTINGS_INDEX.map(s => s.group))]
                .map(g => ({ g, sc: sFuzzy(raw, g) })).sort((a,b) => b.sc - a.sc)[0];
            if (gm && gm.sc >= 0.55) rows = SETTINGS_INDEX.filter(s => s.group === gm.g);
        }
        if (rows.length && rows.length <= 60) {
            const TY = { t:'switch', d:'dropdown', n:'number', x:'text' };
            const byGroup = {};
            rows.forEach(s => { (byGroup[`${s.group} · ${s.page.split('/').pop()}`] ||= []).push(s); });
            const body = Object.entries(byGroup).map(([g, list]) =>
                `<b>${g}</b><br>` + list.map(s => `&nbsp;• ${s.n} <small style="color:#888">(${TY[s.ty]})</small>`).join('<br>')
            ).join('<br><br>');
            return { entity:null, action:'chat', newTask:false, isReady:false, fields:{}, _source:'local',
                botResponse:`${rows.length} setting${rows.length>1?'s':''} I know:<br><br>${body}` +
                    `<br><br><small style="color:#888">Say <i>"enable &lt;name&gt;"</i>, <i>"disable &lt;name&gt;"</i>, <i>"set &lt;name&gt; to &lt;value&gt;"</i> or <i>"is &lt;name&gt; enabled?"</i></small>` };
        }
    }

    // ── 9s. SETTINGS — enable/disable/toggle/check any switch by name ────────
    // Keyword→page routing built from the V2 switch-impact taxonomy; the agent
    // hops the remaining /setting/* pages if the first guess is wrong.
    {
        const SETTING_PAGES = ['/setting/pos', '/setting/inventory', '/setting/general', '/setting/sales', '/setting/purchase'];
        const guessPage = (nm) => {
            if (/negative stock|batch|barcode|b2b|pricing|landing cost|product type|raw |recipe|opening stock|multi.?unit|bill restriction|previous bill|warning|alert/i.test(nm)) return '/setting/inventory';
            if (/pos|token|tender|sales\s?man|customer detail|drawer|register|multipay|coupon show|image base|voice message|hold bill|pay later|exchange/i.test(nm)) return '/setting/pos';
            if (/purchase|grn|material inward|merge same item/i.test(nm)) return '/setting/purchase';
            if (/sales|invoice|estimate|challan|cursor|focus/i.test(nm)) return '/setting/sales';
            if (/round\s?off|feedback|touch|weight scale|mac|profile|hardware|decimal|date format|currency/i.test(nm)) return '/setting/general';
            return '/setting/pos';
        };
        // A QUESTION first. "is enable ocr switched on" used to match the enable
        // rule below and was dispatched as an instruction to switch it ON.
        const qm = raw.match(/^\s*(?:is|are|check\s+(?:if|whether)|tell\s+me\s+(?:if|whether)|whether)\s+(?:the\s+)?(.{3,60}?)\s+(?:(?:switched|turned|set|kept|currently)\s+)?(?:enabled|disabled|on|off|active|inactive|allowed)\s*\??\s*$/i);
        let sm = qm ? null : raw.match(/\b(enable|disable|turn\s+on|turn\s+off|switch\s+on|switch\s+off|toggle)\s+(?:the\s+)?(.{3,55}?)(?:\s+setting|\s+switch|\s+notifications?|\s+alerts?)?\s*$/i);
        let desired = null, settingName = null, settingValue = null;
        if (qm) {
            desired = 'check';
            settingName = qm[1].replace(/\s+(?:switch|setting|option|toggle)$/i, '').trim();
        } else if (sm) {
            desired = /disable|off/i.test(sm[1]) ? 'off' : /toggle/i.test(sm[1]) ? 'toggle' : 'on';
            settingName = sm[2].trim();
        } else if ((sm = raw.match(/\b(?:is|check\s+if)\s+(.{3,55}?)\s+(?:enabled|disabled|on|off)\s*\??\s*$/i))) {
            desired = 'check'; settingName = sm[1].replace(/\s+(?:switch|setting)$/i, '').trim();
        } else if ((sm = raw.match(/\bset\s+(?:the\s+)?(.{3,50}?)\s+(?:setting\s+)?to\s+(.{1,30}?)\s*$/i))
                   && !/\bopening stock|price|mrp|stock of/i.test(t)) {
            // Value settings: "set decimal points to 2", "set start pos with to qty"
            desired = 'set'; settingName = sm[1].trim(); settingValue = sm[2].trim();
        } else if ((sm = raw.match(/^(.{3,95}?)\s+make\s+it\s+(?:to\s+)?([\w.]{1,20})\s*$/i))
                   && !/\bopening stock|price of|mrp of|stock of/i.test(t)) {
            // "No. of Previous Bill … make it to 4" — name first, value last
            desired = 'set'; settingName = sm[1].trim(); settingValue = sm[2].trim();
        }
        // "set X to Y" is ALSO how people fill an ordinary form field ("set GSTIN
        // to …", "set mobile to …"). Claim it as a setting only when X really is a
        // catalogued setting, or the user said the word "setting" — otherwise
        // release it to the generic field filler further down, instead of
        // walking every settings page hunting for a switch called "GSTIN".
        // "Not catalogued" alone is too blunt — plenty of real settings ("No. of
        // Previous Bill") aren't in the index yet. So release only when the words
        // clearly name a form field, or the user is on a form rather than on a
        // settings page; everything else keeps the old settings behaviour.
        const pg = typeof currentPage === 'string' ? currentPage : '';
        const onSettingsPage = /\/setting/i.test(pg);
        const onFormPage = /\/(?:new|edit)\b|\/\d+(?:\/edit)?$/i.test(pg);
        const fieldWord = /\b(?:gstin|gst(?:\s*no)?|mobile|phone|e-?mail|pin\s*code|pincode|zip|pan|address|city|state|company(?:\s*name)?|credit\s*(?:limit|days)|opening\s*balance|hsn|barcode|mrp|notes?|remarks?|reference|due\s*date|first\s*name|last\s*name|contact)\b/i.test(settingName || '');
        if (desired === 'set' && settingName && !findSetting(settingName) && !/\bsettings?\b/i.test(t)
            && !onSettingsPage && (onFormPage || fieldWord)) {
            settingName = null;
        }
        // Only treat as a setting when it doesn't look like a record action
        // …but "enable new invoice notification" ends in "invoice notification",
        // which is a SETTING, not a record named "notification".
        if (settingName && !/\b(customer|supplier|product|invoice|order|bill|payment|receipt|coupon|membership)\s+(?!notifications?\b|settings?\b|switch(?:es)?\b|alerts?\b)[A-Za-z0-9]+\s*$/i.test(raw)) {
            // Exact catalogue lookup first — falls back to keyword guessing for
            // pages we haven't catalogued yet (e.g. General, Notifications).
            const hit = findSetting(settingName);
            if (hit && hit.ambiguous) {
                const near = SETTINGS_INDEX.map(s => ({ s, sc: sFuzzy(settingName, s.n) }))
                    .sort((a,b) => b.sc - a.sc).slice(0, 3).map(x => x.s.n);
                return { entity:null, action:'chat', newTask:false, isReady:false, fields:{}, _source:'local',
                    botResponse:`Which one did you mean? (${near.join('/')})` };
            }
            // Guard the verb against the setting's real type
            if (hit && hit.ty === 't' && desired === 'set') {
                if (/^(on|yes|true|enable[d]?|1)$/i.test(settingValue))       { desired = 'on';  settingValue = null; }
                else if (/^(off|no|false|disable[d]?|0)$/i.test(settingValue)) { desired = 'off'; settingValue = null; }
                else return { entity:null, action:'chat', newTask:false, isReady:false, fields:{}, _source:'local',
                    botResponse:`<b>${hit.n}</b> is an on/off switch (in ${hit.group}), so it can't be set to "${settingValue}". Say <i>"enable ${hit.n}"</i> or <i>"disable ${hit.n}"</i>.` };
            }
            // Notification events are a matrix — one row per event, one switch per
            // channel — so the event name alone does not identify a control.
            if (hit && hit.ty === 'm') {
                const chan = NOTIFY_CHANNELS.find(c => new RegExp(`\\b${c}\\b`, 'i').test(raw));
                if (!chan) return { entity:null, action:'chat', newTask:false, isReady:false, fields:{}, _source:'local',
                    botResponse:`<b>${hit.n}</b> notifications go out on three channels, each with its own switch. Which one? (${NOTIFY_CHANNELS.join('/')})` };
                return { entity:'Setting', action:'toggle', newTask:true, isReady:true,
                    fields:{ settingName: hit.n, desired, channel: chan, firstPage: hit.page, pages: [],
                             group: hit.group, kind: 'm' },
                    botResponse:`${desired==='check'?'Checking':desired==='off'?'Turning off':'Turning on'} <b>${chan}</b> for "${hit.n}"…` };
            }
            if (hit && hit.ty !== 't' && (desired === 'on' || desired === 'off' || desired === 'toggle')) {
                const kind = hit.ty === 'n' ? 'a number' : hit.ty === 'd' ? 'a dropdown' : hit.ty === 'c' ? 'one of its choices (FIFO / LIFO)' : 'a text value';
                return { entity:null, action:'chat', newTask:false, isReady:false, fields:{}, _source:'local',
                    botResponse:`<b>${hit.n}</b> isn't a switch — it takes ${kind} (it's under ${hit.group} on the ${hit.page.split('/').pop()} settings page). Tell me the value, e.g. <i>"set ${hit.n} to …"</i>.` };
            }
            const canonical = hit ? hit.n : settingName;
            const first = hit ? hit.page : guessPage(settingName);
            return { entity:'Setting', action:'toggle', newTask:true, isReady:true,
                fields:{ settingName: canonical, desired, ...(settingValue?{settingValue}:{}),
                         firstPage: first, pages: SETTING_PAGES.filter(p => p !== first),
                         ...(hit ? { group: hit.group, kind: hit.ty } : {}) },
                botResponse: desired==='check' ? `Checking "${canonical}"…`
                           : desired==='set'   ? `Setting "${canonical}" → ${settingValue}…`
                           : `Flipping "${canonical}"${desired==='toggle'?'':' '+desired.toUpperCase()}…` };
        }
    }

    // ── 9p. PRODUCT — create (with optional variants) ────────────────────────
    // "create product v1300 with variants size m,l,xl color black,blue price 500"
    if (/\b(?:create|add|new)\s+(?:a\s+)?product\b/.test(t) && !/\bmodal|fixed\s+amount/i.test(t)) {
        const nameM = raw.match(/\bproduct\s+["']([^"']{1,50})["']/i)
                   || raw.match(/\bproduct\s+(?:named\s+|called\s+)?([A-Za-z0-9][A-Za-z0-9\s\-]{0,40}?)(?=\s+(?:with|variants?|price|mrp|category|brand|sku|hsn|qty|purchase|selling|sale|cost|pp|sp|unit|uom)\b|\s*[,.]|\s*$)/i);
        const name = nameM ? nameM[1].trim() : null;
        // Variant options: "size m,l,xl" / "color black,blue" / "material cotton,silk"
        const variants = [];
        const varRe = /\b(size|colou?r|material|style|weight|flavou?r|pattern|fit)s?\s*[:=]?\s+((?:[A-Za-z0-9.\-]+\s*,\s*)+[A-Za-z0-9.\-]+|[A-Za-z0-9.\-]+(?:\s*,\s*[A-Za-z0-9.\-]+)*)/gi;
        let vm;
        while ((vm = varRe.exec(raw)) !== null) {
            const values = vm[2].split(/\s*,\s*/).map(v => v.trim()).filter(Boolean);
            if (values.length) variants.push({ name: vm[1][0].toUpperCase() + vm[1].slice(1).toLowerCase().replace(/^colour$/,'color'), values });
        }
        // KEYWORD-LESS variants: "with variants red, black, blue" — no option name
        // given. Infer it: all colour words → "Color", otherwise "Variant".
        if (!variants.length) {
            const bare = raw.match(/\bvariants?\s+(?:of\s+)?((?:[A-Za-z0-9.\-]+\s*,\s*)+[A-Za-z0-9.\-]+)/i);
            if (bare) {
                const values = bare[1].split(/\s*,\s*/).map(v => v.trim()).filter(v => v && !/^(each|having|with|and)$/i.test(v));
                if (values.length >= 2) {
                    const COLORS = /^(red|blue|green|black|white|pink|yellow|orange|purple|grey|gray|brown|gold|silver|maroon|navy|beige|cream)$/i;
                    variants.push({ name: values.every(v => COLORS.test(v)) ? 'Color' : 'Variant', values });
                }
            }
        }
        // Prices — tolerate "of/is/=" between the word and the number:
        // "mrp of 500", "selling price is 450", "purchase price of 100"
        const num = '₹?\\s*([\\d,]+(?:\\.\\d+)?)';
        const mrpM      = raw.match(new RegExp('\\bmrp\\s*(?:of|is|:|=)?\\s*' + num, 'i'));
        const sellM     = raw.match(new RegExp('\\bselling\\s+price\\s*(?:of|is|:|=)?\\s*' + num, 'i'));
        const purchM    = raw.match(new RegExp('\\bpurchase\\s+price\\s*(?:of|is|:|=)?\\s*' + num, 'i'));
        const bareP     = raw.match(new RegExp('(?<!selling\\s)(?<!purchase\\s)\\bprice\\s*(?:of|is|:|=)?\\s*' + num, 'i'));
        // No selling price but an MRP: VasyERP sells at MRP unless told otherwise,
        // so that is the answer the user would give if asked.
        const priceM    = sellM || bareP || mrpM;
        const catM   = raw.match(/\bcategory\s+([A-Za-z][A-Za-z0-9\s&\-]{1,30}?)(?=\s+(?:brand|price|mrp|sku|hsn|with|unit|uom|per|purchase|selling|po|reorder|stock)\b|\s*[,.]|\s*$)/i);
        const brandM = raw.match(/\bbrand\s+([A-Za-z][A-Za-z0-9\s&\-]{1,30}?)(?=\s+(?:category|price|mrp|sku|hsn|with|unit|uom|per|purchase|selling)\b|\s*[,.]|\s*$)/i);
        const hsnM   = raw.match(/\bhsn\s+(\d{4,8})\b/i);
        // "po qty 10" / "reorder qty 10", "stock limit 5" / "reorder level 5"
        const poqM   = raw.match(/\b(?:po|reorder|order)\s*(?:qty|quantity)\s*:?\s*(\d+(?:\.\d+)?)\b/i);
        const slimM  = raw.match(/\b(?:stock\s*limit|reorder\s*level|min(?:imum)?\s*stock)\s*:?\s*(\d+(?:\.\d+)?)\b/i);
        // Unit* is compulsory on the product form: "unit PCS" / "uom kg" / "per kg"
        const unitM  = raw.match(/\b(?:unit|uom)\s+(?:is\s+|of\s+)?([A-Za-z][A-Za-z0-9\-]{0,14})\b/i)
                    || raw.match(/\bper\s+(pcs|pc|pieces?|nos|numbers?|kgs?|kilos?|kilograms?|grams?|gms?|g|ltrs?|litres?|liters?|ml|box(?:es)?|pairs?|mtrs?|meters?|metres?|dozens?|packs?|sets?|strips?|tablets?|bottles?)\b/i);
        return { entity:'Product', action:'create', newTask:true,
            fields:{ productName:name,
                     ...(priceM?{price:priceM[1].replace(/,/g,'')}:{}), ...(mrpM?{mrp:mrpM[1].replace(/,/g,'')}:{}),
                     ...(purchM?{purchasePrice:purchM[1].replace(/,/g,'')}:{}),
                     ...(catM?{category:catM[1].trim()}:{}), ...(brandM?{brand:brandM[1].trim()}:{}),
                     ...(hsnM?{hsn:hsnM[1]}:{}), ...(unitM?{unit:unitM[1]}:{}),
                     ...(poqM?{poQty:poqM[1]}:{}), ...(slimM?{stockLimit:slimM[1]}:{}), ...(variants.length?{variants}:{}) },
            // Ready only when everything VasyERP insists on is present. Opening the
            // form with a name alone just moved the failure to the Save button.
            isReady: !!name && !!priceM && !!purchM && !!catM && !!unitM,
            // Name the FIRST thing still missing rather than announcing a save that
            // is not going to happen — "Creating product X…" followed by silence is
            // exactly the false-confidence this agent is meant to avoid.
            botResponse: !name ? 'What should the product be called?'
                       : !purchM ? `Got it — <b>${name}</b>. What do you <b>pay</b> for it? (purchase price — VasyERP works the other prices out from this)`
                       : !priceM ? `And what do you <b>sell</b> ${name} for?`
                       : !catM   ? `Which category does ${name} go in?`
                       : !unitM  ? `Which <b>unit</b> is ${name} sold in? (PCS, kg, BOX… — compulsory)`
                       : `Creating product ${name}${variants.length?` with ${variants.map(v=>v.name).join(' & ')} variants`:''}…` };
    }

    // ── 9q. MASTER-DATA QUICK CREATES — coupon/discount/category/brand/branch/
    //        BOM/recipe/material/challan/estimate/stock transfer/lead/etc. ─────
    {
        // Bare-number value extractor — "amount 100", "worth 50", "percentage 15",
        // or a trailing number. getAmt alone needs a ₹/rs marker, which users skip.
        const bareValue = (s) => {
            const m = s.match(/\b(?:amount|price|worth|value|of)\s+₹?\s*(\d[\d,]*(?:\.\d+)?)/i)
                   || s.match(/\b(?:percent(?:age)?)\s+(\d[\d,]*(?:\.\d+)?)/i)
                   || s.match(/(\d[\d,]*(?:\.\d+)?)\s*%/)
                   || s.match(/\b(\d[\d,]*(?:\.\d+)?)\s*$/);
            return m ? parseFloat(m[1].replace(/,/g, '')) : null;
        };

        // Coupon gets its own richer parse: name + value + type in one shot.
        // "create coupon Diwali10 amount 100" / "coupon SUMMER percentage 15"
        if (/\b(?:create|add|new)\s+(?:a\s+)?coupon\b/.test(t)) {
            const nm   = nameAfter(raw, 'coupon');
            const amt  = getAmt(raw) || bareValue(raw);
            const type = /entire\s*bill|entirebill/i.test(t) ? 'entirebill'
                       : /percent|%/i.test(t)                ? 'percentage'
                       :                                       'amount';
            return { entity:'Coupon', action:'create', newTask:true,
                fields:{ ...(nm?{couponName:nm}:{}), ...(amt?{price:amt, redeemAmount:amt, redeemPercentage:amt}:{}), couponType:type },
                isReady:!!(nm && amt),
                botResponse:!nm?'Coupon name?':!amt?`Value of ${nm}? (₹ amount or % number)`:`Creating coupon ${nm} — ${type==='percentage'?amt+'%':'₹'+amt}…` };
        }

        // Membership: "create membership Gold Elite 365 days amount 999"
        if (/\b(?:create|add|new)\s+(?:a\s+)?membership\b/.test(t)) {
            const nm    = nameAfter(raw, 'membership');
            const daysM = raw.match(/\b(\d+)\s*days?\b/i);
            const amt   = getAmt(raw) || bareValue(raw.replace(/\b\d+\s*days?\b/i, ''));
            return { entity:'Membership', action:'create', newTask:true,
                fields:{ ...(nm?{membershipName:nm}:{}), ...(daysM?{membershipDays:daysM[1]}:{}), ...(amt?{membershipAmount:amt}:{}) },
                isReady:!!(nm && daysM && amt),
                botResponse:!nm?'Membership plan name?':!daysM?`How many days is ${nm} valid?`:!amt?`Price of ${nm}? (₹)`:`Creating membership ${nm} — ${daysM[1]} days @ ₹${amt}…` };
        }

        // ── JOURNAL VOUCHER — both sides, or it cannot balance ────────────────
        // "journal voucher debit Rent 5000 credit Cash 5000" / "jv debit … credit …"
        if (/\b(?:journal\s*voucher|journal\s*entry|\bjv\b)\b/.test(t) && /\bdebit\b/.test(t)) {
            const dr = raw.match(/\bdebit\s+(?:a\/?c\s+|account\s+)?([A-Za-z][A-Za-z0-9 &.\-\/]{1,40}?)(?=\s+(?:\d|₹|rs\b|credit\b)|\s*$)/i);
            const cr = raw.match(/\bcredit\s+(?:a\/?c\s+|account\s+)?([A-Za-z][A-Za-z0-9 &.\-\/]{1,40}?)(?=\s+(?:\d|₹|rs\b|debit\b)|\s*$)/i);
            const nums = (raw.match(/\b\d[\d,]*(?:\.\d+)?\b/g) || []).map(n => n.replace(/,/g, ''));
            const amt  = getAmt(raw) || (nums.length ? nums[0] : null);
            const narr = (raw.match(/\b(?:for|narration|description|being)\s+(.{3,60}?)\s*$/i) || [])[1] || null;
            const f = { ...(dr ? { debitAccount: dr[1].trim() } : {}), ...(cr ? { creditAccount: cr[1].trim() } : {}),
                        ...(amt ? { amount: String(amt) } : {}), ...(narr ? { description: narr.trim() } : {}) };
            return { entity:'JournalVoucher', action:'create', newTask:true, fields:f,
                isReady: !!(f.debitAccount && f.creditAccount && f.amount),
                botResponse: !f.debitAccount ? 'Which account should I debit?'
                           : !f.creditAccount ? `Debit ${f.debitAccount}. Which account should I credit?`
                           : !f.amount ? `How much for ${f.debitAccount} → ${f.creditAccount}?`
                           : `Journal voucher: debit ${f.debitAccount}, credit ${f.creditAccount} — ${f.amount}…` };
        }

        // ── RECIPE (V9.14.0): name · Assemble/Disassemble · inputs → outputs ──
        if (/\b(?:create|add|new|make|define|set\s*up)\s+(?:an?\s+)?(?:(?:assemble|disassemble|unassemble)\s+)?recipes?\b/.test(t)) {
            const r = parseRecipeText(raw);
            return recipeIntent({ ...(r.name ? { recipeName: r.name } : {}), ...(r.type ? { recipeType: r.type } : {}),
                                  ...(r.inputs.length ? { inputs: r.inputs } : {}), ...(r.outputs.length ? { outputs: r.outputs } : {}) }, true);
        }
        // ── PRODUCTION RUN (V9.14.0 Bill of Materials): a recipe × batches ──────
        // "produce 2 batches of Mix Mithai" · "production run Sandwich 3 batches"
        // "post production for Diwali Ready Hamper" · "create bom for Mix Mithai"
        if ((/\bbatch(?:es)?\b/.test(t) && /\b(?:produce|production|make|run|manufacture|post|cook|prepare)\b/.test(t) && !/\bbatch\s*(?:no|number|#)/.test(t))
            || /\bproduction\s+run\b|\bpost\s+production\b|\b(?:create|add|new|run)\s+(?:a\s+)?(?:bom|bill\s+of\s+materials?|production)\b/.test(t)) {
            const bM = raw.match(/\b(\d+(?:\.\d+)?)\s*batch(?:es)?\b/i) || raw.match(/\bbatch(?:es)?\s*(?:of\s*|x\s*|:\s*)?(\d+(?:\.\d+)?)\b/i);
            let nm = raw.replace(/\b\d+(?:\.\d+)?\s*batch(?:es)?\b|\bbatch(?:es)?\s*(?:x\s*|:\s*)?\d+(?:\.\d+)?\b/ig, ' ')
                        .replace(/\s+(?:today|now|please)\s*$/i, '').replace(/\s+/g, ' ').trim();
            // peel the command words off the front, whatever their order
            const LEAD = /^(?:please|create|add|new|run|post|produce|make|manufacture|cook|prepare|start|a|an|the|production\s+run|production|bom|bill\s+of\s+materials?|of|for|from|recipe)\b\s*/i;
            for (let i = 0; i < 8 && LEAD.test(nm); i++) nm = nm.replace(LEAD, '');
            if (/^(?:it|this)?$/i.test(nm)) nm = '';
            return { entity:'BillOfMaterials', action:'create', newTask:true, isReady: !!nm, _source:'local',
                fields: { ...(nm ? { recipeName: nm } : {}), ...(bM ? { batches: bM[1] } : {}) },
                botResponse: nm ? `Production run: ${nm} × ${bM ? bM[1] : 1} batch(es)…` : 'Which recipe should I produce?' };
        }
        // "create material creation for PP10955 1 from Notebook1 2" /
        // "produce 1 PP10955 from 2 Notebook1": finished goods AND what goes in.
        if ((/\bmaterial\s+creation\b/.test(t) || /\b(?:produce|manufacture)\b/.test(t)) && /\b(?:from|using)\s+[A-Za-z0-9]/i.test(raw)) {
            const part = (s0) => { const m = String(s0).trim().match(/^(?:(\d+(?:\.\d+)?)\s+)?(.+?)(?:\s+(\d+(?:\.\d+)?))?(?:\s*(?:pcs?|units?|kgs?|nos?))?$/i);
                                   return m ? { name: m[2].trim(), qty: m[1] || m[3] || null } : null; };
            const finS = (raw.match(/\b(?:for|produce|manufacture|make)\s+(.+?)\s+(?:from|using)\b/i) || [])[1];
            const rawS = (raw.match(/\b(?:from|using)\s+(.+?)\s*$/i) || [])[1];
            const fin = finS ? part(finS) : null, rm = rawS ? part(rawS) : null;
            if (fin && fin.name) {
                return { entity:'MaterialCreation', action:'create', newTask:true,
                    fields:{ finishedItemName: fin.name, ...(fin.qty ? { finishedQty: fin.qty } : {}),
                             ...(rm && rm.name ? { rawItemName: rm.name } : {}), ...(rm && rm.qty ? { rawQty: rm.qty } : {}) },
                    isReady: !!(rm && rm.name),
                    botResponse: rm && rm.name ? `Making ${fin.qty || 1} × ${fin.name} from ${rm.qty || 1} × ${rm.name}…` : `What goes into ${fin.name}?` };
            }
        }
        const MASTERS = [
            [/\b(?:create|add|new)\s+(?:a\s+)?discount\b/,              'Discount',            'discount',                   'discountName',    'Discount name?'],
            [/\b(?:create|add|new)\s+(?:a\s+)?category\b/,              'Category',            'category',                   'categoryName',    'Category name?'],
            [/\b(?:create|add|new)\s+(?:a\s+)?brand\b/,                 'Brand',               'brand',                      'brandName',       'Brand name?'],
            [/\b(?:create|add|new)\s+(?:a\s+)?(?:department|dept)\b/,  'Department',          'department|dept',            'departmentName',  'Department name?'],
            [/\b(?:create|add|new)\s+(?:a\s+)?(?:branch|outlet)\b/,     'Branch',              'branch|outlet',              'branchName',      'Branch name?'],
            [/\b(?:create|add|new)\s+(?:a\s+)?membership\b/,            'Membership',          'membership',                 'membershipName',  'Membership plan name?'],
            [/\b(?:create|add|new)\s+(?:a\s+)?(?:bom|bill\s+of\s+materials?)\b/, 'BillOfMaterials', 'for',                  'productName',     'Which finished product is this BOM for?'],
            [/\b(?:create|add|new)\s+(?:a\s+)?recipe\b/,                'Recipe',              'recipe(?:\\s+for)?|for',     'productName',     'Which product is this recipe for?'],
            [/\b(?:create|add|new)\s+(?:a\s+)?material\s+creation\b/,   'MaterialCreation',    'for',                        'finishedItemName','Which finished item are you creating?'],
            [/\b(?:record|add|create|new)\s+(?:a\s+)?(?:material\s+)?consumption\b/, 'MaterialConsumption', 'of|for',       'itemName',        'Which item was consumed?'],
            [/\b(?:create|add|new)\s+(?:a\s+)?delivery\s+challan\b/,    'DeliveryChallan',     'for',                        'customerName',    'Customer name for the challan?'],
            [/\b(?:create|add|new)\s+(?:a\s+)?(?:estimate|quotation)\b/,'SalesEstimate',       'for',                        'customerName',    'Customer name for the estimate?'],
            [/\b(?:create|add|new)\s+(?:a\s+)?journal\s+voucher\b/,     'JournalVoucher',      'for',                        'description',     null],
            [/\b(?:create|add|new)\s+(?:a\s+)?(?:crm\s+)?lead\b/,       'CRMLead',             'lead',                       'name',            'Lead name?'],
            [/\b(?:add|set(?:up)?)\s+opening\s+stock\b/,                'OpeningStock',        'of|for',                     'productName',     'Which product?'],
        ];
        // Challans and estimates take customer + product + quantity, but the
        // generic name grabber above swallows the lot: "estimate for Gupta Stores
        // 8 Cotton Kurta" came back as a customer literally named
        // "Gupta Stores 8 Cotton Kurta". Peel the trailing "<qty> <product>" off
        // for those two only — the other masters have no product line to fill.
        const TAIL_DOCS = new Set(['DeliveryChallan', 'SalesEstimate']);
        const UNIT_ONLY = /^(?:m|mt|meters?|metres?|kgs?|kilos?|grams?|gm|gms|l|lt|litres?|liters?|ml|pcs?|pieces?|nos?|units?|boxes?|box|packs?|dozen|pairs?|sets?|rolls?|bags?)$/i;
        for (const [re, entity, kw, field, ask] of MASTERS) {
            if (re.test(t)) {
                let nm = nameAfter(raw, kw);
                // "create category Monsoon Apparel under Apparel" — the parent
                // department is compulsory on the redesigned dialog.
                const imDeptM = entity !== 'Category' ? null : raw.match(/\b(?:under|in|inside|below)\s+(?:the\s+)?(?:department\s+)?([A-Za-z][A-Za-z0-9 .&'\-]{1,40}?)\s*$/i)
                           || raw.match(/\bdepartment\s+([A-Za-z][A-Za-z0-9 .&'\-]{1,40}?)\s*$/i);
                const imDept = imDeptM ? imDeptM[1].trim() : null;
                if (nm && imDept) nm = nm.replace(new RegExp('\\s*(?:under|in|inside|below)\\s+(?:the\\s+)?(?:department\\s+)?' + imDept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'i'), '').trim();
                const NAME_ONLY = new Set(['Brand', 'Category', 'Department', 'Branch']);
                if (nm && NAME_ONLY.has(entity)) {
                    const at = raw.toLowerCase().indexOf(nm.toLowerCase());
                    const after = at >= 0 ? raw.slice(at + nm.length) : '';
                    const nx = after.match(/^\s+(\d{1,6}[A-Za-z]?)(?=\s+(?:under|in|inside|below|for)\b|\s*$)/i);
                    if (nx) nm = nm + ' ' + nx[1];
                }
                let tailQty = null, tailItem = null;
                if (nm && TAIL_DOCS.has(entity)) {
                    const sp = nm.match(/^(.*?[A-Za-z])\s+(\d{1,6}(?:\.\d+)?)\s+([A-Za-z][A-Za-z0-9\s\-']{1,40})$/);
                    // A trailing unit ("10 meters") is a quantity, not a product.
                    if (sp && !UNIT_ONLY.test(sp[3].trim())) {
                        nm = sp[1].trim(); tailQty = parseFloat(sp[2]); tailItem = sp[3].trim();
                    }
                }
                // These masters take a quantity, and merchants put it last:
                // "opening stock of Cotton Kurta 50", "consumption of Cotton
                // Fabric 10 meters". Peel a trailing number (with or without a
                // unit) off the name rather than saving it as part of the name.
                const QTY_DOCS = new Set(['OpeningStock', 'MaterialConsumption', 'MaterialCreation']);
                if (nm && QTY_DOCS.has(entity) && !tailQty) {
                    const qm = nm.match(/^(.*?[A-Za-z][A-Za-z0-9]*)\s+(\d{1,6}(?:\.\d+)?)\s*([A-Za-z]{1,8})?$/);
                    if (qm && (!qm[3] || UNIT_ONLY.test(qm[3]))) {
                        nm = qm[1].trim(); tailQty = parseFloat(qm[2]);
                    } else {
                        // nameAfter stops at a bare number, so on "opening stock of
                        // Cotton Kurta 50" the name arrives already trimmed and the
                        // quantity is sitting in the raw text just past it.
                        const at = raw.toLowerCase().indexOf(nm.toLowerCase());
                        const after = at >= 0 ? raw.slice(at + nm.length) : '';
                        const am = after.match(/^\s+(\d{1,6}(?:\.\d+)?)\s*([A-Za-z]{1,8})?\s*$/);
                        if (am && (!am[2] || UNIT_ONLY.test(am[2]))) tailQty = parseFloat(am[1]);
                    }
                }
                const qty = getQty(t) || tailQty;
                const amt = getAmt(raw);
                // "create category Apparel in department Garments" — the department
                // is compulsory on the category modal, so capture it here.
                const deptM = entity !== 'Category' ? null : raw.match(/\b(?:in|under|for)\s+department\s+([A-Za-z][A-Za-z0-9 &'\-]{1,30}?)\s*$/i)
                           || raw.match(/\bdepartment\s+([A-Za-z][A-Za-z0-9 &'\-]{1,30}?)\s*$/i);
                const dept = deptM ? deptM[1].trim() : null;
                // nameAfter() grabbed the department clause too, so the category
                // would have been saved as "Apparel in department Clothes".
                if (dept && nm) nm = nm.replace(/\s*\b(?:in|under|for)\s+department\s+.*$/i, '')
                                       .replace(/\s*\bdepartment\s+.*$/i, '').trim() || nm;
                // "create discount Festive 10 percent" / "lead Ramesh Kumar 98…"
                const pctM = entity === 'Discount' ? raw.match(/\b(\d+(?:\.\d+)?)\s*(?:%|percent\w*)/i) : null;
                const mobM = entity === 'CRMLead'  ? raw.match(/\b([6-9]\d{9})\b/) : null;
                return { entity, action:'create', newTask:true,
                    fields:{ ...(nm?{[field]:nm}:{}), ...(tailItem?{itemName:tailItem}:{}),
                             ...(pctM?{discountType:'percentage', value:pctM[1], percentage:pctM[1]}:{}),
                             ...(mobM?{mobile:mobM[1]}:{}),
                             ...(imDept?{department:imDept}:{}),
                             ...(dept?{department:dept}:{}),
                             ...(qty?{qty}:{}), ...(amt?{price:amt, amount:amt}:{}) },
                    isReady: entity === 'Category' ? !!(nm && imDept) : (ask ? !!nm : true),
                    botResponse: (!nm && ask) ? ask
                               : (entity === 'Category' && !imDept)
                                   ? `Which <b>department</b> does ${nm} belong to? (a category has to roll up into one)`
                                   : `Creating ${entity}${nm?` — ${nm}`:''}…` };
            }
        }
        // Stock transfer: "stock transfer notebook1s qty 5 to Surat branch"
        if (/\b(?:create|do|make|new)?\s*stock\s+transfer\b/.test(t) && !/request/i.test(t)) {
            // Both orders are natural: "stock transfer Notebook1 qty 5 to Surat branch"
            // and "stock transfer to Main Branch for Notebook1 1". The old item
            // capture read the second as a product called "to Main Branch for Notebook1".
            const forM  = raw.match(/\bfor\s+([A-Za-z][A-Za-z0-9\s.&'\-]{1,40}?)(?:\s+(?:qty\s*:?\s*)?(\d+(?:\.\d+)?)(?:\s*(?:pcs?|units?|nos?|qty))?)?(?=\s+to\b|\s*$)/i);
            const itemM = forM ? null : raw.match(/\btransfer\s+(?:of\s+)?([A-Za-z][A-Za-z0-9\s\-]{1,40}?)(?=\s+(?:qty|\d|to)\b)/i);
            const toM   = raw.match(/\bto\s+(?:the\s+)?([A-Za-z][A-Za-z0-9\s.&'\-]{1,40}?)(?=\s+(?:for|qty|with)\b|\s+\d|\s*$)/i);
            const item  = forM ? forM[1].trim() : itemM ? itemM[1].trim() : null;
            const q     = getQty(t) || (forM && forM[2] ? parseFloat(forM[2]) : null)
                       || parseFloat((raw.match(/\b(\d+(?:\.\d+)?)\s*(?:pcs?|units?|nos?)?\s+to\b/i) || [])[1]) || null;
            const to    = toM ? toM[1].trim() : null;
            return { entity:'StockTransfer', action:'create', newTask:true,
                fields:{ ...(item?{itemName:item}:{}), ...(q?{qty:q}:{}), ...(to?{toLocation:to}:{}) },
                isReady:!!(item && to),
                botResponse:!item?'Which product to transfer?':!to?'Transfer to which branch/outlet?':`Transferring ${item}${q?` × ${q}`:''} to ${to}…` };
        }
        // Expense: "add expense ₹500 tea"
        if (/\b(?:add|record|create|new)\s+(?:an?\s+)?expense\b/.test(t)) {
            // bare number straight after "expense" counts as the amount ("add expense 500 tea")
            const amt = getAmt(raw) || (raw.match(/\bexpense\s+(?:of\s+)?₹?\s*([\d,]+(?:\.\d+)?)\b/i) || [])[1] || null;
            // Party* and Account* are compulsory on the Expense form
            const partyM = raw.match(/\bto\s+([A-Za-z][A-Za-z0-9\s.&'\-]{1,40}?)(?=\s+(?:account|ledger|for|on)\b|\s*$)/i);
            const acctM  = raw.match(/\b(?:account|ledger)\s+([A-Za-z][A-Za-z0-9\s.&'\-]{1,40}?)(?=\s+(?:to|for|on)\b|\s*$)/i);
            const descM  = raw.match(/\bexpense\s+(?:of\s+)?(?:₹?\s*[\d,]+(?:\.\d+)?\s+)?(?:for\s+|on\s+)?([A-Za-z][A-Za-z\s]{2,40}?)(?=\s+(?:to|account|ledger|gst|tax|exempt(?:ed)?|(?:no|without|non)[\s-]*gst)\b|\s*$)/i);
            const party = partyM ? partyM[1].trim().replace(/\s+(?:gst|tax)\b.*$/i, '').replace(/\s+(?:no|without|non)\s+gst\b.*$/i, '') : null;
            let acct  = acctM  ? acctM[1].trim()  : null;
            // Tax on the line is compulsory: "gst 18" / "tax 5%" / "no gst"
            const noTax = /\b(?:no|without|non)[\s-]*(?:gst|tax)\b|\bexempt\b/i.test(raw);
            const taxM  = raw.match(/\b(?:gst|tax)\s*@?\s*(\d+(?:\.\d+)?)\s*%?/i);
            const tax   = noTax ? '0' : taxM ? taxM[1] : null;
            if (acct) acct = acct.replace(/\s+(?:gst|tax)\s*@?\s*\d.*$/i, '').replace(/\s+(?:no|without|non)[\s-]*(?:gst|tax)\b.*$/i, '').trim();
            return { entity:'Expense', action:'create', newTask:true,
                fields:{ ...(amt?{amount:amt}:{}), ...(descM?{description:descM[1].trim()}:{}),
                         ...(party?{partyName:party}:{}), ...(acct?{account:acct}:{}), ...(tax!=null?{tax}:{}) },
                isReady:!!(amt && party && acct && tax != null),
                botResponse: !amt   ? 'Expense amount?'
                           : !party ? 'Who did you pay? (the Party — it\'s compulsory)'
                           : !acct  ? `Which expense account/ledger should ₹${amt} go to? (compulsory)`
                           : tax == null ? `Which <b>GST</b> applies to this expense? (e.g. "gst 18", or "no gst" — compulsory)`
                           : `Recording ₹${amt} expense to ${party}…` };
        }
    }

    // ── 9ei. E-INVOICE / E-WAY BILL for a specific document ──────────────────
    // "generate e-invoice for INV001241" / "generate eway bill for INV001241 distance 45 km"
    // Recon: invoice detail page has [onclick*=GenerateE_Invoice] (POST /einvoice/sales/<id>/
    // generateinvoice) and [onclick*=genEwayBill] → #generate_ewaybill_modal (distance in km).
    if (/\be[\s-]?invoice\b|\be[\s-]?way\b/i.test(t) && /\b(?:generate|create|make)\b/.test(t)) {
        const isEway = /e[\s-]?way/i.test(t);
        const refM = raw.match(/\b((?:INV|TEST|POS|DC)[-#]?\w*\d+[\w\-]*)\b/i)
                  || raw.match(/\b(?:invoice|challan)\s+#?([A-Z]*\d[\w\-]*)\b/i);
        const distM = raw.match(/\bdistance\s*(?:of\s*|is\s*)?(\d{1,4})\b/i) || raw.match(/\b(\d{1,4})\s*kms?\b/i);
        if (refM) {
            return { entity:'EInvoiceDoc', action:'generate', newTask:true, isReady:true,
                fields:{ invoiceNumber: refM[1].toUpperCase(), type: isEway ? 'eway' : 'einvoice',
                         ...(distM ? { distance: distM[1] } : {}) },
                botResponse:`Generating ${isEway?'E-Way Bill':'E-Invoice'} for ${refM[1].toUpperCase()}…` };
        }
        // No doc reference → trigger on whatever page is open (previous behavior, now Tier-0)
        return { entity: isEway ? 'EWayBill' : 'EInvoice', action:'generate', newTask:true, isReady:true,
            fields: distM ? { distance: distM[1] } : {},
            botResponse:`Generating ${isEway?'E-Way Bill':'E-Invoice'} on this page…` };
    }

    // ── 9st. STOCK TRANSFER / TRANSFER REQUEST — recon label "To Location" ───
    // "create stock transfer request to Coordsbranch for shinchan t-shirt 10"
    if (/\b(?:create|add|new|make|raise)\s+(?:a\s+)?stock\s+transfer(\s+request)?\b/.test(t)) {
        const isReq = /\brequest\b/.test(t);
        const locM  = raw.match(/\bto\s+([A-Za-z][A-Za-z0-9\s.&_\-]{1,40}?)(?=\s+(?:for|item|product|of|qty|\d)|\s*$)/i);
        const itemM = raw.match(/\b(?:for|item|product|of)\s+([A-Za-z0-9][A-Za-z0-9\s\-]{1,40}?)(?=\s+qty|\s+\d|\s*$)/i);
        const qty   = getQty(t) || (itemM ? parseFloat((raw.slice(raw.indexOf(itemM[1]) + itemM[1].length)
                          .match(/^\s+(?:qty\s*:?\s*)?(\d+(?:\.\d+)?)\b/i) || [])[1]) || null : null);
        const ent   = isReq ? 'StockTransferRequest' : 'StockTransfer';
        return { entity:ent, action:'create', newTask:true,
            fields:{ ...(locM?{toLocation:locM[1].trim()}:{}), ...(itemM?{itemName:itemM[1].trim()}:{}), ...(qty?{qty}:{}) },
            isReady: !!locM,
            botResponse: !locM ? 'Which location should it go to?'
                               : `Opening ${isReq?'Stock Transfer Request':'Stock Transfer'} to ${locM[1].trim()}…` };
    }

    // ── 9bt. BANK TRANSACTION — money between two accounts ("Cash" is one) ───
    // "transfer 50000 from HDFC Bank to ICICI" / "deposit 10000 to SBI"
    // / "withdraw 5000 from HDFC" — deposit/withdraw are just Cash on one side.
    // "transfer 5 PP10955 from main to testB" names GOODS between the number and
    // "from/to"; "transfer 5000 from HDFC to cash" goes straight to "from".
    const goodsMove = /\b(?:transfer|move|send|shift)\s+\d+(?:\.\d+)?\s+(?!(?:rs|inr|rupees?|from|to)\b)[A-Za-z][\w\-']*/i.test(raw);
    if (/\b(?:transfer|deposit|withdraw|withdrawal)\b/.test(t) && !goodsMove && !/\bstock\b|\bmaterial\b|\binternal\s+transfer\b/.test(t)) {
        const amt = getAmt(raw) || (raw.match(/\b(\d[\d,]*(?:\.\d+)?)\b/) || [])[1] || null;
        const fromM = raw.match(/\bfrom\s+([A-Za-z][A-Za-z0-9\s.&()\-]{1,40}?)(?=\s+to\b|\s*$)/i);
        const toM   = raw.match(/\bto\s+([A-Za-z][A-Za-z0-9\s.&()\-]{1,40}?)(?=\s+from\b|\s*$)/i);
        let from = fromM ? fromM[1].trim() : null;
        let to   = toM   ? toM[1].trim()   : null;
        if (/\bdeposit\b/.test(t) && !from) from = 'Cash';     // cash -> bank
        if (/\bwithdraw/.test(t)  && !to)   to   = 'Cash';     // bank -> cash
        if (amt && (from || to)) {
            return { entity:'BankTransaction', action:'create', newTask:true,
                fields:{ ...(from?{fromAccount:from}:{}), ...(to?{toAccount:to}:{}), amount:String(amt).replace(/,/g,'') },
                isReady: !!(amt && from && to),
                botResponse: !from ? 'Which account is the money coming FROM?'
                           : !to   ? `Which account should the ₹${amt} go TO?`
                           : `Moving ₹${amt}: ${from} → ${to}…` };
        }
    }

    // ── 9xl. EXPORT THE CURRENT LIST TO EXCEL ────────────────────────────────
    // v9.12.0 lets Stock Verification export before approval; every list page has
    // an export control, so this works generically wherever the user already is.
    if (/\b(?:export|download)\b/.test(t) && /\b(?:excel|xls|xlsx|csv|sheet|to\s+excel)\b/i.test(t)) {
        return { entity:'ExportExcel', action:'export', newTask:true, isReady:true, fields:{},
            botResponse:'Exporting this list to Excel…' };
    }

    // ── 9sv. STOCK VERIFICATION (physical count) — /inventorytracking/new ────
    // "create stock verification for shinchan t-shirt" / "verify stock of X qty 20"
    if (/\b(?:create|start|do|new|add)\s+(?:a\s+)?(?:stock\s+verification|physical\s+(?:stock\s+)?count|stock\s+check)\b/.test(t)
        || /\bverify\s+stock\b/.test(t)) {
        const itemM = raw.match(/\b(?:for|of)\s+([A-Za-z0-9][A-Za-z0-9\s\-]{1,40}?)(?=\s+qty|\s+\d|\s*$)/i);
        // "for Notebook1 10" — the counted quantity is the number after the product
        const qty = getQty(t) || (itemM ? parseFloat((raw.slice(raw.indexOf(itemM[1]) + itemM[1].length)
                        .match(/^\s+(?:qty\s*:?\s*)?(\d+(?:\.\d+)?)\b/i) || [])[1]) || null : null);
        return { entity:'StockVerification', action:'create', newTask:true, isReady:true,
            fields:{ ...(itemM ? { itemName: itemM[1].trim() } : {}), ...(qty ? { qty } : {}) },
            botResponse:`Opening Stock Verification${itemM ? ` for ${itemM[1].trim()}` : ''}…` };
    }

    // ── 9r. USER ROLE — create on /users/user-roles/new (React "Users Setup") ─
    // "create role Cashier" / "create user role Manager with all permissions"
    // Allow a job phrase between the verb and "role" — "create a cashier role",
    // "create an accountant role" — not just "create role X".
    if (/\b(?:create|add|new)\s+(?:(?:a|an|the)\s+)?(?:[a-z][a-z ]{0,24}\s+)?(?:user\s+)?role\b/.test(t)
        && !/\bemployee\b/.test(t)) {
        // "create a cashier role called Till Staff" — the JOB drives the
        // permissions, the name is just a label, and either may come first.
        const nmM = raw.match(/\brole\s+(?:named\s+|called\s+)?["']?([A-Za-z][A-Za-z0-9 _\-]{1,30}?)["']?(?=\s+with\b|\s*$)/i)
                 || raw.match(/\b(?:named|called)\s+["']?([A-Za-z][A-Za-z0-9 _\-]{1,30}?)["']?(?=\s+with\b|\s*$)/i);
        const allPerms = /\b(?:all|full)\s+(?:permissions?|access|modules?|rights?)\b/i.test(t);
        const PRESETS = [
            [/\bcashier|billing\s*(staff|clerk)|till\b/,          'cashier'],
            [/\bpurchas(?:e|ing)\s*(?:manager|executive|officer)?\b/, 'purchase manager'],
            [/\bsales\s*(?:manager|executive|officer)\b/,         'sales manager'],
            [/\baccountant|accounts?\s*(?:manager|executive)\b/,  'accountant'],
            [/\bstore\s*keeper|storekeeper|inventory\s*manager|warehouse\b/, 'storekeeper'],
        ];
        const preset = (PRESETS.find(([re]) => re.test(t)) || [])[1] || null;
        const roleName = nmM ? nmM[1].trim()
                        : preset ? preset.replace(/\b\w/g, c => c.toUpperCase())
                        : null;
        return { entity:'UserRole', action:'create', newTask:true,
            fields:{ ...(roleName ? { roleName } : {}), allPerms, ...(preset ? { preset } : {}) },
            isReady: !!roleName,
            botResponse: roleName
                ? `Creating role "${roleName}"${allPerms ? ' with all permissions'
                    : preset ? ` with ${preset} permissions` : ''}…`
                : 'What should the new role be called?' };
    }

    // ── 9e. SALES INVOICE ────────────────────────────────────────────────────
    if ((/\b(?:create|add|new)\s+(?:a\s+)?(?:sales?\s+invoice|tax\s+invoice)\b/.test(t) ||
         (/\b(?:sales?\s+invoice|tax\s+invoice|invoice)\b/.test(t) && /\bfor\s+[A-Za-z]/i.test(t))) && !/purchase|supplier|vendor/i.test(t)
        && !/\b(?:collect|receive|receipt|payment|paid)\b/i.test(t)) {
        // The name has to stop before a document reference too, or "for Gupta
        // Stores SO POS22" reads the customer as "Gupta Stores SO POS22" and
        // matches no contact at all.
        const custM = raw.match(/\b(?:for|from|to)\s+([A-Za-z][A-Za-z\s.&\-']{1,40}?)(?=\s+(?:item|product|of|against|so\b|order\b|challan\b|dc\b|est\b|estimate\b|\d))/i)
                   || raw.match(/\b(?:for|from|to)\s+([A-Za-z][A-Za-z\s.&\-']{1,40}?)(?:\s*$)/i);
        const customer = custM ? custM[1].trim() : null;
        const itemM = raw.match(/\b(?:item|product|of)\s+([A-Za-z][A-Za-z0-9\s\-]{1,40}?)(?:\s+qty|\s+\d|$)/i);
        const tail  = qtyItemTail(raw, customer);
        const item  = itemM ? itemM[1].trim() : (tail.tailItem || null);
        const qty   = getQty(t) || tail.tailQty || null;
        const price = getRate(raw);
        const soM   = raw.match(/\bso[-\s#]?([\w\-]+)\b/i);
        const soNumber = soM ? soM[1].toUpperCase() : null;
        // "b2b", "wholesale", "trade rate", "bulk" all mean the same thing to the
        // ERP: bill this one at the wholesaler tier rather than the retail one.
        const tradeTier = /\b(?:b2b|whole\s*sale|wholesaler|bulk|trade\s*(?:rate|price)?|dealer|distributor)\b/i.test(t) ? 'wholesaler'
                        : /\b(?:b2c|retail(?:er)?|counter\s*price|consumer)\b/i.test(t) ? 'retailer' : null;
        return { entity:'SalesInvoice', action:'create', newTask:true,
            fields:{ customerName:customer, itemName:item, qty, ...(price?{price}:{}), ...(soNumber?{soNumber}:{}),
                     ...(tradeTier?{contactType:tradeTier}:{}) },
            // Invoicing AGAINST a sales order or challan pulls the lines, quantities
            // and rates from that document — asking for them again would be asking
            // the user to retype what the ERP already knows, and risks contradicting
            // it. So a named parent makes item and qty unnecessary, not missing.
            isReady:!!(customer && (soNumber || (item && qty))),
            botResponse:!customer?'Customer name?'
                       : soNumber?`Invoicing ${customer} against ${soNumber}…`
                       : !item?`Item for ${customer}?`:!qty?`Quantity?`:`Creating invoice for ${customer}…` };
    }

    // ── 10-inv. COLLECT AGAINST A SPECIFIC INVOICE — mirror of bill payment
    // "collect invoice INV001241 in cash" / "receive payment for INV1225 500 upi"
    if (/\b(?:collect|receive|receipt|record\s+payment|payment)\b/.test(t) && /\b(?:invoice|inv[-#\s\/]?\d)/i.test(t)) {
        const refM = raw.match(/\b((?:INV|TEST|POS)[-#\/]?\w*\d+[\w\-\/]*)\b/i) || raw.match(/\binvoice\s+(?:no\.?\s*)?#?([A-Z]*[\/\-]?\d[\w\-\/]*)\b/i);
        if (refM) {
            const amt = getAmt(raw) || (raw.match(/\b(\d[\d,]*(?:\.\d+)?)\s*(?:cash|upi|bank|card)?\s*$/i) || [])[1] || null;
            return { entity:'InvoiceReceipt', action:'create', newTask:true,
                fields:{ invoiceNumber: refM[1].toUpperCase(),
                         ...(amt ? { amount: String(amt).replace(/,/g,'') } : {}),
                         paymentMode: getPay(t) || 'Cash' },
                isReady:true,
                botResponse:`Collecting against ${refM[1].toUpperCase()}${amt?` — ₹${amt}`:' (full due)'} via ${getPay(t)||'Cash'}…` };
        }
    }

    // ── 10-bill. PAY A SPECIFIC BILL — VasyERP's real flow: bill → Make Payment
    // "pay supplier bill BIL506 in cash" / "pay bill BIL506 200 cash"
    if (/\bpay\b/.test(t) && /\b(?:supplier\s+|purchase\s+)?bill\b/.test(t)) {
        const refM = raw.match(/\b((?:BIL{1,2}|PO)[-#]?\d+[\w\-]*)\b/i) || raw.match(/\bbill\s+#?([A-Z]*\d[\w\-]*)\b/i);
        if (refM) {
            const amt = getAmt(raw) || (raw.match(/\b(\d[\d,]*(?:\.\d+)?)\s*(?:cash|upi|bank|card)?\s*$/i) || [])[1] || null;
            const full = /\b(all|full|entire|whole)\b/i.test(t);
            return { entity:'BillPayment', action:'create', newTask:true,
                fields:{ billNumber: refM[1].toUpperCase(),
                         ...(amt ? { amount: String(amt).replace(/,/g,'') } : (full ? { amount: 'FULL' } : {})),
                         paymentMode: getPay(t) || 'Cash' },
                isReady:true,
                botResponse:`Paying bill ${refM[1].toUpperCase()}${amt?` — ₹${amt}`:' (full due)'} via ${getPay(t)||'Cash'}…` };
        }
    }

    // ── 10. PAYMENT to supplier ──────────────────────────────────────────────
    // "pay Sharma 12000" and "pay 12000 to Sharma" are the same instruction, but
    // only the first used to match — the trigger insisted on a letter right after
    // the verb, so the amount-first phrasing fell through to no handler at all.
    {
        const allDue = raw.match(/^(?:please\s+)?(?:pay|clear|settle)\s+(?:all\s+|the\s+)*(?:pending|due|outstanding|unpaid)\s+(?:bills?|dues?|amount|payments?)\s+(?:of|to|for)\s+(.+?)\s*$/i);
        if (allDue) {
            const who = allDue[1].trim().replace(/\s+(?:in\s+|by\s+|via\s+)?(?:cash|upi|neft|rtgs|imps|bank|card|cheque)$/i, '');
            return { entity:'PartyBalance', action:'view', newTask:true, isReady:true, _source:'local',
                fields:{ partyName: who, then: 'pay' }, botResponse:`Checking what you owe ${who}…` };
        }
    }
    if (/\b(?:pay|payment\s+to)\s+(?:₹?\s*[\d,]|[A-Za-z])/.test(t) && !/receipt|receive|collect/.test(t)) {
        // "pay 12000 to Sharma" puts the amount where the name normally sits, so
        // read the party after "to" in that shape and after the verb otherwise.
        const amtFirst = /\bpay(?:ment)?\s+₹?\s*[\d,]+(?:\.\d+)?\s+to\s+[A-Za-z]/i.test(raw);
        const party  = (amtFirst ? nameAfter(raw, 'to') : nameAfter(raw, 'pay(?:ment)?(?:\\s+to)?'))
                    || nameAfter(raw, 'to');
        const amount = getAmtLoose(raw);
        const pm     = getPay(t);
        if (party || amount) {
            return { entity:'Payment', action:'create', newTask:true, fields:{ partyName:party, amount, paymentMode:pm },
                isReady:!!(party&&amount&&pm), botResponse:!party?'Supplier name?':!amount?`Amount to pay ${party}?`:!pm?'Payment mode (Cash/UPI/NEFT)?':`Recording ₹${amount} payment to ${party}…` };
        }
    }

    // ── 10. RECEIPT from customer ────────────────────────────────────────────
    if (/\b(?:receive[d]?|receipt|collect(?:ed)?)\s+/.test(t) && /(?:\bfrom\b|₹|\d)/.test(t)
        && !/\b(?:goods?|material|stock|consignment|shipment|inward|grn)\b/i.test(t)) {
        const party  = nameAfter(raw, 'from');
        const amount = getAmtLoose(raw);
        const pm     = getPay(t);
        if (party || amount) {
            return { entity:'Receipt', action:'create', newTask:true, fields:{ partyName:party, amount, paymentMode:pm },
                isReady:!!(party&&amount&&pm), botResponse:!party?'Customer name?':!amount?`Amount from ${party}?`:!pm?'Payment mode?':`Recording ₹${amount} receipt from ${party}…` };
        }
    }

    // ── 11. EXPENSE ──────────────────────────────────────────────────────────
    if (/\b(?:expense|petty\s+cash)\b/.test(t) && getAmt(raw)) {
        const amount = getAmt(raw);
        const pm     = getPay(t);
        const descM  = raw.match(/(?:for|:)\s+([A-Za-z][A-Za-z\s]{2,40}?)(?:\s*,|$)/i);
        return { entity:'Expense', action:'create', newTask:true, fields:{ amount, paymentMode:pm||'Cash', description:descM?descM[1].trim():null },
            isReady:!!(amount&&pm), botResponse:!pm?'Payment mode (Cash/UPI)?':`Recording ₹${amount} expense…` };
    }

    // ── 12. BANK RECONCILIATION ───────────────────────────────────────────────
    if (/\bbank\s+reconcil|\breconcil\b/.test(t)) {
        return { entity:'BankReconciliation', action:'view', newTask:true, fields:{}, isReady:true, botResponse:'Opening bank reconciliation…' };
    }

    // ── 13. REPORTS ───────────────────────────────────────────────────────────
    const REPORT_PATTERNS = [
        [/\bsales?\s+report\b|\bsales?\s+today\b|\bsales?\s+summary\b/,    'Sales Report'],
        [/\bsales?\s+register\b/,                                           'Sales Register'],
        [/\bsales?\s+item\s+register\b/,                                    'Sales Item Register'],
        [/\bpurchase\s+report\b|\bpurchase\s+summary\b/,                    'Purchase Report'],
        [/\bpurchase\s+register\b/,                                         'Purchase Register'],
        [/\bstock\s+(?:report|register|summary|ledger)\b|\bstock\s+today\b/,'Stock Summary'],
        [/\blow\s+stock\b/,                                                  'Low Stock'],
        [/\bday\s*book\b/,                                                   'Day Book'],
        [/\bcash\s*book\b/,                                                  'Cash Book'],
        [/\bbank\s*book\b/,                                                  'Bank Book'],
        [/\bgstr\s*1\b|\bgstr1\b/,                                          'GSTR1'],
        [/\bgstr\s*2\b|\bgstr2\b/,                                          'GSTR2'],
        [/\bgstr\s*3\b|\bgstr3\b/,                                          'GSTR3'],
        [/\bgst\s+report\b/,                                                 'GSTR1'],
        [/\btrial\s+balance\b/,                                             'Trial Balance'],
        [/\bprofit\s+(?:and\s+)?loss\b|\bp&l\b|\bpnl\b/,                   'Profit Loss'],
        [/\bbalance\s+sheet\b/,                                             'Balance Sheet'],
        [/\bcustomer\s+outstanding\b/,                                       'Customer Outstanding'],
        [/\bsupplier\s+outstanding\b/,                                       'Supplier Outstanding'],
        [/\bgeneral\s+ledger\b/,                                            'General Ledger'],
        [/\bpos\s+(?:report|order\s+list)\b/,                               'POS Report'],
        [/\bexpense\s+register\b/,                                          'Expense Register'],
        [/\bloyalty\s+report\b/,                                            'Loyalty Report'],
    ];
    for (const [re, reportType] of REPORT_PATTERNS) {
        if (re.test(t)) {
            const { fromDate, toDate } = dateRange(t);
            const acct = ledgerAccount(raw, reportType);
            return { entity:'Report', action:'fetch', newTask:true, fields:{ reportType, fromDate, toDate, ...(acct ? { account: acct } : {}) },
                isReady:true, botResponse:`Opening ${reportType}${fromDate?` (${fromDate} – ${toDate})`:''}…` };
        }
    }

    // ── 97. CANCEL a posted document — never guess it into a create ─────────
    {
        const cm = raw.match(/^(?:please\s+)?(?:cancel|void|reverse|undo)\s+(?:the\s+)?(sales\s+invoice|invoice|bill|pos\s+bill|receipt|payment|order|purchase\s+order|po|grn|challan)\s*(?:no\.?\s*)?#?\s*(\S*\d\S*)?\s*$/i);
        if (cm) {
            const doc = cm[1].toLowerCase(), ref = cm[2] || '';
            const how = /invoice|bill/.test(doc) && !/pos/.test(doc)
                ? `To reverse a sales invoice, raise a credit note against it — e.g. <i>"create credit note for &lt;customer&gt; invoice ${ref || 'INV/…'}"</i>.`
                : /pos/.test(doc) ? `For a counter sale, use a POS return — e.g. <i>"refund POS bill ${ref || '…'}"</i>.`
                : `Open it in VasyERP and use its own Cancel/Delete — I don't cancel posted documents myself.`;
            return { entity:null, action:'chat', newTask:true, isReady:false, fields:{},
                botResponse:`I won't cancel ${ref ? '<b>' + ref + '</b>' : 'that'} for you — cancelling a posted document changes your books. ${how}` };
        }
    }

    // ── 98. EDIT / DELETE a contact or product ───────────────────────────────
    // These had no local rule at all: without an AI key "edit supplier X mobile Y"
    // ended in "which one — contact, supplier bill or payment?".
    {
        const onForm = /\/(?:new|edit)\b|\/\d+\/edit/.test(typeof currentPage === 'string' ? currentPage : '');
        const FIELD = { mobile:'mobile', phone:'mobile', number:'mobile', 'mobile number':'mobile', 'phone number':'mobile', whatsapp:'mobile',
                        email:'email', 'email id':'email', gstin:'gstin', gst:'gstin', 'gst number':'gstin', 'gst no':'gstin', pan:'pan', 'pan number':'pan',
                        company:'companyName', 'company name':'companyName', address:'address', pincode:'pinCode', 'pin code':'pinCode', pin:'pinCode' };
        const PFIELD = { price:'price', 'selling price':'price', 'sale price':'price', sp:'price', mrp:'mrp',
                         'purchase price':'purchasePrice', cost:'purchasePrice', 'cost price':'purchasePrice', hsn:'hsn', 'hsn code':'hsn', name:'productName' };
        const fkeys = Object.keys(FIELD).sort((a, b) => b.length - a.length).join('|');
        const pkeys = Object.keys(PFIELD).sort((a, b) => b.length - a.length).join('|');
        const ctype = w => /supplier|vendor/i.test(w) ? 'Supplier' : /transport/i.test(w) ? 'Transport' : /customer|client/i.test(w) ? 'Customer' : null;
        const clean = v => String(v).trim().replace(/^(?:to|as|=)\s*/i, '').replace(/[.;]+$/, '').trim();
        let m;
        // "edit supplier Sharma Textiles mobile 9123456789" / "update customer Raj email to raj@x.com"
        if ((m = raw.match(new RegExp(String.raw`^(?:please\s+)?(?:edit|update|change|modify|correct)\s+(?:the\s+)?(customer|client|supplier|vendor|transporter|contact)\s+(.+?)(?:'s)?\s+(${fkeys})\s+(?:to\s+|as\s+|=\s*)?(.+)$`, 'i')))) {
            const key = FIELD[m[3].toLowerCase()];
            return { entity:'Contact', action:'edit', newTask:true, isReady:true,
                fields:{ searchQuery: m[2].trim(), ...(ctype(m[1]) ? { contactType: ctype(m[1]) } : {}), [key]: clean(m[4]) },
                botResponse:`Updating ${m[2].trim()} — ${m[3]} → ${clean(m[4])}…` };
        }
        // "change mobile of customer Raj to 98…" / "set the email of Sharma Textiles to …"
        if ((m = raw.match(new RegExp(String.raw`^(?:please\s+)?(?:change|update|set|correct)\s+(?:the\s+)?(${fkeys})\s+(?:of|for)\s+(?:(customer|client|supplier|vendor|transporter)\s+)?(.+?)\s+(?:to|as)\s+(.+)$`, 'i'))) && !onForm) {
            const key = FIELD[m[1].toLowerCase()];
            return { entity:'Contact', action:'edit', newTask:true, isReady:true,
                fields:{ searchQuery: m[3].trim(), ...(m[2] && ctype(m[2]) ? { contactType: ctype(m[2]) } : {}), [key]: clean(m[4]) },
                botResponse:`Updating ${m[3].trim()} — ${m[1]} → ${clean(m[4])}…` };
        }
        // "edit product Notebook1 price 450" / "update item Blue Pen mrp to 25"
        if ((m = raw.match(new RegExp(String.raw`^(?:please\s+)?(?:edit|update|change|modify|correct)\s+(?:the\s+)?(?:product|item)\s+(.+?)(?:'s)?\s+(${pkeys})\s+(?:to\s+|as\s+|=\s*)?(?:rs\.?\s*|₹\s*)?(.+)$`, 'i')))) {
            const key = PFIELD[m[2].toLowerCase()];
            return { entity:'Product', action:'edit', newTask:true, isReady:true,
                fields:{ searchQuery: m[1].trim(), [key]: clean(m[3]).replace(/^(?:rs\.?\s*|₹\s*)/i, '') },
                botResponse:`Updating ${m[1].trim()} — ${m[2]} → ${clean(m[3])}…` };
        }
        // "change price of Notebook1 to 450" — a named product, unless a form is open
        if (!onForm && (m = raw.match(new RegExp(String.raw`^(?:please\s+)?(?:change|update|set|make)\s+(?:the\s+)?(${pkeys})\s+(?:of|for)\s+(?:(?:the\s+)?(?:product|item)\s+)?(.+?)\s+(?:to|as)\s+(?:rs\.?\s*|₹\s*)?(\d[\d,]*(?:\.\d+)?)\s*$`, 'i')))) {
            const key = PFIELD[m[1].toLowerCase()];
            return { entity:'Product', action:'edit', newTask:true, isReady:true,
                fields:{ searchQuery: m[2].trim(), [key]: m[3].replace(/,/g, '') },
                botResponse:`Updating ${m[2].trim()} — ${m[1]} → ₹${m[3]}…` };
        }
        // "delete customer Test Buyer 837" / "deactivate product Blue Pen" — the
        // handler shows the exact record and waits for "yes".
        if ((m = raw.match(/^(?:please\s+)?(delete|remove|deactivate|disable|inactivate)\s+(?:the\s+)?(customer|client|supplier|vendor|transporter|contact|product|item)\s+(.+?)\s*$/i))) {
            const isProd = /product|item/i.test(m[2]);
            const deact = /deactivate|disable|inactivate/i.test(m[1]);
            return { entity: isProd ? 'Product' : 'Contact', action: deact ? 'deactivate' : 'delete', newTask:true, isReady:true,
                fields:{ searchQuery: m[3].trim(), ...(!isProd && ctype(m[2]) ? { contactType: ctype(m[2]) } : {}) },
                botResponse:`Finding ${m[3].trim()} — I'll show you the record before anything is ${deact ? 'deactivated' : 'deleted'}…` };
        }
    }

    // ── 98c. CATEGORY delete / merge (V9.14.0) — deleting a category now first
    // MOVES its products into another category. That can't be undone and needs a
    // target the user chooses, so open the category and explain rather than do it.
    {
        const dm = raw.match(/^(?:please\s+)?(?:delete|remove)\s+(?:the\s+)?categor(?:y|ies)\s+(.+?)\s*$/i)
                || raw.match(/^(?:please\s+)?(?:merge|combine)\s+(?:the\s+)?categor(?:y|ies)\s+(.+?)\s+(?:into|with|to)\s+(?:the\s+)?(?:category\s+)?(.+?)\s*$/i)
                || raw.match(/^(?:please\s+)?(?:move|transfer|shift)\s+(?:all\s+)?(?:the\s+)?(?:products?|items?)\s+(?:from|of|in)\s+(?:the\s+)?categor(?:y|ies)\s+(.+?)\s+(?:into|to)\s+(?:the\s+)?(?:category\s+)?(.+?)\s*$/i);
        if (dm) {
            const from = dm[1].trim(), to = (dm[2] || '').trim();
            return { entity:'Category', action:'search', newTask:true, isReady:true, _source:'local',
                fields:{ searchQuery: from,
                         note: `Since VasyERP 9.14, deleting a category first <b>moves its products</b> into another category${to ? ` (you said <b>${to}</b>)` : ''}. ` +
                               `That can't be undone, so I leave it to you: on the <b>${from}</b> row choose <b>Delete</b>, pick ${to ? `<b>${to}</b>` : 'the category that should receive its products'} and confirm.` },
                botResponse:`Opening category ${from}…` };
        }
    }

    // ── 99. GENERIC FIELD FILL — "set GSTIN to X", "change credit limit to 5000"
    // Last on purpose: every specific rule above (settings, loyalty rates,
    // documents) gets first refusal, and only a plain field assignment is left.
    if (/^(?:please\s+|pls\s+|kindly\s+)?(?:set|change|update|fill(?:\s+in)?|enter|put|mark)\b/i.test(raw.trim())
        && /\s(?:to|as|with)\s|[:=]/i.test(raw)
        && !/\b(?:create|new|add)\s+(?:a\s+)?(?:customer|supplier|product|invoice|order|bill|employee|role)\b/i.test(t)) {
        const fa = parseFieldAssignments(raw);
        if (fa.pairs.length) {
            return { entity:'FieldFill', action:'fill', newTask:true, isReady:true, _source:'local',
                fields:{ pairs: fa.pairs, save: fa.wantsSave },
                botResponse: `Setting ${fa.pairs.map(p => `<b>${p.label}</b>`).join(', ')} on this page…` };
        }
    }

    // ── 14. NAVIGATION ("open/go to X") ──────────────────────────────────────
    if (/^(?:open|go\s+to|show|navigate\s+to|take\s+me\s+to)\s+/.test(t)) {
        const nav = [
            [/\bcontact|customer\s+list|supplier\s+list/,  'Contact',       'list'],
            [/\bemployee|user\s+roles?|users\b/,           'Employee',      'list'],
            [/\bstock\s+transfer/,                         'StockTransfer', 'list'],
            [/\bproduct\b/,                                'Product',       'list'],
            [/\bpos\b(?!\s*(?:orders?|credit|register))/,  'POSSale',       'list'],
            [/\bpurchase\s+order|po\s+list/,               'PurchaseOrder', 'list'],
            [/\bsupplier\s+bill|vendor\s+bill/,            'SupplierBill',  'list'],
            [/\bsales\s+invoice|invoice\s+list/,           'SalesInvoice',  'list'],
            [/\bpayment\s+list/,                           'Payment',       'list'],
            [/\breceipt\s+list/,                           'Receipt',       'list'],
            [/\bcoupon/,                                   'Coupon',        'list'],
            [/\bdiscount/,                                 'Discount',      'list'],
            [/\bmembership/,                               'Membership',    'list'],
            [/\bloyalty/,                                  'Loyalty',       'list'],
            [/\bbranch|outlet/,                            'Branch',        'list'],
            [/\bcategor(y|ies)|brand/,                     'Category',      'list'],
            [/\bbank\s+recon/,                             'BankReconciliation', 'view'],
            // ── v14.0: every remaining module, most-specific first ───────────
            [/\buser\s+roles?|role\s+list/,                'UserRole',      'list'],
            [/\bunit\s+of\s+measurement|\buom\b|\bunits?\b/,'UnitOfMeasurement','list'],
            [/\bcategory\s*wise\s*variant/,                'CategoryVariant','list'],
            [/\bb2b\s*(price|product)/,                    'B2BPriceMapping','list'],
            [/\bconsumption\s*type/,                       'ConsumptionType','list'],
            [/\bpurchase\s*terms?/,                        'PurchaseTerms', 'list'],
            [/\bsales\s*terms?/,                           'SalesTerms',    'list'],
            [/\bcustomer\s*categor/,                       'CustomerCategory','list'],
            [/\becommerce|e-?commerce\s*catalog/,          'EcommerceCatalog','list'],
            [/\bbank\s*transaction/,                       'BankTransaction','list'],
            [/\bowner\s*cash\s*flow/,                      'OwnerCashFlow', 'list'],
            [/\b(manager\s*)?cash\s*flow/,                 'ManagerCashFlow','list'],
            [/\bpos\s*credit\s*note/,                      'POSCreditNote', 'list'],
            [/\b(all\s+)?registers?\b|sales\s*register/,   'SalesRegister', 'list'],
            [/\bpos\s*orders?\b/,                          'POSOrders',     'list'],
            [/\baccount\s*group/,                          'AccountGroup',  'list'],
            [/\bchart\s+of\s+accounts?|\baccounts?\b(?!\s*group)/,'Account', 'list'],
            [/\bjournal\s*voucher|\bjv\b/,                 'JournalVoucher','list'],
            [/\bstorage|\bdrive\b|\bdocuments?\b/,         'Storage',       'list'],
            [/\bbarcode|labels?\b/,                        'BarcodeLabels', 'list'],
            [/\btally\b/,                                  'Tally',         'list'],
            [/\bprefix/,                                   'Prefix',        'list'],
            [/\btax\b|gst\s*(slab|rate)/,                  'Tax',           'list'],
            [/\bpayment\s*terms?/,                         'PaymentTerms',  'list'],
            [/\badditional\s*charge/,                      'AdditionalCharges','list'],
            [/\bmac\s*binding/,                            'MacBinding',    'list'],
            [/\bintegrations?|apps?\s*(&|and)?\s*integration/,'Integrations','list'],
            [/\blogs?\b|activity\s*log/,                   'Logs',          'list'],
            [/\bvina\b/,                                   'Vina',          'list'],
            [/\bstock\s+verification|physical\s+count/,    'StockVerification','list'],
            [/\bdepartment/,                               'Department',    'list'],
            [/\bexpense/,                                  'Expense',       'list'],
            [/\bestimate|quotation/,                       'SalesEstimate', 'list'],
            [/\bdelivery\s*challan/,                       'DeliveryChallan','list'],
            [/\bcredit\s*note/,                            'SalesReturn',   'list'],
            [/\bdebit\s*note/,                             'PurchaseReturn','list'],
            [/\bmaterial\s*inward|\bgrn\b/,                'MaterialInward','list'],
            [/\brecipes?\b/,                               'Recipe',        'list'],
            [/\bbill\s+of\s+materials?|\bbom\b/,           'BillOfMaterials','list'],
            [/\bstocks?\b/,                                'StockAdjust',   'list'],
            [/\bsettings?\b/,                              'Setting',       'list'],
            [/\breport|analytics/,                         'Report',        'list'],
            [/\bdashboard/,                                null,            'list'],
        ];
        for (const [re, entity, action] of nav) {
            if (re.test(t)) return { entity, action, newTask:true, fields:{}, isReady:true, botResponse:'Navigating…' };
        }
    }

    return null; // No high-confidence local match → scope gate, then the classifier
}

// ── STRICT SCOPE GATE — zero credits for non-ERP messages ────────────────────
// Only messages containing ERP vocabulary pass (the classifier can still rescue one).
const ERP_SCOPE_RE = /\b((?:bil{1,2}|po|grn|inv|so)[-#]?\d+|select|choose|settings?|enable|disable|toggle|set|columns?|collect(?:ed)?|deposit|withdraw\w*|uom|vina|receive\w*|recieve\w*|goods?|dispatch\w*|despatch\w*|shelf|sticker\w*|counter|till|approve\w*|reject\w*|stfreq\d*|sales?|sell|sold|purchases?|buy|bought|invoices?|bills?|billing|orders?|po|grn|quotations?|estimates?|challan|customers?|clients?|suppliers?|vendors?|contacts?|products?|items?|stocks?|inventory|batch|barcodes?|qty|quantity|price|pricing|mrp|payments?|receipts?|pay|paid|payable|receive|received|receivable|expenses?|ledger|accounts?|accounting|journal|vouchers?|bank|cash|upi|cheque|credit|debit|gst|vat|tax|hsn|e-?way|e-?invoice|tds|tcs|reports?|dashboard|profit|loss|margin|revenue|turnover|outstanding|dues?|balance|pos|register|discounts?|coupons?|loyalty|membership|crm|leads?|employees?|staff|users?|roles?|branch(es)?|outlets?|franchise|stores?|warehouse|transfers?|adjustments?|returns?|refunds?|categor(y|ies)|brands?|departments?|recipes?|bom|production|materials?|consumption|wastage|erp|vasy|announcements?|targets?|bhi|version|shortcuts?|top|best|least|selling|supplier\s*bill|debit\s*note|credit\s*note|vina|uom|unit\s*of\s*measurement|prefix|tally|barcode|labels?|integrations?|logs?|ledgers?|account\s*group|registers?|cash\s*flow|cashflow|drive|storage|mac\s*binding|catalog|terms?|variants?|recipes?|challan|estimates?)\b/i;
const GREET_RE = /^\s*(hi+|hello+|hey+|namaste|yo|good\s*(morning|afternoon|evening|night)|thanks?|thank\s*you|ty|ok(ay)?|great|nice|cool|help(?:\s+me)?(?:\s+please)?|i\s+need\s+help|what\s+can\s+you\s+do|how\s+(?:do|can)\s+i\s+use\s+(?:this|you|it)|who\s+are\s+you)\s*[!.?\s]*$/i;
// Chat topics with no ERP reading at all (checked only when no ERP word is present)
const OFF_TOPIC_RE = /\b(?:weather|jokes?|poems?|poetry|lyrics|songs?|cricket|football|ipl|movies?|films?|news|sports?|horoscope|riddles?|stor(?:y|ies)|celebrit(?:y|ies)|girlfriend|boyfriend)\b/i;

function checkScopeLocal(text) {
    const t = (text || '').trim();
    // Friendly local greeting/help — no AI call
    if (GREET_RE.test(t)) {
        return { entity: null, action: 'chat', fields: {}, isReady: false, newTask: false, _source: 'local',
            botResponse: `👋 Hi! I'm your VasyERP copilot. I can <b>create</b> (customers, suppliers, orders, invoices, payments…), <b>find</b> things, and <b>answer questions</b> from your dashboard & reports — try <i>"total sales today"</i> or <i>"create customer Raj Sharma"</i>.` };
    }
    // A URL or ERP path in the message is always ERP context (user teaching us
    // where something lives, or asking to open a page) — never refuse those.
    if (/https?:\/\//i.test(t) || VASY_HOST_RE.test(t)) return null;
    // Not ERP vocabulary → refuse locally, zero credits spent
    if (!ERP_SCOPE_RE.test(t)) {
        return { entity: null, action: 'out_of_scope', fields: {}, isReady: true, newTask: false, _source: 'local',
            botResponse: `🔒 I only handle <b>VasyERP</b> work — sales, purchases, inventory, contacts, payments, POS, reports and the like. Try <i>"create customer Raj Sharma"</i> or <i>"who are my top customers?"</i>` };
    }
    return null;
}

// Last known mid-task state — heals the bubble losing its copy (page reload
// during an extension update invalidates the content script's storage access).
let _lastCs = { state: null, time: 0 };

// v9.12.0 introduced Reverse Charge (RCM) on BOTH sales and purchase documents.
// Tag it once here instead of in every document pattern.
const RCM_RE = /\breverse\s*charge\b|\brcm\b/i;
const RCM_ENTITIES = new Set(['SalesInvoice','SalesOrder','SalesEstimate','DeliveryChallan','SalesReturn',
                              'PurchaseOrder','MaterialInward','SupplierBill','PurchaseReturn','DebitNote','CreditNote']);
function applyRcmFlag(intent, text) {
    if (!intent || !RCM_ENTITIES.has(intent.entity) || !RCM_RE.test(text)) return intent;
    intent.fields = intent.fields || {};
    if (intent.fields.reverseCharge == null) {
        intent.fields.reverseCharge = /\b(no|without|not)\s+reverse\s*charge\b/i.test(text) ? 'No' : 'Yes';
    }
    return intent;
}


// ── Report vocabulary ────────────────────────────────────────────────────────
// GENERATED from REPORT_URLS in content_agent.js — keep them in sync (the test
// suite asserts it). The URL table knew 170+ ways people name a report while
// the parser knew a handful, so "stock movement", "tax wise sales" and
// "cheque report" reached no handler at all, and "pending sales orders"
// opened a CREATE form. Longest alias wins, so "low stock report" beats
// "low stock" and both beat "stock".
const REPORT_NAMES = ["purchase and purchase return item register", "sales and sales return item register", "partially received purchase order", "consumption production report", "purchase return item register", "customer invoice outstanding", "category name wise purchase", "customer ledger outstanding", "employee performance report", "material consumption report", "supplier ledger outstanding", "product name wise purchase", "sales order summary report", "credit note item register", "stock verification report", "supplier bill outstanding", "all outlet sales summary", "brand name wise purchase", "debit note item register", "reconciliation statement", "credit note tax summary", "date wise sales summary", "item wise sales summary", "stock adjustment report", "best and least selling", "debit note item report", "debit note tax summary", "journal voucher report", "pending purchase order", "purchase item register", "stock transfer summary", "supplier wise purchase", "tax wise sales summary", "department wise sales", "least selling product", "reconciliation report", "salesman wise summary", "stock transfer report", "supplier wise product", "credit note register", "customer outstanding", "employee performance", "outlet sales summary", "point of sale report", "purchase item report", "purchase tax summary", "salesman performance", "supplier outstanding", "bank reconciliation", "branch wise summary", "category wise sales", "daily sales summary", "debit note register", "employee wise sales", "pending sales order", "price change report", "price master report", "purchase price wise", "sales item register", "sales order summary", "sales person report", "stock ledger report", "verification report", "best least selling", "bill wise discount", "consumption report", "credit note report", "customer type wise", "product wise sales", "sales register new", "amount wise sales", "customer feedback", "debit note report", "membership report", "outlet wise sales", "product price log", "production report", "purchase register", "qty wise purchase", "sales tax summary", "staff performance", "suspended product", "all outlet sales", "brand wise sales", "category summary", "e-invoice report", "eway bill report", "expense register", "inventory report", "low stock report", "sales by product", "salesman summary", "stock adjustment", "customer ledger", "date wise sales", "einvoice report", "ewb einv report", "feedback report", "item wise sales", "loss qty report", "low stock alert", "profit and loss", "purchase report", "register report", "salesman report", "supplier ledger", "tax wise report", "time wise sales", "transfer report", "account ledger", "bank statement", "branch summary", "day wise sales", "expense report", "general ledger", "invoice report", "loyalty report", "outlet summary", "pending orders", "pos order list", "product ageing", "sales register", "stock movement", "stock register", "tax wise sales", "ageing report", "all registers", "balance sheet", "cheque report", "least selling", "order summary", "points report", "product aging", "sales summary", "stock summary", "trial balance", "abc analysis", "batch report", "best selling", "cheque print", "invoice list", "journal book", "price change", "price master", "sales report", "stock ageing", "stock ledger", "stock report", "daily sales", "gst summary", "profit loss", "stock aging", "tax summary", "trial sheet", "abc report", "gst report", "kpi report", "pos report", "tcs report", "tds report", "vat report", "bank book", "cash book", "low stock", "pl report", "pos sales", "bankbook", "cashbook", "day book", "pos list", "daybook", "gstr 1", "gstr 2", "gstr 3", "gstr1", "gstr2", "gstr3", "gst", "kpi", "p&l"];


// ── "set X to Y and Z to W (and save)" ──────────────────────────────────────
// Splits only on an "and"/comma that is followed by another "<label> to" — so
// "set company to Sharma and Sons" stays one value.
function parseFieldAssignments(raw) {
    let s = String(raw || '').trim()
        .replace(/^(?:please\s+|pls\s+|kindly\s+)?(?:set|change|update|fill(?:\s+in)?|enter|put|make|mark)\s+/i, '');
    const saveRe = /\s*(?:,|\band\b)?\s*(?:then\s+)?(?:save|submit)(?:\s+it|\s+this|\s+the\s+form)?\s*[.!]*\s*$/i;
    const wantsSave = saveRe.test(s);
    s = s.replace(saveRe, '');
    const parts = s.split(/\s*(?:,|;|\band\b)\s*(?=(?:set\s+|change\s+|the\s+)?[a-z][a-z0-9 .\/#&'-]{0,32}?\s+(?:to|as|=|with)\s+)/i);
    const pairs = [];
    for (let p of parts) {
        p = p.replace(/^(?:set|change|update|fill|enter|put|make|mark)\s+/i, '').trim();
        const m = p.match(/^(?:the\s+)?(.{1,40}?)\s+(?:to|as|=|with)\s+(.+)$/i) || p.match(/^(.{1,40}?)\s*[:=]\s*(.+)$/);
        if (!m) continue;
        const label = m[1].replace(/\s+(?:field|box|value)$/i, '').trim();
        const value = m[2].trim().replace(/^["'“]|["'”]$/g, '').replace(/[.!]+$/, '');
        if (label && value && label.length <= 40) pairs.push({ label, value });
    }
    return { pairs, wantsSave };
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPOUND COMMANDS — "create customer Kavya and invoice her 2 Notebook1 m",
// "buy 10 Notebook1 from Sharma Textiles at 450 then receive it"
// ──────────────────────────────────────────────────────────────────────────────
// The bubble has always been able to run a chain of steps, but only the cloud
// tier ever produced one, so with no API key a two-step sentence just failed.
// This splits the sentence into clauses, parses each with the same local tiers
// as a single command, and carries the PARTY forward so a later clause can say
// "her" or "it" the way people do. The flow graph supplies what a bare verb
// means after the step before it: "receive it" after a purchase order is the
// goods receipt; "bill it" after a GRN is the supplier bill.
//
// Conservative by design: the split is accepted only if EVERY clause resolves to
// a ready, executable step. Anything less falls back to single-command parsing,
// which will ask for what is missing rather than half-run a chain.
// ══════════════════════════════════════════════════════════════════════════════
const COMPOUND_VERBS = 'create|add|make|raise|sell|pay|collect|receive|record|book|invoice|bill|' +
                       'transfer|issue|return|deliver|dispatch|ship|open|show';
function splitCompound(raw) {
    const text = String(raw || '').trim();
    let parts = text.split(/\s*(?:;|,?\s*\band\s+then\b|,?\s*\bthen\b|,?\s*\bafter\s+that\b|,?\s*\bafterwards\b)\s*/i)
        .map(p => p.trim()).filter(Boolean);
    if (parts.length < 2) {
        // "… and <verb> …" — only where the right-hand side is itself a command,
        // so "Sharma and Sons" and "set X to 1 and Y to 2" stay whole
        parts = text.split(new RegExp('\\s+and\\s+(?=(?:' + COMPOUND_VERBS + ')\\b)', 'i'))
            .map(p => p.trim()).filter(Boolean);
    }
    return parts;
}
function localOne(text, page) {
    const r = localParseTyped(text, { entity: null, action: null, fields: {} }, page);
    return r ? applyRcmFlag(r, text) : null;
}
const PARTY_SIDE = {
    PurchaseOrder:'supplier', MaterialInward:'supplier', SupplierBill:'supplier', PurchaseReturn:'supplier',
    BillPayment:'supplier', Payment:'supplier',
    SalesOrder:'customer', SalesInvoice:'customer', SalesEstimate:'customer', DeliveryChallan:'customer',
    SalesReturn:'customer', Receipt:'customer',
};
function partyOf(intent) {
    const f = (intent && intent.fields) || {};
    if (intent.entity === 'Contact') {
        const nm = f.companyName || [f.firstName, f.lastName].filter(Boolean).join(' ');
        return nm ? { name: nm, side: /supplier|vendor/i.test(f.contactType || '') ? 'supplier' : 'customer' } : null;
    }
    const nm = f.supplierName || f.customerName || f.partyName;
    return nm ? { name: nm, side: PARTY_SIDE[intent.entity] || 'customer' } : null;
}
// A clause that only makes sense after the one before it: rewrite it into the
// full command the single-command parser already understands.
function continuation(clause, prev, party) {
    const c = clause.replace(/^(?:and\s+|also\s+|now\s+)+/i, '').trim();
    const who = party ? party.name : '';
    const rest = c.replace(/^\w+\s+(?:him|her|them|it|this|the\s+(?:goods|bill|order|items))\b\s*/i, '')
                  .replace(/^\w+\s*/, '');
    if (/^receive\b/i.test(c) && who) return `receive goods from ${who}`;
    if (/^(?:book\s+the\s+bill|bill\s+it|enter\s+the\s+bill)\b/i.test(c) && who && party.side === 'supplier')
        return `book the supplier bill for ${who}`;
    if (/^(?:invoice|bill)\b/i.test(c) && who && party.side !== 'supplier') {
        const lines = c.replace(/^(?:invoice|bill)\s+(?:him|her|them|it)?\s*/i, '').replace(/^for\s+\S+\s*/i, '').trim();
        return `create sales invoice for ${who}${lines ? ' ' + lines : ''}`;
    }
    if (/^(?:deliver|dispatch|ship)\b/i.test(c) && who) {
        const lines = c.replace(/^(?:deliver|dispatch|ship)\s+(?:(?:to\s+)?(?:him|her|them)|it)?\s*/i, '').trim();
        return `create delivery challan for ${who}${lines ? ' ' + lines : ''}`;
    }
    if (/^pay\b/i.test(c) && who && !/\bto\s+[A-Z]/i.test(c.replace(/\b(?:him|her|them)\b/i, '')))
        return `pay ${c.replace(/^pay\s+(?:him|her|them|it|the\s+bill)?\s*/i, '')} to ${who}`.replace(/\s+/g, ' ');
    if (/^collect\b/i.test(c) && who && !/\bfrom\s+[A-Z]/.test(c))
        return `collect ${c.replace(/^collect\s+/i, '').replace(/\bfrom\s+(?:him|her|them)\b/i, '')} from ${who}`.replace(/\s+/g, ' ');
    // plain pronoun swap for anything else
    return who ? c.replace(/\b(?:him|her|them)\b/gi, who) : c;
}
function parseCompound(userText, page) {
    const parts = splitCompound(userText);
    if (parts.length < 2 || parts.length > 5) return null;
    const tasks = [];
    let party = null, prev = null;
    for (const part of parts) {
        const text = prev ? continuation(part, prev, party) : part;
        const it = localOne(text, page);
        if (!it || !it.entity || !it.isReady || it.action === 'chat' || it.action === 'out_of_scope' || it.tasks)
            return null;
        // a document that needs a party and didn't name one inherits the last one
        const side = PARTY_SIDE[it.entity];
        if (side && party && party.side === side) {
            const key = it.entity === 'Payment' || it.entity === 'Receipt' ? 'partyName'
                      : side === 'supplier' ? 'supplierName' : 'customerName';
            if (!it.fields[key]) it.fields[key] = party.name;
        }
        tasks.push({ entity: it.entity, action: it.action || 'create', fields: it.fields || {} });
        party = partyOf(it) || party;
        prev = it;
    }
    if (tasks.length < 2) return null;
    const label = e => (typeof flowLabel === 'function' ? flowLabel(e) : e);
    return { entity: tasks[0].entity, action: tasks[0].action, fields: tasks[0].fields,
             isReady: true, newTask: true, tasks, _source: 'local-compound',
             botResponse: `Doing this in ${tasks.length} steps: ${tasks.map((t, i) => `${i + 1}. ${label(t.entity)}`).join(' → ')}` };
}
// ══════════════════════════════════════════════════════════════════════════════
// ERP FLOW GRAPH — what follows what, and what each step insists on
// ──────────────────────────────────────────────────────────────────────────────
// Every entry here was established by running the chain against a live tenant,
// not read off a manual. It earns its place three ways:
//   1. the agent can answer "what happens next" without a network call;
//   2. a handler that hits a missing prerequisite can name the step that
//      produces it, instead of repeating the ERP's own cryptic complaint
//      ("The Qty is required" really means "you skipped the goods receipt");
//   3. a user who asks for step three gets told about step two first.
// `parent` = the document this one is raised AGAINST and cannot be saved without.
const ERP_FLOW = {
    PurchaseOrder:   { chain:'purchase', label:'Purchase Order',        next:'MaterialInward',
                       needs:'a supplier, a product and a quantity' },
    MaterialInward:  { chain:'purchase', label:'Material Inward (GRN)', next:'SupplierBill',
                       parent:'PurchaseOrder', needs:'the purchase order the goods arrived against' },
    SupplierBill:    { chain:'purchase', label:'Supplier Bill',         next:'BillPayment',
                       parent:'MaterialInward', needs:'the material inward being billed' },
    BillPayment:     { chain:'purchase', label:'Payment to supplier',
                       needs:'a cash or bank account, and an allocation (on-account or against a bill)' },
    PurchaseReturn:  { chain:'purchase', label:'Debit Note / Purchase Return',
                       needs:'the supplier and the bill being returned against' },

    SalesEstimate:   { chain:'sales', label:'Estimate / Quotation',   next:'SalesOrder',
                       needs:'a customer, a product and a quantity' },
    SalesOrder:      { chain:'sales', label:'Sales Order',            next:'DeliveryChallan',
                       needs:'a customer, a product and a quantity' },
    DeliveryChallan: { chain:'sales', label:'Delivery Challan',       next:'SalesInvoice',
                       optionalParent:'SalesOrder' },
    SalesInvoice:    { chain:'sales', label:'Sales Invoice',          next:'Receipt',
                       optionalParent:'SalesOrder',
                       needs:'a customer; the lines come from the order or challan when you name one' },
    Receipt:         { chain:'sales', label:'Receipt from customer',
                       needs:'a cash or bank account and an amount' },
    SalesReturn:     { chain:'sales', label:'Credit Note / Sales Return',
                       needs:'the customer and the invoice being returned against' },

    POSSale:         { chain:'pos', label:'POS counter sale',
                       gate:'an open sales register for the outlet',
                       needs:'a product, a quantity and a payment mode' },

    Recipe:          { chain:'manufacturing', label:'Recipe',             next:'MaterialConsumption' },
    MaterialConsumption:{ chain:'manufacturing', label:'Material Consumption', next:'MaterialCreation',
                       needs:'the raw item and the quantity issued' },
    MaterialCreation:{ chain:'manufacturing', label:'Material Creation',  next:'StockVerification',
                       needs:'the finished item and the quantity produced' },

    Product:         { chain:'masters', label:'Product',
                       needs:'a purchase price (MRP and selling price are derived from it), a selling price and a category' },
    Category:        { chain:'masters', label:'Category', parent:'Department',
                       needs:'the department it rolls up into' },
    Department:      { chain:'masters', label:'Department' },
    Brand:           { chain:'masters', label:'Brand' },
};
const ERP_CHAINS = {
    purchase:      ['PurchaseOrder','MaterialInward','SupplierBill','BillPayment'],
    sales:         ['SalesEstimate','SalesOrder','DeliveryChallan','SalesInvoice','Receipt'],
    manufacturing: ['Recipe','MaterialConsumption','MaterialCreation'],
};
const CHAIN_WORDS = [
    [/\b(?:purchase|buying|procure\w*|p2p|procure\s*to\s*pay|vendor|supplier)\b/i, 'purchase'],
    [/\b(?:sales?|selling|o2c|order\s*to\s*cash|customer|billing)\b/i,             'sales'],
    [/\b(?:manufactur\w*|production|assembl\w*|recipe|bom)\b/i,                    'manufacturing'],
];
const flowLabel = e => (ERP_FLOW[e] && ERP_FLOW[e].label) || e;
function describeChain(chain) {
    const steps = ERP_CHAINS[chain] || [];
    if (!steps.length) return null;
    const rows = steps.map((e, i) => {
        const f = ERP_FLOW[e] || {};
        const bits = [];
        if (f.parent) bits.push(`needs the ${flowLabel(f.parent).toLowerCase()} first`);
        else if (f.optionalParent) bits.push(`can be raised against the ${flowLabel(f.optionalParent).toLowerCase()}, or on its own`);
        if (f.gate) bits.push(`only works with ${f.gate}`);
        if (f.needs) bits.push(f.needs);
        return `${i + 1}. <b>${f.label}</b>${bits.length ? ` — ${bits.join('; ')}` : ''}`;
    });
    return rows.join('<br>');
}

// ── Typo + synonym normalisation (runs BEFORE every parse tier) ──────────────
// Real users don't type our regexes. They write "creat purchse ordr", they say
// GRN when the ERP says Material Inward, and they mix Hinglish ("bill banao").
// Rather than loosen 60+ patterns, canonicalise the sentence ONCE here and let
// every existing pattern keep matching the words it already knows.
// Alias list below is from VasyERP's own manuals (asked Vina, 06/09/2026).
const PHRASE_ALIASES = [
    // ── purchase ──
    [/\b(?:goods?\s*receipt(?:\s*note)?|grn|stock\s*inward|material\s*receipt)\b/gi, 'material inward'],
    // Receiving GOODS is inward, not a money receipt. Without this the Receipt
    // rule claims "receive goods from Sharma Textiles" — same verb, opposite
    // module, and the mistake only shows up weeks later in the ledger.
    [/\b(?:receive|receiving|received|recieve)\s+(?:the\s+|our\s+)?(?:goods?|material|stock|consignment|shipment|delivery)\b/gi, 'material inward'],
    [/\b(?:goods?|material|stock|consignment|shipment)\s+(?:has\s+|have\s+)?(?:been\s+)?received\b/gi, 'material inward'],
    [/\b(?:purchase\s*bill|vendor\s*bill|supplier\s*invoice)\b/gi,                   'supplier bill'],
    [/\b(?:purchase\s*return|supplier\s*return|vendor\s*debit\s*note)\b/gi,          'debit note'],
    [/\bpurchase\s*order\b|\bsupplier\s*po\b/gi,                                     'purchase order'],
    // ── sales ──
    [/\b(?:quotation|quote|proforma(?:\s*invoice)?)\b/gi,                            'estimate'],
    [/\b(?:customer\s*order)\b/gi,                                                   'sales order'],
    [/\b(?:delivery\s*note|dispatch\s*note)\b/gi,                                    'delivery challan'],
    [/\b(?:tax\s*invoice|sale\s*bill|customer\s*invoice)\b/gi,                       'sales invoice'],
    [/\b(?:sales?\s*return|customer\s*credit\s*note)\b/gi,                           'credit note'],
    // ── POS ──
    [/\b(?:cash\s*memo|cash\s*bill|retail\s*bill|counter\s*bill|pos\s*bill)\b/gi,    'pos'],
    [/\b(?:suspended\s*bill|parked\s*bill)\b/gi,                                     'hold bill'],
    [/\b(?:store\s*credit|credit\s*voucher)\b/gi,                                    'pos credit note'],
    [/\b(?:shift\s*open|shift\s*close|cashier\s*shift|register\s*closing)\b/gi,      'sales register'],
    // ── inventory ──
    [/\b(?:branch\s*transfer|inter[\s-]*branch\s*transfer|transfer\s*challan|stock\s*movement\s*note)\b/gi, 'stock transfer'],
    [/\b(?:stock\s*correction|inventory\s*adjustment|stock\s*rectification)\b/gi,    'stock adjustment'],
    [/\b(?:stock\s*take|physical\s*verification|inventory\s*count|stock\s*count)\b/gi,'stock verification'],
    [/\b(?:material\s*issue|issue\s*note|stock\s*outward|goods?\s*issue)\b/gi,       'material consumption'],
    // ── money ──
    [/\b(?:receipt\s*voucher|money\s*receipt|collection)\b/gi,                       'receipt'],
    [/\b(?:payment\s*voucher|money\s*out)\b/gi,                                      'payment'],
    [/\b(?:journal\s*entry|jv)\b/gi,                                                 'journal voucher'],
    // ── Hinglish verbs merchants actually type ──
    [/\b(?:banao|bana\s*do|banade|banadijiye|banaiye)\b/gi,                          'create'],
    [/\b(?:dikhao|dikha\s*do|batao|bata\s*do)\b/gi,                                  'show'],
    [/\b(?:kitna|kitne)\b/gi,                                                        'how much'],
    [/\b(?:kharida|kharid)\b/gi,                                                     'purchase'],
    [/\b(?:becha|bech\s*do|becho)\b/gi,                                              'sell'],
];
// Words worth typo-correcting. Deliberately only COMMAND vocabulary — never
// names — because "correcting" a customer called Sunill would be worse than
// leaving it alone.
const VOCAB = ('create add new make edit update delete remove show list open search find ' +
 'purchase order supplier vendor bill invoice sales customer contact employee product item ' +
 'material inward consumption creation payment receipt expense estimate challan delivery ' +
 'credit debit note journal voucher stock transfer verification adjustment quantity price ' +
 'amount discount batch barcode label report register outstanding balance ledger account ' +
 'branch outlet role user setting enable disable toggle loyalty coupon membership category ' +
 'brand department unit tax prefix approve reject export excel tally dashboard ' +
 'receive received receiving goods dispatch dispatched deliver delivered return ' +
 'returned issue issued consume consumed produce produced sell sold buy bought ' +
 'pay paid collect collected count physical verify supplier vendor party ledger ' +
 'opening closing balance shelf sticker label counter till branch outlet warehouse').split(' ');
// Everyday words a question is made of. They are never "repaired" — "last" is one
// letter from "list", so "sales last month" became "sales list month" — but they are
// NOT repair targets either (adding them as targets turned "neft" into "next").
const KEEP_WORDS = new Set(('last past week weeks month months year years quarter today yesterday previous current ' +
 'most least best worst selling trend insight segment segments champion champions loyal risk ' +
 'owes owe money mode modes much many total cart value margin profit hand neft rtgs imps cash ' +
 // real words one letter from a command word ("sitting" was being "fixed" to "setting")
 'sitting lying kept left around godown store shop warehouse pending settled khata').split(' '));
const NO_FIX_AFTER = /\b(?:for|to|from|of|named|called|by|with)$/i;

// Damerau-Levenshtein with an early bail — counts a transposition as ONE edit,
// which is what most real typos are ("invocie" → "invoice").
function damerau(a, b, cap = 2) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > cap) return cap + 1;
    const m = a.length, n = b.length;
    let prev2 = [], prev = [], cur = [];
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
        cur = [i];
        let rowMin = i;
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            let v = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
                v = Math.min(v, prev2[j - 2] + 1);          // transposition
            cur[j] = v;
            if (v < rowMin) rowMin = v;
        }
        if (rowMin > cap) return cap + 1;                   // can only grow — bail
        prev2 = prev; prev = cur;
    }
    return prev[n];
}

// Names belong to the user, not to the vocabulary. canonicalize() repairs
// command words, but it cannot tell a command word from a name one keystroke
// away from one: "create membership Gold …" became a plan called "Sold", and
// the account "Office Expenses" lost its s. After parsing the repaired text, put
// every name-like field back exactly as it was typed. Catalogue values (report,
// setting, payment mode…) stay repaired — matching those is the whole point.
const KEEP_CANON_FIELD = /^(?:reportType|settingName|desired|paymentMode|adjustType|couponType|type|action|pages|firstPage|group|kind|channel|reverseCharge|contactType|recipeType)$/;
function restoreTyped(r, raw) {
    if (!r || !r.fields || !raw) return r;
    const src = String(raw);
    const strip = w => w.replace(/^[^\w₹]+|[^\w]+$/g, '');
    const toks = src.split(/\s+/).filter(Boolean).map(strip);
    const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const [k, v] of Object.entries(r.fields)) {
        if (typeof v !== 'string' || KEEP_CANON_FIELD.test(k) || !/[A-Za-z]/.test(v)) continue;
        if (new RegExp('(?:^|[^A-Za-z0-9])' + esc(v) + '(?![A-Za-z0-9])', 'i').test(src)) continue;
        const vt = v.split(/\s+/).filter(Boolean);
        for (let i = 0; i + vt.length <= toks.length; i++) {
            let ok = true;
            for (let j = 0; j < vt.length && ok; j++) {
                const a = toks[i + j], b = vt[j].toLowerCase();
                ok = a.toLowerCase() === b || canonicalize(a).toLowerCase() === b;
            }
            if (ok) {
                const typed = toks.slice(i, i + vt.length).join(' ');
                // the status line was built from the repaired text too
                // ("Creating Brand — Consume Brand 270" for "Console Brand 270")
                if (typeof r.botResponse === 'string') r.botResponse = r.botResponse.split(v).join(typed);
                r.fields[k] = typed; break;
            }
        }
    }
    return r;
}
// The one local-parse entry point: repaired text first, raw as the fallback,
// typed names restored. Production and the test pages both call this.
// ── Natural phrasing → command shape ─────────────────────────────────────────
// Merchants say "paid Sharma Textiles 2000 by upi", "order 10 Notebook1 from
// Sharma Textiles", "Gupta Stores returned 1 Notebook1". Without an AI key every
// one of these ended in "which one — receipt or payment?". Each rewrite targets a
// form the rules below already parse (and the tests pin), and keeps the user's own
// words for names. Fresh commands only — never an answer to a question.
const _MODE = String.raw`(?:cash|upi|card|cheque|check|neft|rtgs|imps|bank|online|g\s*pay|gpay|paytm|phone\s*pe)`;
const _AMT  = String.raw`(?:rs\.?\s*|₹\s*|inr\s*)?(\d[\d,]*(?:\.\d+)?)`;
const _QTY  = String.raw`(\d{1,6}(?:\.\d+)?)\s*(?:pcs?|pieces?|nos?|units?|x)?`;
const _GST  = String.raw`(\s+(?:no\s+gst|non[\s-]*gst|without\s+gst|exempt(?:ed)?|gst\s*@?\s*\d{1,2}\s*%?))?`;
const RESHAPES = [
    // "record payment of 1000 to Sharma Textiles by upi" / "make a payment of ₹500 to X"
    [new RegExp(String.raw`^(?:please\s+)?(?:record|make|add|create|do|enter)\s+(?:a\s+)?payment\s+(?:of\s+)?${_AMT}\s+to\s+(.+?)(?:\s+(?:by|via|through|in|using))?(?:\s+(${_MODE}))?\s*$`, 'i'),
        m => `pay ${m[1]} to ${m[2]}${m[3] ? ' ' + m[3] : ''}`],
    // "record receipt of 500 from Gupta Stores by upi"
    [new RegExp(String.raw`^(?:please\s+)?(?:record|make|add|create|enter)\s+(?:a\s+)?receipt\s+(?:of\s+)?${_AMT}\s+from\s+(.+?)(?:\s+(?:by|via|through|in|using))?(?:\s+(${_MODE}))?\s*$`, 'i'),
        m => `collect ${m[1]} from ${m[2]}${m[3] ? ' ' + m[3] : ''}`],
    // dashboard, Hinglish: "aaj ka sale kitna hua" · "kal ki bikri kitni thi" · "is mahine ka sale"
    [/^(aaj|kal|is\s+(?:mahine|month|hafte|week|saal|year))\s+(?:ka|ki|ke)\s+(?:sale|sales|bikri|vikri|dhandha)\b(?:\s+(?:kitna|kitni|kitne|kya))?(?:\s+(?:hua|hui|huye|tha|thi|hai|raha|rahi))?\s*\??$/i,
        m => `total sales ${({ aaj: 'today', kal: 'yesterday' })[m[1].toLowerCase()] || (/mahine|month/i.test(m[1]) ? 'this month' : /hafte|week/i.test(m[1]) ? 'this week' : 'this year')}`],
    // money out: "paid Sharma Textiles 2000 by upi" / "paid 2000 to Sharma Textiles via neft"
    [new RegExp(String.raw`^(?:i\s+)?paid\s+(?:rs\.?\s*|₹\s*)?(\d[\d,]*(?:\.\d+)?)\s+to\s+(.+?)(?:\s+(?:by|via|through|in|using))?(?:\s+(${_MODE}))?\s*$`, 'i'),
        m => `pay ${m[1]} to ${m[2]}${m[3] ? ' ' + m[3] : ''}`],
    [new RegExp(String.raw`^(?:i\s+)?paid\s+(?!(?:rs|₹|\d))(.+?)\s+${_AMT}(?:\s+(?:by|via|through|in|using))?(?:\s+(${_MODE}))?\s*$`, 'i'),
        m => `pay ${m[2]} to ${m[1]}${m[3] ? ' ' + m[3] : ''}`],
    // money in: "Mehta Traders gave me 2500 by upi" / "Gupta Stores sent us 900 via neft today"
    // (the on-device model read this as a PAYMENT twice — the rules must own it)
    [new RegExp(String.raw`^(?!i\s)(?!we\s)([A-Za-z][A-Za-z0-9 .&'\-]{1,40}?)\s+(?:gave|sent|transferred|handed(?:\s+over)?|deposited)\s+(?:me|us|to\s+(?:me|us))\s+${_AMT}(?:\s+(?:rs|rupees))?(?:\s+(?:by|via|through|in|using))?(?:\s+(${_MODE}))?(?:\s+(?:today|yesterday|now))?\s*$`, 'i'),
        m => `collect ${m[2]} from ${m[1]}${m[3] ? ' ' + m[3] : ''}`],
    // money in: "Zubair Kirana settled his khata with me 900 upi" / "… cleared their dues of 1500 by cash"
    [new RegExp(String.raw`^(?!i\s)(?!we\s)([A-Za-z][A-Za-z0-9 .&'\-]{1,40}?)\s+(?:has\s+)?(?:settled|cleared|paid\s+off|closed)\s+(?:his|her|their|the|its)?\s*(?:khata|account|dues|bill|bills|balance|udhaar|udhar|hisaab|hisab|tab)(?:\s+(?:with|to)\s+(?:me|us))?(?:\s+(?:with|of|for|by\s+paying))?\s+${_AMT}(?:\s+(?:rs|rupees))?(?:\s+(?:by|via|through|in|using))?(?:\s+(${_MODE}))?\s*$`, 'i'),
        m => `collect ${m[2]} from ${m[1]}${m[3] ? ' ' + m[3] : ''}`],
    // Hinglish money in: "Zubair Kirana ne 900 diye upi se" / "Gupta Stores ne 1500 cash me jama kiye"
    [new RegExp(String.raw`^([A-Za-z][A-Za-z0-9 .&'\-]{1,40}?)\s+ne\s+${_AMT}(?:\s+(?:rs|rupaye|rupees|rupay))?(?:\s+(${_MODE})\s+(?:se|me|mein|mai))?\s+(?:diye|de\s+diye|dediye|jama\s+kiye|jama\s+kar\s+diye|bheje|chukaye|lautaye)(?:\s+(${_MODE})\s+(?:se|me|mein|mai))?\s*$`, 'i'),
        m => `collect ${m[2]} from ${m[1]}${(m[3] || m[4]) ? ' ' + (m[3] || m[4]) : ''}`],
    // money in: "Gupta Stores paid 500 cash" / "received 1500 from Gupta Stores via neft"
    [new RegExp(String.raw`^(?!i\s)(?!we\s)([A-Za-z][A-Za-z0-9 .&'\-]{1,40}?)\s+(?:has\s+)?paid\s+(?:me\s+|us\s+)?${_AMT}(?:\s+(?:by|via|through|in|using))?(?:\s+(${_MODE}))?\s*$`, 'i'),
        m => `collect ${m[2]} from ${m[1]}${m[3] ? ' ' + m[3] : ''}`],
    [new RegExp(String.raw`^(?:received|got|collected)\s+${_AMT}\s+from\s+(.+?)(?:\s+(?:by|via|through|in|using))?(?:\s+(${_MODE}))?\s*$`, 'i'),
        m => `collect ${m[1]} from ${m[2]}${m[3] ? ' ' + m[3] : ''}`],
    // goods in: "got 10 Notebook1 from Sharma Textiles against PO BIL223"
    [/^(?:received|got)\s+\d[\d.]*\s+.+?\s+from\s+.+?\s+against\s+(?:po|purchase\s+order)?\s*#?\s*(\S*\d\S*)\s*$/i,
        m => `receive goods against PO ${m[1]}`],
    [/^(?:received|got)\s+\d[\d.]*\s+(?:pcs?\s+|units?\s+|nos?\s+)?(?!(?:rs|inr|rupees?)\b)[A-Za-z].*?\s+from\s+(.+?)\s*$/i,
        m => `create material inward for ${m[1]}`],
    [/^(.+?)\s+(?:sent|gave|raised|sent\s+us)\s+(?:their|the|a|an)?\s*(?:bill|invoice)\s+(?:for|against|on)\s+(?:the\s+)?(?:grn|material\s+inward|inward)?\s*(?:no\.?\s*)?#?\s*(\S*\d\S*)\s*$/i,
        m => `book supplier bill against ${m[2]}`],
    // purchase order: "order 10 Notebook1 from Sharma Textiles at 400" / "buy 5 PP10955 from X"
    [new RegExp(String.raw`^(?:please\s+)?(?:order|buy|purchase)\s+${_QTY}\s+(.+?)\s+from\s+(.+?)(?:\s+(?:at|@|for)\s*${_AMT}(?:\s*(?:each|per\s+\w+))?)?\s*$`, 'i'),
        m => `create purchase order for ${m[3]} ${m[1]} ${m[2]}${m[4] ? ' at ' + m[4] : ''}`],
    // returns: "send back 3 Notebook1 to Sharma Textiles" / "Gupta Stores returned 1 Notebook1 m"
    [new RegExp(String.raw`^(?:send|sent|give|gave)\s+back\s+${_QTY}\s+(.+?)\s+to\s+(.+?)(?:\s+against\s+(?:bill\s+)?(\S*\d\S*))?\s*$`, 'i'),
        m => `create debit note for ${m[3]}${m[4] ? ' bill ' + m[4] : ''} ${m[1]} ${m[2]}`],
    [new RegExp(String.raw`^(?:customer\s+)?(?!i\s)(?!we\s)([A-Za-z][A-Za-z0-9 .&'\-]{1,40}?)\s+(?:has\s+)?returned\s+${_QTY}\s+(.+?)(?:\s+(?:from|of|against|on)\s+(?:invoice|bill)\s*(?:no\.?\s*)?#?\s*(\S*\d\S*))?\s*$`, 'i'),
        m => `create credit note for ${m[1]}${m[4] ? ' invoice ' + m[4] : ''} ${m[2]} ${m[3]}`],
    // sales invoice: "make a bill for Gupta Stores 2 Notebook1 m" / "invoice Gupta Stores for 2 Notebook1 m at 300"
    [new RegExp(String.raw`^(?:make|create|raise|prepare|generate)?\s*(?:a\s+|an\s+)?(?:bill|invoice)\s+(?:for\s+|to\s+)?(?!\d)([A-Za-z][A-Za-z0-9 .&'\-]*?)\s+(?:for\s+)?${_QTY}\s+([A-Za-z].*?)(?:\s+(?:at|@)\s*${_AMT})?\s*$`, 'i'),
        m => `create sales invoice for ${m[1]} ${m[2]} ${m[3]}${m[4] ? ' at ' + m[4] : ''}`],
    // POS: "bill 2 PP10955 to walk in customer cash"
    [new RegExp(String.raw`^(?:bill|ring\s+up)\s+${_QTY}\s+(.+?)\s+(?:to|for)\s+(?:a\s+)?walk[\s-]*in(?:\s+customer)?\s+(${_MODE})\s*$`, 'i'),
        m => `sell ${m[1]} ${m[2]} ${m[3]}`],
    // stock between branches: "move 2 Notebook1 to testB" / "transfer 5 PP10955 from main to testB"
    [new RegExp(String.raw`^(?:move|transfer|send|shift)\s+${_QTY}\s+(?!(?:rs|inr|rupees?|from|to)\b)([A-Za-z].*?)\s+(?:from\s+\S+(?:\s+branch)?\s+)?to\s+(?!stock\b)(.+?)(?:\s+branch)?\s*$`, 'i'),
        m => `create stock transfer to ${m[3]} for ${m[2]} ${m[1]}`],
    // stock in / out on this branch
    [new RegExp(String.raw`^(?:add|put)\s+${_QTY}\s+(.+?)\s+(?:to|in|into)\s+(?:the\s+)?(?:stock|inventory)\s*$`, 'i'),
        m => `add opening stock of ${m[2]} ${m[1]}`],
    [new RegExp(String.raw`^(?:remove|reduce|deduct|minus|write\s*off)\s+${_QTY}\s+(?:damaged\s+|broken\s+|expired\s+|lost\s+)?(.+?)\s+(?:from|in)\s+(?:the\s+)?(?:stock|inventory)\s*$`, 'i'),
        m => `stock adjustment ${m[2]} ${m[1]} decrease`],
    // expenses: "spent 300 on tea no gst" / "electricity bill 4500 gst 18"
    [new RegExp(String.raw`^(?:spent|paid)\s+${_AMT}\s+(?:on|for)\s+(.+?)(?:\s+(?:from|via|by|through)\s+(?:the\s+)?(?:petty\s+cash|cash|bank|${_MODE}))?${_GST}\s*$`, 'i'),
        m => `add expense ${m[1]} ${m[2]}${m[3] || ''}`],
    [new RegExp(String.raw`^(electricity|power|light|water|internet|wifi|broadband|phone|mobile|telephone|rent|gas|maintenance)\s+bill\s+(?:of\s+|is\s+)?${_AMT}${_GST}\s*$`, 'i'),
        m => `add expense ${m[2]} ${m[1]} bill${m[3] || ''}`],
    // masters / documents named the short way
    [/^(?:new|add)\s+(?:item|product)\s+(.+)$/i, m => `create product ${m[1].replace(/\bcost(?:\s+price)?\b/i, 'purchase price')}`],
    [/^(?:quotation|quote|estimate)\s+(?:for|to)\s+(.+)$/i, m => `create estimate for ${m[1]}`],
    [/^(?:delivery\s+challan|challan)\s+(?:for|to)\s+(.+)$/i, m => `create delivery challan for ${m[1]}`],
    // ── Hinglish — the way most of our merchants actually type ──────────────
    // Latin-script Hindi is read as English by the language detector, so the
    // translation tier never sees it. Hindi word order is verb-last (party ko
    // amount de do), so these are sentence shapes, not word swaps.
    [new RegExp(String.raw`^(.+?)\s+ko\s+${_AMT}(?:\s+(?:rs|rupaye|rupees?))?(?:\s+(${_MODE}))?(?:\s+(?:se|me|mein))?\s+(?:de\s*do|de\s*diya|diye|dena\s+hai|bhej\s*do|bhejo|pay\s+kar(?:o|\s*do)?|payment\s+kar(?:o|\s*do)?|chuka\s*do)(?:\s+(?:in\s+|by\s+|se\s+)?(${_MODE}))?\s*$`, 'i'),
        m => `pay ${m[2]} to ${m[1]}${(m[3] || m[4]) ? ' ' + (m[3] || m[4]) : ''}`],
    [new RegExp(String.raw`^(.+?)\s+se\s+${_AMT}(?:\s+(?:rs|rupaye|rupees?))?(?:\s+(${_MODE}))?(?:\s+(?:me|mein))?\s+(?:mile|mila|mil\s+gaye|liye|le\s+liye|aaye|aaya|aa\s+gaye|collect\s+kar(?:o|\s*lo)?|jama\s+kar(?:o|\s*lo)?)(?:\s+(?:in\s+|by\s+|me\s+|mein\s+)?(${_MODE}))?\s*$`, 'i'),
        m => `collect ${m[2]} from ${m[1]}${(m[3] || m[4]) ? ' ' + (m[3] || m[4]) : ''}`],
    [/^(.+?)\s+(?:ka|ki|ke)\s+(?:balance|baki|baaki|udhaar|udhar|hisaab|hisab|outstanding|due)(?:\s+(?:kitna|kya)\s+hai|\s+(?:batao|dikhao|bata\s*do|dikha\s*do))?\s*\??$/i,
        m => `balance of ${m[1]}`],
    [/^(?:mujhe\s+)?(.+?)\s+(?:ko\s+)?(?:se\s+)?kitna\s+(?:dena|lena|baki|baaki)\s+hai\s*\??$/i,
        m => `balance of ${m[1].replace(/\s+(?:ko|se)$/i, '')}`],
    [/^(.+?)\s+(?:ka|ki|ke)\s+stock(?:\s+(?:kitna|kya)\s+hai|\s+(?:batao|dikhao|bata\s*do|dikha\s*do))?\s*\??$/i,
        m => `stock of ${m[1]}`],
    [new RegExp(String.raw`^${_QTY}\s+(.+?)(?:\s+(${_MODE}))?(?:\s+(?:me|mein))?\s+(?:becho|bech\s*do|bech\s*diya|sell\s+kar(?:o|\s*do)?)\s*$`, 'i'),
        m => `sell ${m[1]} ${m[2]} ${m[3] || 'cash'}`],
    [new RegExp(String.raw`^(.+?)\s+se\s+${_QTY}\s+(.+?)(?:\s+(?:at|@)\s*${_AMT})?\s+(?:mangwao|mangao|mangwa\s*do|order\s+kar(?:o|\s*do)?|kharido|kharid\s*lo)\s*$`, 'i'),
        m => `order ${m[2]} ${m[3]} from ${m[1]}${m[4] ? ' at ' + m[4] : ''}`],
    [/^(?:naya|nayi|new)\s+(customer|grahak|client|supplier|vendor)\s+(?:banao|bana\s*do|add\s+karo|jodo)?\s*(.+?)\s*(?:banao|bana\s*do|add\s+karo|jodo)?\s*$/i,
        m => `create ${/supplier|vendor/i.test(m[1]) ? 'supplier' : 'customer'} ${m[2]}`],
    [new RegExp(String.raw`^(.+?)\s+(?:ke\s+liye|ka|ki|ko)\s+(?:invoice|bill)\s+(?:banao|bana\s*do|bnao|kato|kaat\s*do)\s+${_QTY}\s+(.+?)(?:\s+(?:at|@)\s*${_AMT})?\s*$`, 'i'),
        m => `create sales invoice for ${m[1]} ${m[2]} ${m[3]}${m[4] ? ' at ' + m[4] : ''}`],
    [/^(aaj|kal)\s+(?:ki|ka)\s+(?:sale|sales|bikri|kamai)\s*(?:kitni\s+hai|kitna\s+hai|batao|dikhao|bata\s*do|dikha\s*do)?\s*\??$/i,
        m => /kal/i.test(m[1]) ? 'total sales yesterday' : 'total sales today'],
    [/^(?:is|iss)\s+(?:mahine|month)\s+(?:ka|ki)\s+(?:profit|munafa|fayda|kamai)\s*(?:kitna\s+hai|batao|dikhao|bata\s*do)?\s*\??$/i,
        () => 'profit and loss this month'],
    [new RegExp(String.raw`^${_QTY}\s+(.+?)\s+(.+?)\s+(?:ko\s+)?(?:bhejo|bhej\s*do|transfer\s+kar(?:o|\s*do)?)\s*$`, 'i'),
        m => `move ${m[1]} ${m[2]} to ${m[3]}`],
    [new RegExp(String.raw`^${_QTY}\s+(.+?)\s+(?:kharab|damage|damaged|toot|tut|expire|expired)\s*(?:ho\s+gaye|ho\s+gaya|hai|hain)?(?:\s*,)?\s*(?:stock\s+(?:se|me|mein)\s+)?(?:hatao|nikalo|kam\s+karo|minus\s+karo|ghatao)\s*$`, 'i'),
        m => `remove ${m[1]} damaged ${m[2]} from stock`],
    [new RegExp(String.raw`^${_QTY}\s+(.+?)\s+stock\s+(?:me|mein)\s+(?:jodo|daalo|dalo|add\s+karo|badhao)\s*$`, 'i'),
        m => `add ${m[1]} ${m[2]} to stock`],
    [/^((?=[A-Za-z\/\-]*\d)[A-Za-z][A-Za-z0-9]*(?:[\/\-][A-Za-z0-9]+)*)\s+(?:kholo|khol\s*do|dikhao|dikha\s*do)\s*$/i,
        m => `open ${m[1]}`],
    [/^((?=[A-Za-z\/\-]*\d)[A-Za-z][A-Za-z0-9]*(?:[\/\-][A-Za-z0-9]+)*)\s+(?:print\s+karo|print\s+kar\s*do|chhapo)\s*$/i,
        m => `print ${m[1]}`],
];
function reshapeNatural(text) {
    const s = String(text || '').trim().replace(/\s+/g, ' ');
    for (const [re, to] of RESHAPES) {
        const m = s.match(re);
        if (m) { const out = to(m).replace(/\s+/g, ' ').trim(); if (out && out.toLowerCase() !== s.toLowerCase()) return out; }
    }
    return null;
}

// ── Several items in one sentence, and discounts ─────────────────────────────
// "sell 2 PP10955 and 1 Notebook1 cash" used to sell a product named
// "PP10955 and 1 Notebook1"; "with 10% discount" was dropped and the sale went
// through at full price. Lines become items[]; a discount is carried so the
// handler applies it or stops — never silently ignores it.
const MULTI_ITEM_ENTITIES = new Set(['POSSale', 'SalesInvoice', 'PurchaseOrder', 'SalesOrder', 'SalesEstimate', 'DeliveryChallan']);
function splitLines(r, text) {
    if (!r || !r.fields || !MULTI_ITEM_ENTITIES.has(r.entity)) return r;
    const f = r.fields;
    const disc = String(text).match(/(?:\b(?:with|at|less|minus|give|giving)\s+)?(\d+(?:\.\d+)?)\s*(%|percent|rs|₹|rupees?)?\s*(?:discount|off)\b|\bdiscount\s+(?:of\s+)?(?:rs\.?\s*|₹\s*)?(\d+(?:\.\d+)?)\s*(%|percent)?/i);
    if (disc && !f.discount) {
        const val = disc[1] || disc[3], pct = /%|percent/i.test(disc[2] || disc[4] || '');
        f.discount = pct ? val + '%' : val;
        if (f.itemName) f.itemName = f.itemName.replace(/\s*(?:with|less|minus)?\s*\d+(?:\.\d+)?\s*(?:%|percent|rs|₹)?\s*(?:discount|off)\b.*$/i, '')
                                               .replace(/\s+discount\s+.*$/i, '').trim();
    }
    const name = String(f.itemName || '');
    if (!/(?:\band\b|,|&|\+)\s*\d/.test(name)) return r;
    const parts = name.split(/\s*(?:,|\band\b|&|\+)\s*(?=\d)/i);
    const items = [];
    parts.forEach((p, i) => {
        let m = p.match(/^(\d+(?:\.\d+)?)\s*(?:x\s+|pcs?\s+|nos?\s+)?(.+?)(?:\s+(?:at|@)\s*(?:rs\.?\s*|₹\s*)?(\d[\d,]*(?:\.\d+)?))?$/i);
        if (i === 0 && !m) m = [null, String(f.qty || 1), p, null];
        if (m && m[2]) items.push({ name: m[2].trim(), qty: parseFloat(m[1]), ...(m[3] ? { price: parseFloat(String(m[3]).replace(/,/g, '')) } : {}) });
    });
    if (items.length < 2) return r;
    if (f.price && !items[items.length - 1].price) items[items.length - 1].price = f.price;
    f.items = items;
    f.itemName = items.map(x => `${x.qty} × ${x.name}`).join(', ');
    delete f.qty; delete f.price;
    r.botResponse = String(r.botResponse || '').replace(/(Selling|Creating|Invoicing)[^…]*…/, `$1 ${items.length} lines: ${f.itemName}…`);
    if (r.entity === 'POSSale') r.isReady = !!f.paymentMode;
    else r.isReady = r.isReady || !!(f.customerName || f.supplierName);
    return r;
}

function localParseTyped(text, state, page) {
    return splitLines(_localParseTyped(text, state, page), text);
}
function _localParseTyped(text, state, page) {
    // natural phrasing first — but only for a fresh command, never a field answer
    if (!(state && state.entity)) {
        const shaped = reshapeNatural(text);
        if (shaped) {
            const r0 = localParseTyped(shaped, { entity: null, action: null, fields: {} }, page);
            if (r0 && r0.entity) { r0._reshaped = shaped; return r0; }
        }
    }
    const fixed = canonicalize(text);
    const changed = fixed && fixed.toLowerCase() !== String(text).trim().toLowerCase();
    let r = changed ? tryLocalParse(fixed, state, page) : null;
    if (r) { r._canonicalized = fixed; restoreTyped(r, text); }
    if (!r) r = tryLocalParse(text, state, page);
    return r;
}
// "general ledger for Cash this month" / "account ledger of HDFC Bank" — the
// account a ledger report is filtered by. Only for account-shaped reports, and
// never a period word ("for this month").
function ledgerAccount(raw, reportType) {
    if (!/\b(?:general|account)\s+ledger\b|\bledger\s+report\b|\b(?:cash|bank)\s*book\b/i.test(String(reportType || ''))) return null;
    const m = String(raw).match(/\b(?:for|of)\s+(?:the\s+)?([A-Za-z][A-Za-z0-9 .&'\-]{1,40}?)(?=\s+(?:this|last|today|yesterday|from|between|since|in|during|account|ledger)\b|\s*$)/i);
    if (!m) return null;
    const a = m[1].trim();
    return /^(?:this|last|today|yesterday|the|month|year|week|fy)\b/i.test(a) ? null : a;
}
function canonicalize(text) {
    let s = ' ' + String(text || '') + ' ';
    for (const [re, to] of PHRASE_ALIASES) s = s.replace(re, to);
    // Token-level typo repair. Skip anything quoted, numeric, or sitting right
    // after a preposition (that's a party/product name, not a command word).
    const parts = s.split(/(\s+)/);
    let prevWord = '';
    for (let i = 0; i < parts.length; i++) {
        const tok = parts[i];
        if (!/^[A-Za-z]{4,}$/.test(tok)) { if (tok.trim()) prevWord = tok; continue; }
        const low = tok.toLowerCase();
        if (VOCAB.includes(low) || KEEP_WORDS.has(low) || NO_FIX_AFTER.test(prevWord)) { prevWord = tok; continue; }
        // EDIT DISTANCE, not bigram similarity: a transposition ("invocie") wrecks
        // most bigrams (dice scores it 0.50) while being a single keystroke slip.
        // TIE-BREAK: when two vocabulary words are the same distance away, prefer
        // the one the typed word is a SUBSEQUENCE of — i.e. the user dropped a
        // letter, which is the commonest typo there is. Without this the winner
        // is just whichever word the vocabulary happens to list first, and
        // "acount" resolved to "amount" rather than "account".
        // (Measured: a phonetic/keyboard-distance variant scored WORSE — it turned
        // the product word "saree" into "sales" — so only this one rule shipped.)
        let best = null, bestD = 99, bestSub = false;
        for (const w of VOCAB) {
            if (Math.abs(w.length - low.length) > 2) continue;
            const d = damerau(low, w, 2);
            if (d > bestD) continue;
            let k = 0;
            for (const ch of w) if (ch === low[k]) k++;
            const sub = k === low.length;
            if (d < bestD || (d === bestD && sub && !bestSub)) { bestD = d; best = w; bestSub = sub; }
        }
        // One slip for short words, two for longer ones — tight enough that a real
        // name isn't "corrected" into a command word.
        const allowed = low.length >= 7 ? 2 : 1;
        if (best && bestD <= allowed) parts[i] = tok[0] === tok[0].toUpperCase()
            ? best[0].toUpperCase() + best.slice(1) : best;
        prevWord = tok;
    }
    return parts.join('').trim();
}

// ══════════════════════════════════════════════════════════════════════════════
// Tier 0.45 — Semantic intent classifier  (TF-IDF + cosine similarity)
// ──────────────────────────────────────────────────────────────────────────────
// WHY THIS EXISTS. Tier 0 is ~90 hand-written regexes. Regexes are exact: they
// match the phrasings we thought of and silently miss everything else, so an
// unanticipated wording used to cost a network round-trip (or fail outright when
// there is no API key / no signal). This tier is the safety net between them.
//
// It is a genuine information-retrieval classifier, not more pattern matching:
//   1. every training utterance becomes a sparse TF-IDF vector
//        - word unigrams (weighted x2) carry the meaning
//        - character trigrams of each word carry robustness to typos, so
//          "purchse ordr" still lands near "purchase order" with no spell-check
//   2. sublinear TF (1 + log tf) so a repeated word cannot dominate
//   3. IDF = log((N+1)/(df+1)) + 1, so "create" (in half the corpus) is nearly
//      free while "reconciliation" is highly discriminative
//   4. L2 normalisation makes the dot product a true cosine, i.e. length-invariant
//      — "invoice" and "please could you raise an invoice" score alike
//   5. per-intent score = best matching utterance, and the MARGIN over the
//      runner-up intent decides whether we act, ask, or give up.
//
// SAFETY. This tier never completes an action on its own. Above the accept
// threshold it opens the task and asks for the first required field, handing
// control to the existing mid-flow machinery — so a misclassification costs the
// user one visible question, never a wrong record. In the ambiguous band it asks
// which of the top matches was meant. Below that it returns null and the older
// tiers run exactly as before.
// ══════════════════════════════════════════════════════════════════════════════

// Training utterances, deliberately worded the way merchants actually speak
// rather than the way our regexes are written — that mismatch is the whole point.
const INTENT_CORPUS = [
['Contact|create',       'create a customer;add new client;register a buyer;new customer account;onboard a client;save this customer;put this buyer in the system;add a supplier;register a vendor;new supplier record;create party;add a transporter;put him down as a vendor;list them as a supplier;note this person as a customer'],
['Product|create',       'create a product;add new item;list a new SKU;add this article to catalogue;register a product;new item master;add goods to inventory;make a new product entry'],
['Employee|create',      'add an employee;create staff member;register a worker;onboard a new hire;add a person to payroll;new staff record;take a new employee on board'],
['UserRole|create',      'create a user role;add a permission set;new role with rights;set up access level;define what a cashier can do;make a role for the accountant;restrict permissions for staff'],
['PurchaseOrder|create', 'raise a purchase order;order stock from supplier;buy goods from vendor;place an order with my supplier;procure items;send a PO;indent material from vendor;purchase inventory'],
['MaterialInward|create','receive goods from supplier;record stock arriving;book the delivery that came in;the truck arrived with our stock;take the consignment into stock;goods came in today;inward the shipment;accept material against the order;record receipt of items'],
['SupplierBill|create',  'book the supplier bill;enter vendor invoice;record purchase bill;the supplier sent his invoice;post the bill I received;enter a bill against goods received'],
['PurchaseReturn|create','return goods to supplier;send back defective stock;raise a debit note;reject material to vendor;items were damaged send them back;these parts are faulty return them;send the bad stock back to the vendor;short supply return to vendor'],
['SalesOrder|create',    'take a customer order;book an order from buyer;customer wants to order;enter a sales order;confirm the order from client;log an order'],
['SalesInvoice|create',  'bill the customer;raise an invoice;make a tax invoice;charge the client;invoice this sale;generate a bill for customer;send an invoice'],
['SalesEstimate|create', 'send a quotation;prepare a quote;give the customer a price offer;make a proforma;estimate for the client;quote them a price;customer asked for pricing;share rates with the buyer;offer letter with prices'],
['DeliveryChallan|create','make a delivery challan;dispatch goods to customer;send items out with a note;prepare a delivery note;goods going out today;goods leaving with paperwork;despatch consignment to buyer;material going out of the store'],
['SalesReturn|create',   'customer returned goods;take back sold items;raise a credit note;process a return from buyer;refund the customer stock'],
['POSSale|create',       'ring up a sale;sell at the counter;walk in customer purchase;cash memo at till;billing at the shop counter;quick retail sale;scan and bill'],
['Payment|create',       'pay the supplier;settle a vendor bill;send money to party;make a payment;clear an outstanding to vendor;disburse funds'],
['Receipt|create',       'record money received;customer paid us;collect payment from client;book a receipt;cash came in from buyer;log a collection'],
['Expense|create',       'record an expense;book a cost;log office spending;enter petty cash spend;pay for electricity;note down a business expense'],
['JournalVoucher|create','pass a journal entry;make an accounting adjustment;debit one account credit another;book a manual voucher;post a JV;post a manual accounting entry;contra entry between ledgers;adjustment entry in books'],
['BankTransaction|create','transfer money between accounts;move cash to bank;deposit cash;withdraw from bank;shift funds internally;move money from cash to the bank account'],
['BankReconciliation|view','reconcile the bank statement;match bank entries;tally my bank book;check which cheques cleared;bank reconciliation'],
['StockAdjust|create',   'adjust stock quantity;correct inventory count;stock is wrong fix it;write off damaged goods;increase stock manually;reduce quantity in system;the count on the shelf is wrong;system quantity does not match reality'],
['StockTransfer|create', 'move stock to another branch;send inventory to other outlet;shift goods between warehouses;transfer items to the second store'],
['StockVerification|create','do a stock take;physical stock count;verify inventory on shelf;audit the stock;count what is actually there'],
['MaterialConsumption|create','issue material to production;consume raw stock;take items for manufacturing;record wastage;scrap some inventory'],
['MaterialCreation|create','produce finished goods;manufacture output from raw material;assemble a product;convert raw into finished'],
['Recipe|create',        'create a recipe;define a formula;set up how a product is made;bill of material recipe;assembly definition'],
['OpeningStock|create',  'enter opening stock;set starting inventory;load initial quantities;seed stock balances'],
['CRMLead|create',       'add a lead;log an enquiry;new prospect came in;record a sales inquiry;capture a potential customer;someone enquired about our product;follow up on an interested party;walk-in asked about pricing but did not buy'],
['Coupon|create',        'create a discount coupon;set up a promo code;make an offer code;new voucher for customers'],
['Membership|create',    'create a membership plan;set up loyalty tier;add a customer club level'],
['Discount|create',      'set up a discount;create a price reduction;make a standing offer'],
['Branch|create',        'open a new branch;add another outlet;register a second store;create a warehouse location;we are opening another shop;set up an additional location'],
['Category|create',      'create a product category;add a new group of items;define a classification'],
['Brand|create',         'add a brand;register a manufacturer name;create a brand master'],
['Department|create',    'create a department;add a team;define a division'],
['Vina|ask',             'what should I buy;why are sales down;which product performs best;recommend what to stock;analyse my business;suggest an action;give me insight;what is going wrong;advise me'],
['Setting|toggle',       'turn on a setting;enable a feature;switch off an option;change configuration;flip a toggle in setup;disable this behaviour'],
['Report|view',          'show me a report;pull the numbers;how much did we sell;what is outstanding;give me the summary;view profit;check the ledger;sales figures'],
['Tally|list',           'export to tally;send data to accounting software;tally sync'],
['Logs|list',            'show the audit trail;who changed what;view activity logs;history of edits'],
['BarcodeLabels|list',   'print barcode labels;generate price stickers;make tags for products;stickers for the shelf edge;shelf labels for items'],
['EcommerceCatalog|list','manage online catalogue;what is published on the web store;ecommerce listing'],
['ExportExcel|export',   'download as excel;export this list;give me a spreadsheet;save to xlsx'],
['EInvoice|generate',    'generate e-invoice;get an IRN;push to the government portal'],
['EWayBill|generate',    'create an e-way bill;transport document for goods;generate ewb'],
];

const _STOP = new Set(('a an the to for of in on at is are am be been do does did please can could would ' +
    'i we my our me us it this that these those with and or but if so then just want need like ' +
    'let lets kindly pls plz now today ok okay hey hi mr mrs ms sir madam someone something anyone').split(' '));

function _nluTok(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/).filter(w => w.length > 1 && !_STOP.has(w));
}
// Word unigrams carry meaning; character trigrams carry typo tolerance.
// Words are emitted twice so a clean spelling still outweighs incidental
// trigram overlap between unrelated words.
function _nluTerms(s) {
    const out = [];
    for (const w of _nluTok(s)) {
        out.push('w:' + w, 'w:' + w);
        const p = '^' + w + '$';
        for (let i = 0; i + 3 <= p.length; i++) out.push('c:' + p.substr(i, 3));
    }
    return out;
}
function _nluVec(text, idf) {
    const tf = new Map();
    for (const t of _nluTerms(text)) tf.set(t, (tf.get(t) || 0) + 1);
    const v = new Map();
    let n2 = 0;
    for (const [t, c] of tf) {
        const w = (1 + Math.log(c)) * (idf ? (idf.get(t) || 1) : 1);   // sublinear TF x IDF
        v.set(t, w); n2 += w * w;
    }
    const nrm = Math.sqrt(n2) || 1;
    for (const [t, w] of v) v.set(t, w / nrm);                          // L2 -> dot == cosine
    return v;
}
function _cos(a, b) {                    // iterate the SMALLER map: O(min(|a|,|b|))
    if (a.size > b.size) { const t = a; a = b; b = t; }
    let s = 0;
    for (const [t, w] of a) { const o = b.get(t); if (o) s += w * o; }
    return s;
}

let _nluIndex = null;
function nluIndex() {
    if (_nluIndex) return _nluIndex;
    const docs = [];
    for (const [key, utts] of INTENT_CORPUS) {
        const [entity, action] = key.split('|');
        for (const u of utts.split(';')) docs.push({ entity, action, u });
    }
    // phrasings this business confirmed by a successful task (self-learning, below)
    try { for (const x of (_learn.examples || [])) if (x && x.e && x.u) docs.push({ entity: x.e, action: x.a || 'create', u: x.u, learned: true }); } catch (e) {}
    // document frequency over the raw term stream
    const df = new Map();
    for (const d of docs) {
        const tf = new Map();
        for (const t of _nluTerms(d.u)) tf.set(t, (tf.get(t) || 0) + 1);
        for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    }
    const N = docs.length, idf = new Map();
    for (const [t, c] of df) idf.set(t, Math.log((N + 1) / (c + 1)) + 1);
    for (const d of docs) d.vec = _nluVec(d.u, idf);
    _nluIndex = { docs, idf, N };
    return _nluIndex;
}

// Ranked intents for a phrase — [{entity, action, score, example}]
function nluRank(text, topN = 3) {
    const { docs, idf } = nluIndex();
    const q = _nluVec(text, idf);
    if (!q.size) return [];
    const best = new Map();                  // "Entity|action" -> {s1, s2, example}
    for (const d of docs) {
        const s = _cos(q, d.vec);
        const k = d.entity + '|' + d.action;
        const cur = best.get(k);
        if (!cur) best.set(k, { s1: s, s2: 0, example: d.u });
        else if (s > cur.s1) { cur.s2 = cur.s1; cur.s1 = s; cur.example = d.u; }
        else if (s > cur.s2) cur.s2 = s;
    }
    // EVIDENCE ACCUMULATION. Ranking on the single best utterance lets one lucky
    // word carry an intent ("opening" pulling "we are opening a store" toward
    // OpeningStock). Adding a fraction of the runner-up inside the same intent
    // rewards intents supported by several phrasings at once. The blend is
    // capped at 1 so the value stays comparable to a raw cosine.
    return [...best.entries()]
        .map(([k, v]) => ({ entity: k.split('|')[0], action: k.split('|')[1],
                            score: Math.min(1, v.s1 + 0.18 * v.s2), example: v.example }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topN);
}

// Confidence bands. Tuned on the regression suite in scratchpad/nlu_test.html:
// ACCEPT needs both an absolute score and a clear margin over the runner-up, so
// two genuinely similar intents ("sales order" vs "sales invoice") always ask
// rather than guess.
const NLU_ACCEPT = 0.60, NLU_ASK = 0.34, NLU_MARGIN = 0.06;

function nluClassify(text) {
    const r = nluRank(text, 3);
    if (!r.length || r[0].score < NLU_ASK) return null;
    const margin = r[0].score - (r[1] ? r[1].score : 0);
    if (r[0].score >= NLU_ACCEPT && margin >= NLU_MARGIN) return { verdict: 'accept', ranked: r };
    return { verdict: 'ask', ranked: r };
}

// ── Turning a classification into an intent the rest of the pipeline understands ──
// Pure-navigation entities carry no fields and write nothing, so a confident
// match can open them outright. Everything that CREATES a record instead opens
// the task and asks for its first required field — a misread costs one question.
const NLU_NAV = {
    BankReconciliation: 'view', Logs: 'view', Tally: 'export', BarcodeLabels: 'print',
    EcommerceCatalog: 'list', StockVerification: 'create', ExportExcel: 'export',
    EInvoice: 'generate', EWayBill: 'generate',
};
// First thing to ask for entities that have no REQ_FIELDS row of their own.
const NLU_FIRST_ASK = {
    Category: 'name', Brand: 'name', Department: 'name', Branch: 'name',
    Discount: 'name', Membership: 'name', Recipe: 'recipeName', Product: 'productName',
    Contact: 'firstName', OpeningStock: 'productName', CRMLead: 'name',
    StockTransfer: 'itemName', MaterialConsumption: 'itemName',
    MaterialCreation: 'rawItemName', JournalVoucher: 'debitAccount',
    SalesEstimate: 'customerName', DeliveryChallan: 'customerName',
    SalesReturn: 'customerName', PurchaseReturn: 'supplierName',
    Setting: 'name', Report: 'reportType',
};
const NLU_ASK_LABEL = {
    name: 'name', productName: 'product name', recipeName: 'recipe name',
    reportType: 'which report', debitAccount: 'account to debit',
    rawItemName: 'raw material',
};
const NLU_HUMAN = {
    PurchaseOrder:'purchase order', MaterialInward:'material inward (GRN)', SupplierBill:'supplier bill',
    PurchaseReturn:'debit note / purchase return', SalesOrder:'sales order', SalesInvoice:'sales invoice',
    SalesEstimate:'estimate / quotation', DeliveryChallan:'delivery challan', SalesReturn:'credit note / sales return',
    POSSale:'POS sale', JournalVoucher:'journal voucher', BankTransaction:'bank / cash transfer',
    BankReconciliation:'bank reconciliation', StockAdjust:'stock adjustment', StockTransfer:'stock transfer',
    StockVerification:'stock verification', MaterialConsumption:'material consumption',
    MaterialCreation:'material creation', OpeningStock:'opening stock', CRMLead:'CRM lead',
    UserRole:'user role', BarcodeLabels:'barcode labels', EcommerceCatalog:'eCommerce catalog',
    ExportExcel:'Excel export', EInvoice:'e-invoice', EWayBill:'e-way bill', Contact:'contact',
    Employee:'employee', Product:'product', Coupon:'coupon', Membership:'membership',
    Discount:'discount', Branch:'branch', Category:'category', Brand:'brand',
    Department:'department', Recipe:'recipe', Payment:'payment', Receipt:'receipt',
    Expense:'expense', Report:'report', Setting:'setting', Tally:'Tally export', Logs:'activity log',
    Vina:'Vina analysis', BillOfMaterials:'production run',
    BHIConfig:'BHI config', TargetVsActual:'target vs actual', ComboProduct:'combo product',
};
const nluHuman = e => NLU_HUMAN[e] || String(e || '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

function nluToIntent(text) {
    const c = nluClassify(text);
    if (!c) return null;
    const top = c.ranked[0];

    // ── ambiguous band: name the candidates instead of guessing ──────────────
    if (c.verdict === 'ask') {
        const opts = c.ranked.filter(r => r.score >= NLU_ASK)
            .map(r => `<b>${nluHuman(r.entity)}</b>`);
        const scores = c.ranked.map(r => `${r.entity}:${r.score.toFixed(2)}`).join(' ');
        if (opts.length >= 2) {
            const last = opts.pop();
            return { entity: null, action: 'chat', fields: {}, isReady: false, newTask: false,
                _source: 'nlu-ask', _nluScores: scores, _nluCands: c.ranked.filter(r => r.score >= NLU_ASK).map(r => r.entity),
                botResponse: `I think you mean ${opts.join(', ')} or ${last} — which one?` };
        }
        // Vina is the exception worth acting on at this confidence: asking the
        // analyst a question writes nothing, so a wrong guess costs the user one
        // screen rather than one bad record. "why are my margins falling" is
        // obviously a question for Vina and obviously not a form to fill in.
        if (c.ranked[0].entity === 'Vina') {
            return { entity: 'Vina', action: 'ask', fields: { question: String(text || '').trim() },
                isReady: true, newTask: true, _source: 'nlu', _nluScore: c.ranked[0].score,
                botResponse: 'Asking Vina…' };
        }
        // Otherwise name the single candidate: the user answers in one word, and
        // their answer re-enters the parser as a normal command. This is the last
        // tier before "I couldn't parse that".
        return { entity: null, action: 'chat', fields: {}, isReady: false, newTask: false,
            _source: 'nlu-ask', _nluScores: scores, _nluCands: [c.ranked[0].entity],
            botResponse: `Did you mean <b>${nluHuman(c.ranked[0].entity)}</b>? Say it that way and I'll start it — or give me a bit more detail.` };
    }

    // ── confident: navigation-only entities can just open ────────────────────
    if (NLU_NAV[top.entity]) {
        return { entity: top.entity, action: NLU_NAV[top.entity], fields: {}, isReady: true,
            newTask: true, _source: 'nlu', _nluScore: top.score,
            botResponse: `Opening ${nluHuman(top.entity)}…` };
    }
    // Vina is the analyst — pass the question through untouched.
    if (top.entity === 'Vina') {
        return { entity: 'Vina', action: 'ask', fields: { question: String(text || '').trim() },
            isReady: true, newTask: true, _source: 'nlu', _nluScore: top.score,
            botResponse: 'Asking Vina…' };
    }

    // ── confident: a create task — open it and ask for field #1 ──────────────
    const need = (REQ_FIELDS[top.entity] || [])[0] || NLU_FIRST_ASK[top.entity];
    if (!need) return null;                            // nothing sensible to ask for
    const label = FIELD_LABEL[need] || NLU_ASK_LABEL[need] || need;
    return { entity: top.entity, action: top.action || 'create', fields: {},
        isReady: false, newTask: true, _source: 'nlu', _nluScore: top.score,
        botResponse: `Sounds like ${/^[aeiou]/i.test(nluHuman(top.entity)) ? 'an' : 'a'} <b>${nluHuman(top.entity)}</b>. ` +
                     (/^(?:which|what|how|who)\b/i.test(label) ? `<b>${label[0].toUpperCase() + label.slice(1)}</b>?` : `What's the <b>${label}</b>?`) };
}

// ── Chrome built-in translation (on-device, free) ────────────────────────────
// Our Tier-0 parser is English-only, so a Hindi or Gujarati command used to miss
// every pattern and fall through to the paid cloud tier — or fail outright.
// Chrome 138+ ships LanguageDetector + Translator locally: detect what the user
// spoke/typed, parse the ENGLISH, then answer back in their language.
// Both models download on first use, so every call here is best-effort with a
// short timeout — if they aren't ready we simply carry on in English.
let _detector = null, _translators = {}, _xlateState = 'unknown';
const XLATE_LANGS = ['hi','gu','mr','ta','te','bn','kn','pa','ml','or','as','ur'];
const _raceT = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);

async function detectLang(text) {
    // Plain ASCII is overwhelmingly English here — skip the model entirely, so an
    // English user never pays a millisecond for this.
    if (!/[^\x00-\x7F]/.test(text)) return 'en';
    if (_xlateState === 'unavailable' || typeof LanguageDetector === 'undefined') return 'en';
    try {
        if (!_detector) {
            const avail = await _raceT(LanguageDetector.availability(), 1500);
            if (avail === 'unavailable') { _xlateState = 'unavailable'; return 'en'; }
            // create() REQUIRES A USER GESTURE while the model is downloadable, and
            // a service worker never has one — so this only succeeds once the model
            // is already on disk (the bubble warms it from a real click). Some
            // machines answer "Model not available" outright; latch that so we stop
            // paying the availability check on every single message.
            _detector = await _raceT(LanguageDetector.create(), 4000);
            if (!_detector) return 'en';           // still downloading — try later
        }
        const res = await _raceT(_detector.detect(text), 2500);
        const top = res && res[0];
        if (top && top.confidence >= 0.5 && XLATE_LANGS.includes(top.detectedLanguage)) return top.detectedLanguage;
    } catch (e) {
        _detector = null;
        if (/not available|user gesture/i.test(e.message || '')) _xlateState = 'unavailable';
    }
    return 'en';
}

async function translateText(text, from, to) {
    if (!text || from === to || _xlateState === 'unavailable' || typeof Translator === 'undefined') return null;
    const key = from + '>' + to;
    try {
        if (!_translators[key]) {
            const avail = await _raceT(Translator.availability({ sourceLanguage: from, targetLanguage: to }), 2000);
            if (!avail || avail === 'unavailable') return null;
            _translators[key] = await _raceT(Translator.create({ sourceLanguage: from, targetLanguage: to }), 5000);
            if (!_translators[key]) { delete _translators[key]; return null; }
        }
        return await _raceT(_translators[key].translate(text), 4000);
    } catch (e) {
        delete _translators[key];
        if (/not available|user gesture/i.test(e.message || '')) _xlateState = 'unavailable';
        return null;
    }
}

// Strip our own HTML before translating, then hand the plain text back.
async function translateReply(intent, lang) {
    if (!intent || lang === 'en' || !intent.botResponse) return intent;
    const plain = String(intent.botResponse).replace(/<[^>]+>/g, '');
    const out = await translateText(plain, 'en', lang);
    if (out) intent.botResponse = out;
    return intent;
}

// ── The command pipeline — everything runs inside the browser ────────────────
// No cloud service (v17: the Gemini API is gone). A command goes through the local
// tiers — reshapers, canonicaliser, compound splitter and the rule tiers in
// tryLocalParse — then phrasings learned from earlier successes, the scope gate,
// the meaning classifier (nluToIntent) and, last, Chrome's on-device model, whose
// writes are proposed for a yes. A non-English command is translated by Chrome's
// own on-device Translator first and the reply translated back.
// ctx = { tabId } — which tab the message came from (proposals and learning are per tab).
async function parseCommand(userText, conversationState, currentPage, ctx = {}) {
    conversationState = conversationState || { entity: null, action: null, fields: {} };
    await _learnReady;
    const userLang = await detectLang(userText);
    if (userLang !== 'en') {
        const asEnglish = await translateText(userText, userLang, 'en');
        if (asEnglish) {
            const res = await _parseEnglish(asEnglish, conversationState, currentPage, ctx);
            if (res) { res._userLang = userLang; res._originalText = userText; }
            return await translateReply(res, userLang);
        }
    }
    return await _parseEnglish(userText, conversationState, currentPage, ctx);
}

// Per-call switches for the (synchronous) rule tiers — set around one parse only.
const _parseFlags = { noDashQA: false };
const _YES_RE = /^\s*(?:yes|y|ya|yeah|yep|haan|ha|ok|okay|sure|go\s*ahead|do\s*it|yes,?\s*do\s*it|confirm|proceed|correct|right)\s*[.!]*\s*$/i;
const _NO_RE  = /^\s*(?:no|n|nope|nah|cancel|wrong|not\s+that|don'?t)\s*[.!]*\s*$/i;

async function _parseEnglish(userText, conversationState, currentPage, ctx = {}) {
    // ── Tier -2: the answer to an on-device-model proposal ("go ahead?") ─────
    const prop = ctx.tabId ? _aiProposal.get(ctx.tabId) : null;
    if (prop && !conversationState?.entity) {
        _aiProposal.delete(ctx.tabId);
        if (Date.now() - prop.time < 300000 && !pendingLive()) {
            if (_YES_RE.test(userText)) {
                const r = localParseTyped(prop.command, { entity: null, action: null, fields: {} }, currentPage);
                if (r && r.entity) {
                    r._source = 'chrome-ai'; r._originalText = prop.text; r.newTask = true;
                    return applyRcmFlag(r, prop.command);
                }
            } else if (_NO_RE.test(userText)) {
                return { entity: null, action: 'chat', newTask: false, isReady: false, fields: {}, _source: 'local',
                    botResponse: `OK — nothing done. Say it in other words (e.g. <i>"collect 2500 from Mehta Traders upi"</i>); once a wording works I remember it.` };
            }
        }
    }
    // ── Tier -1: state healing — the bubble sent an EMPTY state but we saw a
    // mid-task ask < 5 min ago and this looks like a field answer, not a command.
    if (!conversationState?.entity && _lastCs.state?.entity
        && Date.now() - _lastCs.time < 300000
        && userText.trim().length <= 40
        && !/\b(create|add|new|make|sell|pay|show|list|open|generate|enable|disable|toggle|set)\b/i.test(userText)) {
        conversationState = _lastCs.state;
    }

    // ── Tier -0.5: plainly off-topic chat, refused BEFORE the rule tiers ──────
    // The rules are generous with typos, so "tell me a joke" was repaired into
    // "sell me a joke" (a POS sale) and "what is the weather" became a page question.
    if (!conversationState?.entity && OFF_TOPIC_RE.test(userText) && !ERP_SCOPE_RE.test(userText)) {
        return { entity: null, action: 'out_of_scope', fields: {}, isReady: true, newTask: false, _source: 'local',
            botResponse: `🔒 I only handle <b>VasyERP</b> work — sales, purchases, inventory, contacts, payments, POS, reports and the like. Try <i>"create customer Raj Sharma"</i> or <i>"who are my top customers?"</i>` };
    }

    // ── Tier -0.4: these exact words worked before (self-learned, instant) ───
    // Ahead of the rules on purpose: a wording is only stored after the rules
    // missed or misread it and the task built from it then SUCCEEDED.
    if (!conversationState?.entity) {
        const lp = learnedPhrase(userText);
        if (lp) return applyRcmFlag(lp, userText);
    }

    // ── Tier 0: compound sentences, then the local rule tiers ────────────────
    // Compound first — but only a fresh request, never an answer to a question
    // the agent is waiting on, and only when every clause is executable.
    _parseFlags.noDashQA = !!ctx.noDashQA;
    let local = null;
    try {
        if (!conversationState?.entity) {
            const comp = parseCompound(userText, currentPage);
            if (comp) return comp;
        }
        local = localParseTyped(userText, conversationState, currentPage);
    } finally { _parseFlags.noDashQA = false; }
    if (local) { local._source = 'local'; return applyRcmFlag(local, userText); }

    // The classifier reads the canonicalised words ("recieve gods" → "receive goods").
    // This used to read a `fixed` that only existed inside _localParseTyped, so every
    // command the rules missed threw "fixed is not defined" instead of being classified.
    const fixed = canonicalize(userText) || userText;

    // ── Tier 1: STRICT scope gate — skipped mid-task (the user may be answering) ─
    if (!conversationState?.entity) {
        const gated = checkScopeLocal(userText);
        if (gated) {
            // The gate is a keyword list; the classifier understands meaning. A
            // HIGH-confidence ERP reading overrules a refusal — "stickers for the
            // shelf edge" carries no ERP keyword but is unmistakably label printing.
            if (gated.action === 'out_of_scope') {
                const rescued = nluToIntent(fixed);
                if (rescued && rescued.entity) return rescued;          // a confident reading
                // "sort out Sharma for the 500" has no ERP keyword at all — the on-device
                // model reads meaning, and answers NONE for genuine chit-chat. The
                // classifier's "which one?" is only the fallback: asking first would
                // stop the model from ever seeing these sentences.
                const viaAI = await aiTier(userText, currentPage, ctx, null, 16000);
                if (viaAI) return viaAI;
                if (rescued) return rescued;
            }
            return gated;
        }
    }

    // ── Tier 2: mid-task — re-ask the missing field; never dead-end a half-filled task
    const _mf = midFlowReask(conversationState);
    if (_mf) return _mf;

    // ── Tier 3: meaning classifier + Chrome's on-device model ────────────────
    // A confident classifier opens the task and asks one question (instant). The
    // model is consulted when the classifier is unsure — or, when its session is
    // already warm, to keep the details the user gave (party, amount) instead of
    // asking for them again. If the two readings disagree, the classifier's
    // question wins: one extra question beats a wrong record.
    const guess = nluToIntent(fixed);
    const confident = !!(guess && guess.entity && guess._source === 'nlu');
    if (!conversationState?.entity && (!confident || _aiBase)) {
        const viaAI = await aiTier(userText, currentPage, ctx, confident ? guess.entity : null, confident ? 9000 : 18000);
        if (viaAI) return viaAI;
    } else if (!_aiBase) { aiWarmIfRoomy(); }   // warm it for next time — never waited on
    if (guess) return guess;
    return notUnderstood(currentPage);
}

// Nothing matched: say so plainly, with what THIS page can do (longest path wins —
// '/pos' must not claim '/pos/creditnote').
function notUnderstood(currentPage) {
    let bestPath = '', ctx = null;
    for (const [path, c] of Object.entries(PAGE_CONTEXT_MAP)) {
        if (currentPage && currentPage.includes(path) && path.length > bestPath.length) { bestPath = path; ctx = c; }
    }
    const here = ctx ? `<br><small>On this page (${ctx.hint.split(/\s+[—-]\s+/)[0]}) I can ${ctx.actions.split(',').join(', ')}.</small>` : '';
    return { entity: null, action: 'chat', fields: {}, isReady: false, newTask: true, _source: 'local',
        botResponse: `🤔 I didn't catch that. Try plain words like <i>"create customer Raj Sharma"</i>, <i>"sell 2 PP10955 cash"</i> or <i>"total sales today"</i>.${here}` +
                     `<br><small>Type <b>help</b> to see everything I can do.</small>` };
}

// ══════════════════════════════════════════════════════════════════════════════
// SELF-LEARNING — Vasy gets better at THIS business's way of saying things
// ──────────────────────────────────────────────────────────────────────────────
// Only OUTCOMES teach: a phrasing is remembered when the task it produced ended in
// success, so a misread the user cancelled is never learned. Two memories, both in
// chrome.storage.local on this browser only (popup → "Forget what Vasy learned"):
//   phrases  — exact phrasing → the intent that worked; replayed instantly, no AI
//   examples — the phrasing added to the meaning classifier's training set under
//              the task it turned out to be, so NEW wordings close to it resolve too
// Phrasings the rules already handle are not stored — the rules know them.
// ══════════════════════════════════════════════════════════════════════════════
const LEARN_KEY = 'vasyLearn';
let _learn = { phrases: {}, examples: [] };
const _learnReady = (async () => {
    try {
        const r = await chrome.storage.local.get([LEARN_KEY]);
        if (r[LEARN_KEY]) _learn = { phrases: {}, examples: [], ...r[LEARN_KEY] };
        _nluIndex = null;   // rebuild the classifier with what was learned
    } catch (e) {}
})();
const _learnKey = s => String(s || '').toLowerCase().replace(/[^a-z0-9ऀ-࿿ ]/g, ' ').replace(/\s+/g, ' ').trim();
function saveLearn() { try { chrome.storage.local.set({ [LEARN_KEY]: _learn }); } catch (e) {} }
function learnedCount() { return { phrases: Object.keys(_learn.phrases || {}).length, examples: (_learn.examples || []).length }; }

// Per tab: what the last dispatched task should teach if it succeeds, and the
// phrase behind a task that had to be clarified first.
const _learnPending = new Map();   // tabId → { text, intent, replay, time }
const _learnOrigin  = new Map();   // tabId → { text, entity|null, time }
function rememberParse(tabId, text, intent) {
    if (!tabId || !intent) return;
    const src = intent._source || '';
    const said = intent._originalText || text;
    // the classifier/model had to ask, or opened a task and asked a field: remember
    // the ORIGINAL words and the tasks it offered, so the answer can be linked back
    if (src === 'nlu-ask' || ((src === 'nlu' || src === 'chrome-ai') && !intent.isReady && intent.entity)) {
        _learnOrigin.set(tabId, { text: said, cands: intent._nluCands || (intent.entity ? [intent.entity] : []), hops: 0, time: Date.now() });
        return;
    }
    const o = _learnOrigin.get(tabId);
    // A clarification is answered by the NEXT command (or the field answers that
    // finish it) — never by something said much later. Live testing showed the
    // danger: "any notebook1 sitting in the godown" got linked to an unrelated
    // "open debit notes" sent a minute afterwards.
    if (o && !intent.isReady) { if (++o.hops > 3) _learnOrigin.delete(tabId); return; }
    if (!intent.entity || !intent.isReady || intent.action === 'out_of_scope') { _learnOrigin.delete(tabId); return; }
    _learnOrigin.delete(tabId);
    const fromOrigin = o && Date.now() - o.time < 180000 && o.cands.includes(intent.entity) && _learnKey(o.text) !== _learnKey(text);
    const direct = /^(nlu|chrome-ai)$/.test(src);
    if (!direct && !fromOrigin) return;
    _learnPending.set(tabId, {
        text: fromOrigin ? o.text : said,
        intent: { entity: intent.entity, action: intent.action, fields: fromOrigin ? {} : (intent.fields || {}),
                  botResponse: String(intent.botResponse || '').replace(/^🧠[^.]*\.\s*/, '') },
        replay: direct && !fromOrigin, time: Date.now() });
}
function learnOutcome(tabId, status, msg) {
    const p = tabId && _learnPending.get(tabId);
    if (!p) return;
    // A lookup's ANSWER arrives as 'info' ("PP10955: 80 in stock") — for a read-only
    // task that is the success; anywhere else 'info' means still mid-task.
    const answered = status === 'info' && aiIsReadOnly(p.intent) && !(msg && Array.isArray(msg.choices) && msg.choices.length);
    if (status !== 'success' && !answered) { if (status === 'error') _learnPending.delete(tabId); return; }
    _learnPending.delete(tabId);
    if (Date.now() - p.time > 300000) return;
    const k = _learnKey(p.text);
    if (!k || k.length > 160) return;
    if (p.replay) {
        _learn.phrases[k] = { ...p.intent, t: Date.now(), n: ((_learn.phrases[k] || {}).n || 0) + 1 };
        const keys = Object.keys(_learn.phrases);
        if (keys.length > 200) {
            keys.sort((a, b) => (_learn.phrases[a].t || 0) - (_learn.phrases[b].t || 0));
            for (const old of keys.slice(0, keys.length - 200)) delete _learn.phrases[old];
        }
    }
    const ex = _learn.examples || (_learn.examples = []);
    if (!ex.some(x => x.u === k && x.e === p.intent.entity)) {
        ex.push({ e: p.intent.entity, a: p.intent.action, u: k, t: Date.now() });
        while (ex.length > 400) ex.shift();
        _nluIndex = null;
    }
    saveLearn();
}
function learnedPhrase(text) {
    const hit = (_learn.phrases || {})[_learnKey(text)];
    if (!hit || !hit.entity) return null;
    return { entity: hit.entity, action: hit.action, fields: JSON.parse(JSON.stringify(hit.fields || {})),
             isReady: true, newTask: true, _source: 'learned', botResponse: hit.botResponse || 'On it…' };
}

// ══════════════════════════════════════════════════════════════════════════════
// ON-DEVICE AI — Chrome's built-in Prompt API (the model runs inside Chrome;
// no key, nothing leaves the browser). It is the LAST tier, used only when the
// rules, learned phrasings and the classifier all miss.
//
// It does not fill forms. It REWRITES the message into the house grammar — the
// same commands the rules parse — and the rules do the exact field extraction.
// Measured on this build: ~6 s to open a warm session, 3–8 s per answer, and it
// confused money in/out ("X gave me 2500" → "pay X"). So a write is PROPOSED
// ("I read that as …  go ahead?") and only runs after the user says yes; read-only
// answers run directly. A confirmed, successful proposal is learned (above), so
// the same words never need the model again.
// ══════════════════════════════════════════════════════════════════════════════
const AI_OPTS = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };
const AI_SCHEMA = { type: 'object', properties: { command: { type: 'string' } }, required: ['command'], additionalProperties: false };
const AI_SYS = `You rewrite a shop owner's message into ONE command for the VasyERP assistant.
Use exactly one of these forms. Keep every name, product, number and amount exactly as the user wrote them; never invent one.
create customer <name> | create supplier <name>
create purchase order for <supplier> <qty> <product> at <rate>
receive goods from <supplier> | create supplier bill for <supplier>
create sales invoice for <customer> <qty> <product> | create sales order for <customer> <qty> <product>
create estimate for <customer> <qty> <product> | create delivery challan for <customer> <qty> <product>
create credit note for <customer> | create debit note for <supplier>
sell <qty> <product> <cash|upi|card> | sell <qty> <product> to <customer> <cash|upi|card>
pay <party> <amount> <cash|upi|bank>   (money GOES OUT to the party)
collect <amount> from <party> <cash|upi|bank>   (money COMES IN from the party)
add expense <amount> <what> | increase stock of <product> by <qty> | decrease stock of <product> by <qty>
transfer <qty> <product> to <branch> | produce <n> batches of <recipe>
stock of <product> | how much does <party> owe | open invoice <number> | print <document number>
open <module> | <report name> <period> | total sales <period> | who owes me money | what is my business health score
Examples:
"mehta traders gave me 2500 by upi" -> collect 2500 from mehta traders upi
"i paid sharma 900 in cash" -> pay sharma 900 cash
"need 5 more pp10955 from sharma textiles" -> create purchase order for sharma textiles 5 pp10955
"what's left of notebook1" -> stock of notebook1
"any notebook1 sitting in the godown" -> stock of notebook1
"show me what sharma textiles owes" -> how much does sharma textiles owe
If a needed detail is missing, leave it out rather than writing a placeholder.
If the message is not about running a shop in VasyERP, the command is NONE.`;
let _aiBase = null, _aiBaseP = null, _aiState = { v: 'unknown', t: 0 };
async function aiAvailability() {
    if (typeof LanguageModel === 'undefined') return 'unavailable';
    if (Date.now() - _aiState.t < 60000 && _aiState.v !== 'unknown') return _aiState.v;
    let v = 'unavailable';
    try { v = await LanguageModel.availability(AI_OPTS); } catch (e) {}
    _aiState = { v, t: Date.now() };
    return v;
}
async function aiOff() { try { return !!(await chrome.storage.local.get(['vasyAIOff'])).vasyAIOff; } catch (e) { return false; } }
// ── Memory guard ──────────────────────────────────────────────────────────────
// Chrome's model service holds ~3.5 GB while a session is open. On an 8 GB laptop,
// keeping it warm pushed Windows into heavy paging (0.1 GB free, ~25,000 pages/s):
// this worker froze for 17–40 s at a time and even rule-only commands timed out.
// So: keep a session open between uses only on machines with room to spare; elsewhere
// open it when a wording needs it, never when memory is already short, and let it go
// soon after.
const AI_ROOMY_GB = 14, AI_MIN_FREE_GB = 2.5;
const AI_IDLE_MS = { roomy: 15 * 60000, tight: 90000 };
let _aiLastUse = 0, _aiOpenedAt = 0;
async function memInfo() {
    try {
        const m = await chrome.system.memory.getInfo();
        return { totalGB: Math.round(m.capacity / 2 ** 30 * 10) / 10, freeGB: Math.round(m.availableCapacity / 2 ** 30 * 10) / 10 };
    } catch (e) { return null; }
}
async function aiRoomy() { const m = await memInfo(); return !m || m.totalGB >= AI_ROOMY_GB; }
async function aiWarmIfRoomy() { if (_aiBase || await aiRoomy()) return aiBase(); return null; }
async function aiCanLoad() {
    if (_aiBase) return true;
    const m = await memInfo();
    return !m || m.freeGB >= AI_MIN_FREE_GB;
}
async function aiReleaseIdle() {
    if (!_aiBase) return;
    const idle = Date.now() - Math.max(_aiLastUse, _aiOpenedAt);
    if (idle < ((await aiRoomy()) ? AI_IDLE_MS.roomy : AI_IDLE_MS.tight)) return;
    try { _aiBase.destroy(); } catch (e) {}
    _aiBase = null; fl('model: released after', Math.round(idle / 1000) + 's idle');
}
setInterval(() => { aiReleaseIdle().catch(() => {}); }, 30000);

function aiBase() {
    if (_aiBase) return Promise.resolve(_aiBase);
    if (_aiBaseP) return _aiBaseP;
    _aiBaseP = (async () => {
        if (await aiOff() || await aiAvailability() !== 'available') return null;
        const at0 = Date.now(); fl('model: opening a session');
        try { _aiBase = await LanguageModel.create({ ...AI_OPTS, initialPrompts: [{ role: 'system', content: AI_SYS }] }); _aiOpenedAt = Date.now(); fl('model: ready', (Date.now() - at0) + 'ms'); }
        catch (e) { _aiBase = null; fl('model: failed', String(e && e.message || e).slice(0, 60)); }
        return _aiBase;
    })().finally(() => { _aiBaseP = null; });
    return _aiBaseP;
}
// One bounded attempt: the whole call (opening the session included) gets `ms`.
// Measured in the service worker: cold model load ~50–70 s (once — the bubble warms
// it when the chat opens), warm session 4–8 s, clone 7 ms, an answer 5–8 s.
async function aiRewrite(text, ms = 18000, onStart = null) {
    const deadline = Date.now() + ms;
    const left = () => Math.max(0, deadline - Date.now());
    if (!(await aiCanLoad())) { fl('model: skipped — memory is short'); return null; }
    _aiLastUse = Date.now();
    try { if (onStart) onStart(); } catch (e) {}
    const base = await Promise.race([aiBase(), sleep(left()).then(() => null)]);
    if (!base || !left()) return null;
    let s = null;
    try {
        s = await base.clone();
        const raw = await Promise.race([s.prompt(String(text).slice(0, 400), { responseConstraint: AI_SCHEMA }), sleep(left()).then(() => null)]);
        if (!raw) return null;
        const cmd = String((JSON.parse(raw) || {}).command || '').replace(/\s+/g, ' ').trim();
        if (!cmd || /^none$/i.test(cmd) || /[<>{}]/.test(cmd) || cmd.length > 200) return null;
        return cmd;
    } catch (e) { return null; }
    finally { try { if (s) s.destroy(); } catch (e) {} _aiLastUse = Date.now(); }
}
// Read-only answers run straight away; anything that writes is proposed first.
const AI_READ_ENTITIES = new Set(['PartyBalance', 'StockQuery', 'OpenDoc', 'PageQA', 'Report', 'Vina', 'SalesRegister']);
const aiIsReadOnly = r => AI_READ_ENTITIES.has(r.entity) || /^(list|view|search|fetch|query|open)$/.test(r.action || '')
                       || (r.entity === 'Setting' && r.fields && r.fields.desired === 'check');
const _aiProposal = new Map();   // tabId → { text, command, time }
const _escHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// The model's rewrite goes back through the RULES; only a reading the rules can
// execute counts. mustEntity = the classifier's confident reading, if any.
async function aiTier(userText, currentPage, ctx, mustEntity, ms) {
    // the bubble shows "thinking it over" only once the model is really being asked
    const note = () => { if (ctx && ctx.tabId) chrome.tabs.sendMessage(ctx.tabId, { action: 'parse_note', text: '🧠 New wording — thinking it over on this computer…' }).catch(() => {}); };
    const cmd = await aiRewrite(userText, ms, note);
    if (!cmd || _learnKey(cmd) === _learnKey(userText)) return null;
    const r = localParseTyped(cmd, { entity: null, action: null, fields: {} }, currentPage);
    if (!r || !r.entity || r.action === 'out_of_scope') return null;
    if (mustEntity && r.entity !== mustEntity) return null;
    r._source = 'chrome-ai'; r._aiCommand = cmd; r._originalText = userText;
    applyRcmFlag(r, cmd);
    if (aiIsReadOnly(r) && r.isReady) {
        r.botResponse = `🧠 Read as “${_escHtml(cmd)}”. ${r.botResponse || ''}`;
        return r;
    }
    if (ctx && ctx.tabId) _aiProposal.set(ctx.tabId, { text: userText, command: cmd, time: Date.now() });
    return { entity: null, action: 'chat', newTask: false, isReady: false, fields: {}, _source: 'chrome-ai',
             choices: [{ label: 'Yes, do it', value: 'yes' }, { label: 'No', value: 'no' }],
             botResponse: `🧠 I read that as <b>“${_escHtml(cmd)}”</b>. Shall I go ahead?` };
}

// ── Dispatch: navigate to module URL then inject content_agent.js ─────────────
async function handleDispatch(msg, tabId) {
    if (!tabId) return;
    navStart(tabId);
    const { entity, taskAction: action, fields } = msg;

    const sendError = m =>
        chrome.tabs.sendMessage(tabId, { action: 'agent_result', status: 'error', message: m }).catch(() => {});

    // A warning noted on an EARLIER form (e.g. "customer has not cleared 6 bills")
    // must not ride along on this task's result. Only a "yes" continues that form.
    if (entity !== 'ConfirmSave') { try { chrome.storage.local.remove('vasyPendingNote'); } catch (e) {} }

    let tab;
    try { tab = await chrome.tabs.get(tabId); }
    catch { sendError('Could not access the VasyERP tab.'); return; }

    const origin = new URL(tab.url).origin;

    // Settings toggle — navigate to the best-guess settings page; the handler
    // hops the remaining pages itself if the switch isn't there.
    if (entity === 'Setting') {
        // "open settings" (no switch named) → just show the General settings page
        if (!fields.settingName) {
            await navigateTo(tabId, `${origin}/setting/general`);
            injectAndSend(tabId, 'content_agent.js', { action: 'page_opened',
                data: { note: 'Settings are open. Tell me a switch to flip — e.g. <i>"enable voice message after billing"</i> — or a value like <i>"set decimal points to 2"</i>.' } });
            return;
        }
        await navigateTo(tabId, `${origin}${fields.firstPage || '/setting/pos'}`);
        // kind (t / d / n / x / m / c) and channel decide HOW the page sets it — the
        // FIFO/LIFO tiles (c) and the notification matrix (m) are not plain switches
        injectAndSend(tabId, 'content_agent.js', { action: 'toggle_setting',
            data: { settingName: fields.settingName, desired: fields.desired,
                    settingValue: fields.settingValue, pages: fields.pages || [],
                    kind: fields.kind || null, channel: fields.channel || null, group: fields.group || null } });
        return;
    }

    // Setup masters — one generic content_agent handler, spec travels with the
    // message so background.js stays the single source of truth for the shape.
    if (SIMPLE_MASTERS[entity] && (action === 'create' || action === 'add')) {
        await navigateTo(tabId, `${origin}${ROUTES[entity].new}`);
        injectAndSend(tabId, 'content_agent.js', { action: 'create_simple_master', entity,
            data: fields, spec: SIMPLE_MASTERS[entity] });
        return;
    }

    // VinaAI — advisory chatbot. Open it and (if we have one) ask the question.
    if (entity === 'Vina') {
        await navigateTo(tabId, `${origin}${ROUTES.Vina.list}`);
        injectAndSend(tabId, 'content_agent.js', { action: 'ask_vina', data: fields });
        return;
    }

    // Turn Vina's on-screen suggestions into a purchase order — read the CURRENT
    // page (Vina's answer is already there), no navigation.
    if (entity === 'VinaPO') {
        injectAndSend(tabId, 'content_agent.js', { action: 'po_from_vina', data: fields });
        return;
    }

    // Export the list we're already looking at — no navigation
    if (entity === 'ExportExcel') {
        injectAndSend(tabId, 'content_agent.js', { action: 'export_excel', data: fields });
        return;
    }

    // Read Vina's answer on the page we're already on — no navigation
    if (entity === 'VinaRead') {
        injectAndSend(tabId, 'content_agent.js', { action: 'read_vina', data: fields });
        return;
    }

    // Confirmed save — the form is already open and filled; just press Save.
    if (entity === 'ConfirmSave') {
        const pend = pendingLive();
        setPendingSave(null);
        const tid = pend?.tabId || tabId;
        const task = fields.task || pend?.task;
        // A confirmed save can reload the page or leave it (measured: the Stock
        // IN/OUT dialog reloads /product/opening-stock), which takes the content
        // script and its success message with it. The tab listener covers that,
        // but only for 120 s after the ORIGINAL command — and "yes" often comes
        // later. Re-arm it from the moment the user confirmed.
        try {
            const cur = new URL((await chrome.tabs.get(tid)).url).pathname;
            const route = ROUTES[task];
            await chrome.storage.local.set({ awaitingResult: true, pendingDispatch: {
                tabId: tid, entity: task || 'Record', listPath: (route && route.list) || cur, expectPath: null, time: Date.now() } });
        } catch (e) {}
        injectAndSend(tid, 'content_agent.js', { action: 'confirm_save', data: { task } });
        return;
    }

    // Approve / reject a stock transfer request
    if (entity === 'TransferApproval') {
        const path = new URL(tab.url).pathname;
        if (!/\/stocktransferrequest/.test(path)) {
            await navigateTo(tabId, `${origin}${ROUTES.StockTransferRequest.list}`);
        }
        injectAndSend(tabId, 'content_agent.js', { action: 'approve_transfer', data: fields });
        return;
    }

    // Any other dispatched task supersedes a pending confirmation
    if (entity) setPendingSave(null);

    // Direct link the user pasted — just open it and hand over
    if (entity === 'RawNav') {
        await navigateTo(tabId, `${origin}${fields.path || '/dashboard'}`);
        const where = _escHtml(fields.label || fields.path || '/dashboard');
        injectAndSend(tabId, 'content_agent.js', { action: 'page_opened',
            data: { note: `<b>${where}</b> is open — ${fields.hint ? _escHtml(fields.hint) + '.' : "tell me what you'd like to do here."}` } });
        return;
    }

    // Invoice receipt — mirror of bill payment on the sales side
    // Open (or print) one document by its number: its list, then the row's own link
    if (entity === 'OpenDoc') {
        const r = ROUTES[fields.docType];
        if (!r) { sendError(`I don't know where ${fields.docType} documents live.`); return; }
        await navigateTo(tabId, `${origin}${r.list}`);
        injectAndSend(tabId, 'content_agent.js', { action: 'open_document', data: fields });
        return;
    }
    // A party's balance is read with background fetches — no need to leave the page
    if (entity === 'PartyBalance') {
        injectAndSend(tabId, 'content_agent.js', { action: 'party_balance', data: fields });
        return;
    }
    // "print this" on a document's own page — nothing to navigate to
    if (entity === 'PrintDoc') {
        injectAndSend(tabId, 'content_agent.js', { action: 'print_document', data: { ...fields, here: true } });
        return;
    }
    if (entity === 'StockQuery') {
        await navigateTo(tabId, `${origin}${ROUTES.Product.list}`);
        injectAndSend(tabId, 'content_agent.js', { action: 'stock_query', data: fields });
        return;
    }

    if (entity === 'InvoiceReceipt') {
        await navigateTo(tabId, `${origin}${ROUTES.SalesInvoice.list}`);
        injectAndSend(tabId, 'content_agent.js', { action: 'collect_invoice', data: fields });
        return;
    }

    // E-Invoice / E-Way Bill for a NAMED document — locate in the invoice list first
    if (entity === 'EInvoiceDoc') {
        await navigateTo(tabId, `${origin}${ROUTES.SalesInvoice.list}`);
        injectAndSend(tabId, 'content_agent.js', { action: 'einvoice_for_doc', data: fields });
        return;
    }

    // User role — the LEGACY page, deliberately. Three places used to disagree
    // about this URL: ROUTES said /userrole/new, this branch hardcoded the React
    // rebuild at /users/user-roles/new, and createUserRole() reads the permission
    // matrix by semantic id (View-pos, Insert-bill, …) which only the legacy page
    // renders. The React page has no checkboxes at all, so every preset silently
    // matched nothing and the role saved with ZERO permissions — a wrong result
    // that looks like a right one. ROUTES is the single source of truth now.
    if (entity === 'UserRole') {
        // "open user roles" is the list — only a create opens the new-role form
        if (action === 'list' || action === 'search') {
            await navigateTo(tabId, `${origin}${ROUTES.UserRole.list}`);
            injectAndSend(tabId, 'content_agent.js', { action: 'search_records', data: { query: fields.searchQuery || '' } });
            return;
        }
        await navigateTo(tabId, `${origin}${ROUTES.UserRole.new}`);
        injectAndSend(tabId, 'content_agent.js', { action: 'create_user_role', data: fields });
        return;
    }

    // Bill payment — go to the Supplier Bill list, then content_agent locates the
    // bill and chains to /payment/new?purchaseId=… (VasyERP's own flow).
    if (entity === 'BillPayment') {
        await navigateTo(tabId, `${origin}${ROUTES.SupplierBill.list}`);
        injectAndSend(tabId, 'content_agent.js', { action: 'pay_bill', data: fields });
        return;
    }

    // Page Q&A — answer from the page. Dashboard-metric questions always get
    // LIVE data: navigate to /dashboard (fresh load = fresh numbers) unless
    // already there. Report/table questions answer from the current page.
    // Generic field fill acts on the page the user is looking at — never navigate.
    if (entity === 'FieldFill') {
        injectAndSend(tabId, 'content_agent.js', { action: 'fill_fields', data: fields });
        return;
    }
    if (entity === 'PageQA') {
        const q = fields.question || '';
        const path = new URL(tab.url).pathname;
        const onDash = path === '/' || path.includes('dashboard');
        if (!onDash && (fields.wantsDashboard || /\bdashboard\b/i.test(q))) {
            await navigateTo(tabId, `${origin}/dashboard`);
        }
        injectAndSend(tabId, 'content_agent.js', { action: 'page_qa',
            data: { question: q, period: fields.period || null, fySwitch: fields.fySwitch || null } });
        return;
    }

    // Reports — navigate to report hub then let content_agent route internally
    if (entity === 'Report') {
        await navigateTo(tabId, `${origin}${ROUTES.Report.list}`);
        injectAndSend(tabId, 'content_agent.js', { action: 'fill_report', data: fields });
        return;
    }

    // E-Invoice / E-Way Bill — trigger on the CURRENT page, no navigation needed
    if (entity === 'EInvoice' || entity === 'EWayBill') {
        injectAndSend(tabId, 'content_agent.js', { action: 'create_record', entity, data: fields });
        return;
    }

    // POS batch selection — no navigation, re-inject on current tab
    if (entity === 'POSSale' && action === 'select_batch') {
        injectAndSend(tabId, 'content_agent.js', { action: 'select_batch', data: fields });
        return;
    }

    // Bank Reconciliation — navigate then apply any filters
    if (entity === 'BankReconciliation') {
        const route = ROUTES.BankReconciliation;
        await navigateTo(tabId, `${origin}${route.list}`);
        injectAndSend(tabId, 'content_agent.js', { action: 'create_record', entity, data: fields });
        return;
    }

    // Loyalty adjust/assign — navigate to loyalty page
    if (entity === 'Loyalty') {
        const loyaltyRoute = ROUTES.Loyalty;
        await navigateTo(tabId, `${origin}${loyaltyRoute.list}`);
        injectAndSend(tabId, 'content_agent.js', { action: 'create_record', entity, data: fields });
        return;
    }

    // Feedback — navigate to feedback list and search
    if (entity === 'Feedback') {
        await navigateTo(tabId, `${origin}${ROUTES.Feedback.list}`);
        const q = fields.searchQuery || '';
        injectAndSend(tabId, 'content_agent.js', { action: 'search_records', data: { query: q } });
        return;
    }

    const route = ROUTES[entity];
    if (!route) { sendError(`Unknown module: "<b>${entity}</b>". This may not be accessible in your VasyERP account.`); return; }

    if (action === 'search' || action === 'list' || action === 'fetch') {
        await navigateTo(tabId, `${origin}${route.list}`);
        const q = fields.searchQuery || fields.firstName || fields.name ||
                  fields.customerName || fields.supplierName || fields.productName || '';
        injectAndSend(tabId, 'content_agent.js', { action: 'search_records', data: { query: q, contactType: fields.contactType || null, note: fields.note || null,
            tab: ['Category', 'Brand', 'Department'].includes(entity) ? entity : null } });

    } else if (action === 'delete' || action === 'deactivate') {
        await navigateTo(tabId, `${origin}${route.list}`);
        injectAndSend(tabId, 'content_agent.js', { action: `${action}_record`, entity, data: { ...fields, entity } });

    } else if (action === 'edit') {
        await navigateTo(tabId, `${origin}${route.list}`);
        injectAndSend(tabId, 'content_agent.js', { action: 'edit_record', entity, data: fields });
        // Saving an edit leaves the form for the record's page, taking the content
        // script and its reply with it — let the tab listener report it.
        chrome.storage.local.set({ pendingDispatch: { tabId, entity, kind: 'edit',
            listPath: entity === 'Contact' ? '/contact' : route.list, expectPath: null, time: Date.now() } });

    } else if (action === 'create' || action === 'generate') {
        await navigateTo(tabId, `${origin}${route.new}`);
        injectAndSend(tabId, 'content_agent.js', { action: 'create_record', entity, data: fields });
        if (action === 'create') {
            // For a contact, remember WHICH list it must land on — see the listener.
            const ct = entity === 'Contact' ? String((fields || {}).contactType || 'Customer').toLowerCase() : '';
            const expectPath = entity === 'Contact'
                ? '/contact/' + (/supplier|vendor/.test(ct) ? 'suppliers' : /transport/.test(ct) ? 'transport' : 'customers')
                : null;
            chrome.storage.local.set({ pendingDispatch: { tabId, entity, listPath: route.list, expectPath, time: Date.now() } });
        }

    } else if (action === 'adjust' || action === 'assign') {
        await navigateTo(tabId, `${origin}${route.list}`);
        injectAndSend(tabId, 'content_agent.js', { action: 'create_record', entity, data: fields });

    } else if (action === 'view' || action === 'open' || action === 'print' || action === 'export') {
        // Read-only modules — Logs, Tally, barcode labels, catalogues. Their
        // handlers all hang off create_record in content_agent.js; without this
        // branch "show user activity log" parsed perfectly, routed nowhere, and
        // came back as "Unsupported action: view" even though openLogs() exists.
        await navigateTo(tabId, `${origin}${route.list}`);
        injectAndSend(tabId, 'content_agent.js', { action: 'create_record', entity, data: fields });

    } else {
        sendError(`Unsupported action: "${action}". Try rephrasing.`);
    }
}

// ── Navigate to a URL, then inject a script and send it a message ─────────────
// Used by the edit flow: content_agent finds the edit URL, asks background
// to navigate there and re-inject so the edit form can be filled.
async function handleInjectOnNavigate(msg, tabId) {
    if (!tabId || !msg.url) return;
    navStart(tabId);
    await navigateTo(tabId, msg.url);
    injectAndSend(tabId, msg.script || 'content_agent.js', msg.message || {});
}

// VasyERP's own Print does window.open(print view) + print(); a page script can't
// (popup blocker), the extension can. Only the ERP tab's own origin is opened.
async function openPrintTab({ url, print }, from) {
    if (!from || !from.url || !url) return { ok: false, error: 'no tab' };
    const u = new URL(url);
    if (u.origin !== new URL(from.url).origin) return { ok: false, error: 'not an ERP link' };
    const tab = await chrome.tabs.create({ url: u.href, windowId: from.windowId, index: from.index + 1, openerTabId: from.id, active: true });
    if (!print) return { ok: true, tabId: tab.id };
    await new Promise(resolve => {
        const t = setTimeout(done, 20000);
        function done() { clearTimeout(t); chrome.tabs.onUpdated.removeListener(onUpd); resolve(); }
        function onUpd(id, info) { if (id === tab.id && info.status === 'complete') done(); }
        chrome.tabs.onUpdated.addListener(onUpd);
        chrome.tabs.get(tab.id).then(x => { if (x.status === 'complete' && x.url && x.url !== 'about:blank') done(); }).catch(done);
    });
    await waitPageReady(tab.id, 2500);   // the print view draws its QR code / barcode after load
    try {
        // print() blocks the page until the dialog closes — schedule it, don't wait on it
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => { setTimeout(() => window.print(), 300); } });
        return { ok: true, tabId: tab.id, printed: true };
    } catch (e) {
        return { ok: true, tabId: tab.id, printed: false };
    }
}

// ── Tab navigation helper ─────────────────────────────────────────────────────
// ── Is the page actually ready, or just "complete"? ─────────────────────────
// navigateTo() used to wait for status=complete and then sleep a flat 3.5 s on
// every single navigated action. Measured across 14 real VasyERP pages the page
// is genuinely ready 0.5–2.4 s after complete (55% less waiting in total), so the
// flat sleep was mostly paid for nothing. This asks the page itself: readyState
// complete, no visible preloader, no XHR in flight, and no DOM mutation for
// 350 ms. The old 3.5 s survives as the ceiling, so a slow page (or the POS
// terminal behind a closed register, whose preloader never clears) waits exactly
// as long as before — never less safely, only less wastefully.
async function waitPageReady(tabId, maxMs = 3500) {
    try {
        const [res] = await chrome.scripting.executeScript({
            target: { tabId },
            func: (cap) => new Promise(resolve => {
                const t0 = Date.now();
                let last = Date.now();
                let mo = null;
                try {
                    mo = new MutationObserver(() => { last = Date.now(); });
                    mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
                } catch (e) {}
                const tick = () => {
                    const pre = document.querySelector('.preloader');
                    const preVisible = !!(pre && pre.offsetParent !== null && getComputedStyle(pre).display !== 'none');
                    const busy = Number(document.documentElement.dataset.vasyInflight || 0) > 0;
                    const quiet = Date.now() - last >= 350;
                    if ((document.readyState === 'complete' && !preVisible && !busy && quiet) || Date.now() - t0 >= cap) {
                        if (mo) mo.disconnect();
                        resolve(Date.now() - t0);
                        return;
                    }
                    setTimeout(tick, 80);
                };
                setTimeout(tick, 150);
            }),
            args: [maxMs],
        });
        return res && typeof res.result === 'number' ? res.result : maxMs;
    } catch (e) {
        // Couldn't reach the page (chrome://, a crashed tab, a permission gap) —
        // fall back to the old fixed wait rather than racing ahead.
        await sleep(maxMs);
        return maxMs;
    }
}

async function navigateTo(tabId, targetUrl) {
    const tab = await chrome.tabs.get(tabId);
    const currentPath = new URL(tab.url).pathname.replace(/\/$/, '');
    const targetPath  = new URL(targetUrl).pathname.replace(/\/$/, '');
    if (currentPath === targetPath) { await waitPageReady(tabId, 1200); return; }
    const nt0 = Date.now(); fl('navigate', targetPath);
    try { await _navigateTo(tabId, targetUrl); } finally { fl('navigated', targetPath, (Date.now() - nt0) + 'ms'); }
}
async function _navigateTo(tabId, targetUrl) {

    await new Promise((resolve) => {
        let settled = false;
        const done = () => { if (!settled) { settled = true; resolve(); } };

        // Safety timeout — resolve after 20s even if onUpdated never fires
        const safetyTimer = setTimeout(done, 20000);

        chrome.tabs.update(tabId, { url: targetUrl }, () => {
            if (chrome.runtime.lastError) { clearTimeout(safetyTimer); done(); return; }
            const listener = (id, info) => {
                if (id === tabId && info.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    clearTimeout(safetyTimer);
                    done();
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
        });
    });
    await waitPageReady(tabId, 3500);
}

// ── Inject content_agent.js and send it a message ────────────────────────────
function injectAndSend(tabId, file, message) {
    const it0 = Date.now(); fl('inject', message.action);
    // Step 1: run vasy_main_helper.js in MAIN world to extract Select2 AJAX configs into dataset.*
    chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        files: ['vasy_main_helper.js']
    }, () => {
        if (chrome.runtime.lastError) { /* best-effort, non-fatal */ }
        // Step 2: inject content_agent.js (isolated world) and send the action message
        chrome.scripting.executeScript({ target: { tabId }, files: [file] }, () => {
            if (chrome.runtime.lastError) {
                const err = chrome.runtime.lastError.message || '';
                fl('inject failed', err.slice(0, 80));
                const isAccess = /access|denied|permission/i.test(err);
                chrome.tabs.sendMessage(tabId, {
                    action: 'agent_result',
                    status: 'error',
                    message: isAccess
                        ? 'Access Denied — this module requires extra permissions. Ask your VasyERP admin.'
                        : `Script injection failed: ${err}`
                }).catch(() => {});
                return;
            }
            // content_agent.js registers its onMessage listener synchronously while
            // it is being evaluated, and this callback only fires after that has
            // happened — a single tick lets the listener attach. The agent ACKs every
            // command; no ack means the page changed under us, so inject once more and
            // retry, and if that fails too, say so instead of leaving the bubble waiting.
            const msg = { ...message, __vasyId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
            const send = () => chrome.tabs.sendMessage(tabId, msg).then(r => !!(r && r.ack)).catch(() => false);
            setTimeout(async () => {
                if (await send()) { fl('page took', message.action, (Date.now() - it0) + 'ms'); return navDone(tabId); }
                fl('no ack — injecting again', message.action);
                await sleep(800);
                try { await chrome.scripting.executeScript({ target: { tabId }, files: [file] }); } catch (e) {}
                await sleep(120);
                if (await send()) { fl('page took (retry)', message.action, (Date.now() - it0) + 'ms'); return navDone(tabId); }
                fl('page never took', message.action);
                navDone(tabId);
                chrome.tabs.sendMessage(tabId, { action: 'agent_result', status: 'error',
                    message: 'The page changed while I was starting that, so nothing was done. Send it again and I’ll retry.' }).catch(() => {});
            }, 60);
        });
    });
}

// Is the background still opening a page / injecting for this tab? content_agent's
// "nothing came back" guard asks before it speaks, so a slow page load is never
// mistaken for a handler that went quiet.
const _navBusy = new Map();
// Chrome stops an idle MV3 worker after ~30 s with no extension events or API calls. A
// page that slow to load (a busy or low-memory PC) killed the worker mid-task, so the
// command never reached the page and the bubble waited for nothing. While a task is
// being opened, touch an API every 20 s so the worker stays up until the page has it.
let _keepAlive = null;
function navStart(tabId) {
    if (tabId) _navBusy.set(tabId, Date.now());
    if (!_keepAlive) _keepAlive = setInterval(() => {
        for (const [id, t] of _navBusy) if (Date.now() - t > 180000) _navBusy.delete(id);
        if (!_navBusy.size) { clearInterval(_keepAlive); _keepAlive = null; return; }
        chrome.runtime.getPlatformInfo().catch(() => {});
    }, 20000);
}
function navDone(tabId) { if (tabId) setTimeout(() => _navBusy.delete(tabId), 1500); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
