// © 2026 Moksheet Shah. All rights reserved. Shared for viewing only — no copying, modification or redistribution without written permission. See LICENSE.
// vasy_main_helper.js — runs in MAIN world before content_agent.js
// 1. Reads Select2 AJAX configs from jQuery → element.dataset.* (CSRF-aware fetch in isolated world)
// 2. Installs a "product add" bridge: the isolated-world agent asks us (who have real jQuery
//    + the typeahead instance) to find a product via Bloodhound, select it, and set qty/price.
(function() {
    var $ = window.jQuery;

    // ── (0) In-flight network counter ────────────────────────────────────────
    // The isolated-world agent used to wait for saves and lookups with fixed
    // sleeps sized for the slowest case, so every fast page paid the slow page's
    // price. It cannot see the page's own fetch/XHR from its world, so we count
    // them here and publish the tally on the <html> dataset, which both worlds
    // share. Wrapping is idempotent and never swallows a request.
    try {
        if (!window.__vasyNetHooked) {
            window.__vasyNetHooked = true;
            var de = document.documentElement, inflight = 0;
            var pub = function(delta) {
                inflight = Math.max(0, inflight + delta);
                de.dataset.vasyInflight = String(inflight);
                de.dataset.vasyNetLast  = String(Date.now());
            };
            pub(0);
            var of = window.fetch;
            if (of) window.fetch = function() {
                pub(1);
                var done = false, fin = function() { if (!done) { done = true; pub(-1); } };
                try { return of.apply(this, arguments).then(
                    function(r) { fin(); return r; },
                    function(e) { fin(); throw e; }); }
                catch (e) { fin(); throw e; }
            };
            var os = window.XMLHttpRequest && window.XMLHttpRequest.prototype.send;
            if (os) window.XMLHttpRequest.prototype.send = function() {
                var settled = false, self = this;
                var fin = function() { if (!settled) { settled = true; pub(-1); } };
                pub(1);
                try { self.addEventListener('loadend', fin); } catch (e) {}
                try { return os.apply(self, arguments); } catch (e) { fin(); throw e; }
            };
        }
    } catch (e) {}

    // ── (0b) Publish the ERP's own capability flags ──────────────────────────
    // VasyERP decides what this user may do with globals on `window`:
    // ISSALESREGISTEROPEN gates the whole POS terminal, salesregisterpermission
    // says whether this role may open one, NEWPRODUCTPERMISSION gates the inline
    // product quick-create. The agent runs in the ISOLATED world and cannot see
    // any of them — reading window.X there returns undefined, which reads as
    // "not allowed" and is indistinguishable from a genuine denial. The two
    // worlds share the DOM, so mirror the flags onto <html> where both can read.
    function publishFlags() {
        try {
            var de = document.documentElement, n = 0;
            var map = {
                vasyPosRegisterOpen: 'ISSALESREGISTEROPEN',
                vasyPosRegisterPerm: 'salesregisterpermission',
                vasyNewProductPerm:  'NEWPRODUCTPERMISSION',
                vasyPosPrinting:     'ALLOWPOSPRINTING',
                vasyPosDiscountPerm: 'ALLOWPOSDISCOUNTCHANGE',
                vasyPosMrpPerm:      'ALLOWPOSMRPCHANGE',
            };
            for (var k in map) {
                var v = window[map[k]];
                if (typeof v !== 'undefined') { de.dataset[k] = String(v); n++; }
            }
            de.dataset.vasyQuickProduct = (typeof window.setProductModal === 'function') ? '1' : '0';
            return n;
        } catch (e) { return 0; }
    }
    // The isolated world can't call page functions, so it asks us instead.
    document.addEventListener('vasy:open-quick-product', function() {
        try { if (typeof window.setProductModal === 'function') window.setProductModal(0, 1); } catch (e) {}
    });
    publishFlags();
    // The POS bundle sets several of these after its own boot, so keep looking
    // for a while rather than reading once and believing an early snapshot.
    var _flagTries = 0;
    var _flagTimer = setInterval(function() {
        publishFlags();
        if (++_flagTries > 20) clearInterval(_flagTimer);
    }, 700);

    // ── (1) Extract Select2 AJAX config into dataset ─────────────────────────
    // Select2 initialises AFTER page load on slow pages, so a single immediate
    // pass races it and leaves dataset empty ("supplier not found" while the
    // option is on screen). Retry every 600ms for up to 12s until configs land.
    function extractSelect2Configs() {
        var jq = window.jQuery;
        if (!jq) return 0;
        var got = 0;
        document.querySelectorAll('select[id]').forEach(function(el) {
            try {
                if (el.dataset.vasyAjaxUrl) { got++; return; }
                var aj = jq(el).data('select2') && jq(el).data('select2').options && jq(el).data('select2').options.options && jq(el).data('select2').options.options.ajax;
                if (!aj || !aj.url) return;
                var sentinel = '\x01TERM\x01';
                var sample = aj.data ? aj.data({term: sentinel, page: 1}) : {term: sentinel};
                var paramKey = 'term';
                var keys = Object.keys(sample);
                for (var i = 0; i < keys.length; i++) {
                    if (sample[keys[i]] === sentinel) { paramKey = keys[i]; break; }
                }
                el.dataset.vasyAjaxUrl    = aj.url;
                el.dataset.vasyAjaxKey    = paramKey;
                el.dataset.vasyAjaxMethod = (aj.type || 'POST').toUpperCase();
                got++;
            } catch(e) {}
        });
        return got;
    }
    extractSelect2Configs();
    var _exTries = 0;
    var _exTimer = setInterval(function() {
        if (extractSelect2Configs() > 0 || ++_exTries > 20) clearInterval(_exTimer);
    }, 600);
    // Isolated world can also demand a fresh pass right before a lookup
    if (!window.__vasyExtractHook) {
        window.__vasyExtractHook = true;
        document.addEventListener('vasy:extract-select2', function() { extractSelect2Configs(); });
    }

    // ── (2) Product-add bridge — install once ──
    if (window.__vasyMainBridge) return;
    window.__vasyMainBridge = true;

    function norm(x) { return String(x == null ? '' : x).toLowerCase().replace(/[^a-z0-9]/g, ''); }
    function sleep(ms) { return new Promise(function(r){ setTimeout(r, ms); }); }

    // Fuzzy similarity 0..1 — space/case/punctuation-insensitive, tolerant of
    // joined/split words ("mousepad" ≈ "mouse pad") and small typos (bigram dice).
    function fuzzyScore(query, candidate) {
        var nq = norm(query), nc = norm(candidate);
        if (!nq || !nc) return 0;
        if (nq === nc) return 1;
        if (nc.indexOf(nq) === 0 || nq.indexOf(nc) === 0) return 0.93;
        if (nc.indexOf(nq) !== -1 || nq.indexOf(nc) !== -1) return 0.85;
        var big = function(s) { var m = {}; for (var i = 0; i < s.length - 1; i++) { var b = s.substr(i, 2); m[b] = (m[b] || 0) + 1; } return m; };
        var a = big(nq), b = big(nc), inter = 0, ta = 0, tb = 0, k;
        for (k in a) { ta += a[k]; if (b[k]) inter += Math.min(a[k], b[k]); }
        for (k in b) { tb += b[k]; }
        return (2 * inter) / ((ta + tb) || 1);
    }

    function setVal(el, v) {
        if (!el) return false;
        var jq = window.jQuery;
        var d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
        if (d && d.set) d.set.call(el, String(v)); else el.value = String(v);
        ['input','change','keyup'].forEach(function(ev){ el.dispatchEvent(new Event(ev, {bubbles:true})); });
        if (jq) { try { jq(el).trigger('change'); } catch(e) {} }
        return true;
    }

    // Query the typeahead's Bloodhound source for a term. Resolves with an array of data.
    function bloodhoundSearch(dataset, term) {
        return new Promise(function(resolve) {
            var sync = [];
            try {
                dataset.source.call(dataset, term, function(a){ sync = a || []; }, function(a){ resolve((a && a.length) ? a : sync); });
            } catch(e) { resolve([]); }
            setTimeout(function(){ resolve(sync); }, 2200);
        });
    }

    // On the SALES pages the Bloodhound remote stays cold until the input has
    // actually been typed into: calling source() first thing returns nothing and
    // the async callback never fires, so the agent reported "product not found"
    // for products that exist. Poke the input the way a user would, then retry.
    // (PO answers on the async callback and POS on the sync one, so accept either.)
    function warmTypeahead(inp, dataset, term) {
        return new Promise(function(resolve) {
            try {
                var d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(inp), 'value');
                inp.focus();
                if (d && d.set) d.set.call(inp, String(term)); else inp.value = String(term);
                inp.dispatchEvent(new Event('input', { bubbles: true }));
                // typeahead 0.10 listens on KEYUP — a bare 'input' event does not
                // start its remote fetch. Verified live: cold source() → 0 results,
                // after a jQuery keyup → 94.
                if (window.jQuery) { try { window.jQuery(inp).trigger('keyup'); } catch(e) {} }
                inp.dispatchEvent(new KeyboardEvent('keyup', { key: String(term).slice(-1), bubbles: true }));
            } catch(e) {}
            var tries = 0;
            var timer = setInterval(function() {
                bloodhoundSearch(dataset, term).then(function(items) {
                    if ((items && items.length) || ++tries > 6) {
                        clearInterval(timer);
                        resolve(items || []);
                    }
                });
            }, 500);
        });
    }

    // Set qty/price/discount on the last row whose itemcode is filled (the product we just added).
    function applyRowValues(qty, price, discount) {
        var filled = Array.prototype.slice.call(document.querySelectorAll('input[id^="itemcode"]'))
            .filter(function(i){ return i.offsetParent && i.value && i.value.trim(); });
        var last = filled[filled.length - 1];
        if (!last) return null;
        var n = last.id.replace('itemcode', '');
        if (qty) {
            var q = document.getElementById('qty' + n) || document.getElementById('poqty' + n);
            if (q) setVal(q, qty);
        }
        if (price) {
            var p = document.getElementById('price' + n);
            if (p) setVal(p, price);
        }
        if (discount) {
            var disc = document.getElementById('discount' + n)
                    || document.getElementById('Discount' + n)
                    || document.getElementById('discountPer' + n)
                    || document.getElementById('disc' + n);
            if (disc) setVal(disc, discount);
        }
        return n;
    }

    // ── Dashboard period bridge ──────────────────────────────────────────────
    // Isolated world sets documentElement.dataset.vasyPeriod (a data-range-key like
    // "Yesterday"), clears vasyPeriodResult, dispatches 'vasy:set-period'. We click
    // the range item inside the picker's own container via the jQuery instance —
    // works even while the picker is closed (handlers are bound on the lis).
    // ── POS scan bridge ──────────────────────────────────────────────────────
    // The POS box adds a scanned item code on a document-level keyup Enter that
    // calls the page's getProductByBarcode(). A scripted event from the isolated
    // world reaches that handler with keyCode 0, so the scan is done here instead.
    // Isolated world sets dataset.vasyScanCode, clears vasyScanResult, dispatches.
    document.addEventListener('vasy:pos-scan', function() {
        var ds = document.documentElement.dataset;
        var code = ds.vasyScanCode || '';
        var finish = function(r) { ds.vasyScanResult = r; };
        try {
            var jq = window.jQuery, inp = document.getElementById('searchBarcode');
            if (!inp || !code) return finish('noinput');
            if (jq && jq(inp).data('ttTypeahead')) jq(inp).typeahead('val', code); else inp.value = code;
            if (typeof window.getProductByBarcode === 'function') { window.getProductByBarcode(); return finish('called'); }
            if (jq) { jq(inp).trigger(jq.Event('keyup', { which: 13, keyCode: 13, key: 'Enter' })); return finish('keyup'); }
            finish('nojq');
        } catch (err) { finish('error:' + (err && err.message || '')); }
    });

    document.addEventListener('vasy:set-period', function() {
        var ds = document.documentElement.dataset;
        var key = ds.vasyPeriod || '';
        var inputId = ds.vasyPeriodInput || 'fromToDate';
        var finish = function(r) { document.documentElement.dataset.vasyPeriodResult = r; };
        try {
            var jq = window.jQuery;
            var inp = document.getElementById(inputId);
            if (!inp) return finish('noinput');
            var drp = jq && jq(inp).data('daterangepicker');
            var container = drp && drp.container && drp.container[0];
            if (!container) return finish('nopicker');
            var li = null;
            var lis = container.querySelectorAll('.ranges li');
            for (var i = 0; i < lis.length; i++) {
                if ((lis[i].getAttribute('data-range-key') || lis[i].innerText || '').trim().toLowerCase() === key.toLowerCase()) { li = lis[i]; break; }
            }
            if (!li) return finish('norange');
            if (jq) { try { jq(li).trigger('click'); } catch(e) {} }
            li.click();
            finish('ok');
        } catch (err) { finish('error'); }
    });

    // Main handler. Isolated world clears documentElement.dataset.vasyPaResult, sets
    // vasyPaQuery/vasyPaQty/vasyPaPrice/vasyPaInput/vasyPaAddIfMissing, then dispatches this.
    document.addEventListener('vasy:product-add', function() {
        var ds = document.documentElement.dataset;
        var query = ds.vasyPaQuery || '';
        // "<name> #<id>": the user picked one of several products sharing a name
        var pinId = null, pinM = query.match(/^(.*?)\s*#(\d{3,})\s*$/);
        if (pinM) { query = pinM[1]; pinId = pinM[2]; }
        var qty   = ds.vasyPaQty || '';
        var price = ds.vasyPaPrice || '';
        var discount = ds.vasyPaDiscount || '';
        var inputId = ds.vasyPaInput || 'searchItemBarcode';
        var addIfMissing = ds.vasyPaAddIfMissing === '1';

        var finish = function(result) { document.documentElement.dataset.vasyPaResult = result; };

        (async function() {
            try {
                var jq = window.jQuery;
                if (!jq) return finish('error:nojquery');
                var inp = document.getElementById(inputId)
                       || document.querySelector('[id*="' + inputId + '"]')
                       || document.querySelector('input.tt-input');
                if (!inp) return finish('error:noinput');

                // Typeahead initialises after page load on slow pages — wait ≤5s
                var dataset = null;
                for (var w = 0; w < 12; w++) {
                    var tt = jq(inp).data('ttTypeahead');
                    dataset = tt && tt.menu && tt.menu.datasets && tt.menu.datasets[0];
                    if (dataset && typeof dataset.source === 'function') break;
                    dataset = null;
                    await sleep(450);
                }
                if (!dataset) return finish('error:notypeahead');

                // Datum display name: PO pages use .name/.text, POS uses .value
                var nm = function(r) { return (r && (r.name || r.text || r.value)) || ''; };

                // ── Multi-term fuzzy search ──────────────────────────────────
                // The server ANDs every word as a PREFIX, so one joined/split word
                // ("mousepad" vs "mouse pad") or typo → 0 results. Strategy: search
                // several term variants, MERGE all candidates, then fuzzy-score
                // each against the full query and pick the best.
                var tokens = query.split(/\s+/).filter(function(w){ return w.length >= 2; });
                var byLen  = tokens.slice().sort(function(a, b){ return b.length - a.length; });
                var terms  = [query];                          // 1. exact phrase
                if (tokens.length > 1) {
                    terms.push(tokens.slice(0, 2).join(' '));  // 2. first two words
                    terms.push(byLen[0]);                      // 3. longest word (most distinctive)
                    if (byLen[1]) terms.push(byLen[1]);        // 4. 2nd longest word
                    terms.push(tokens[0]);                     // 5. first word
                } else {
                    // single word: also try shrinking prefixes ("Notebook1s" → "Notebook")
                    terms.push(query.slice(0, Math.max(3, Math.ceil(query.length * 0.6))));
                    terms.push(query.slice(0, 4));
                }

                var seen = {}, candidates = [], candSeen = {};
                var warmed = false;
                for (var i = 0; i < terms.length; i++) {
                    var p = terms[i];
                    if (!p || p.length < 2 || seen[p.toLowerCase()]) continue;
                    seen[p.toLowerCase()] = 1;
                    var res = await bloodhoundSearch(dataset, p);
                    // Cold remote (sales pages): nothing on the FIRST term means the
                    // source hasn't been initialised, not that the product is missing.
                    if ((!res || !res.length) && !warmed) {
                        warmed = true;
                        res = await warmTypeahead(inp, dataset, p);
                    }
                    for (var r = 0; r < (res ? res.length : 0); r++) {
                        var key = String(res[r].id || '') + '|' + nm(res[r]);
                        if (!candSeen[key]) { candSeen[key] = 1; candidates.push(res[r]); }
                    }
                    // Enough good candidates + an early strong match → stop searching
                    if (candidates.length >= 20) break;
                    if (candidates.length && i >= 1) {
                        var strong = false;
                        for (var c = 0; c < candidates.length; c++) {
                            if (fuzzyScore(query, nm(candidates[c])) >= 0.9) { strong = true; break; }
                        }
                        if (strong) break;
                    }
                }

                if (!candidates.length) {
                    if (addIfMissing && typeof window.setProductModal === 'function') {
                        try { window.setProductModal(0, 1); } catch(e) {}
                        return finish('add_product');
                    }
                    return finish('notfound');
                }

                // An exact ITEM CODE wins outright — people type "PP10955" off a
                // label, and this catalogue even has products with blank names,
                // which the name ranking below cannot tell apart at all.
                var codesOf = function(c) {
                    var out = [];
                    ['item_code', 'itemCode', 'itemcode', 'barcode', 'multiItemCode', 'sku', 'code'].forEach(function(k) {
                        [].concat(c && c[k] != null ? c[k] : []).forEach(function(x) { if (x != null && x !== '') out.push(norm(String(x))); });
                    });
                    return out;
                };
                var qCode = norm(query);
                var byCode = candidates.filter(function(c) { return codesOf(c).indexOf(qCode) >= 0; });
                // Fuzzy-rank all merged candidates against the FULL query.
                var datum = null, best = -1, tiedCount = 0;
                var pinned = pinId ? candidates.filter(function(c) { return String(c.id) === pinId; })[0] : null;
                if (pinned) { datum = pinned; best = 1; tiedCount = 1; }
                else if (byCode.length === 1) { datum = byCode[0]; best = 1; tiedCount = 1; }
                else for (var m = 0; m < candidates.length; m++) {
                    var sc = fuzzyScore(query, nm(candidates[m]));
                    if (sc > best) { best = sc; datum = candidates[m]; tiedCount = 1; }
                    // a blank name is "unknown", never "the same name"
                    else if (sc === best && datum && nm(datum) && norm(nm(candidates[m])) === norm(nm(datum))) tiedCount++;
                }
                // Two DIFFERENT products with the same name (this catalogue really
                // has "shinchan mouse pad blue" and "Shinchan mouse pad blue") score
                // identically, and `sc > best` would just keep the first one the
                // server happened to return — then put it on a stock transfer.
                if (tiedCount > 1) {
                    // Hand back enough to TELL THEM APART — this catalogue has
                    // "Shinchan mouse pad blue" ₹600 and "shinchan mouse pad blue"
                    // ₹500 under different codes; the name alone is useless.
                    var tiedOpts = candidates.filter(function(c) { return norm(nm(c)) === norm(nm(datum)); }).slice(0, 6).map(function(c) {
                        return { id: c.id, name: nm(c), code: String(c.itemcode || c.itemCode || [].concat(c.item_code || [])[0] || ''),
                                 mrp: String(c.mrp || '').trim(), price: String(c.selling || c.sellingPrice || '').trim() };
                    });
                    return finish('ambiguousj:' + JSON.stringify({ count: tiedCount, name: nm(datum) || query, opts: tiedOpts }));
                }
                // Below 0.45 the "match" is basically noise — treat as not found.
                if (best < 0.45) {
                    if (addIfMissing && typeof window.setProductModal === 'function') {
                        try { window.setProductModal(0, 1); } catch(e) {}
                        return finish('add_product');
                    }
                    return finish('notfound');
                }

                // Purchase screens add the line from the typeahead:select event, but
                // the SALES grid does not — it only fills a row when the suggestion
                // element itself is clicked. Firing the event there found the right
                // product and then quietly added nothing, so the document saved with
                // no lines (or was rejected for having none). Click the real element
                // when we can find it, and keep the events as the fallback.
                // ONE click. jQuery's trigger('click') already runs the native click,
                // so the old trigger + .click() pair picked the product TWICE. On a
                // sales invoice every pick starts an async barcode → stock lookup,
                // and two overlapping ones left the row empty and reset the grid —
                // the invoice then saved with no line ("Please select product").
                var filledRows = function() {
                    var n = 0, els = document.querySelectorAll('input[id^="itemcode"]');
                    for (var q = 0; q < els.length; q++) if (els[q].id.indexOf('{') < 0 && (els[q].value || '').trim()) n++;
                    return n;
                };
                var before = filledRows();
                var picked = false;
                try {
                    var wanted = norm(nm(datum));
                    var wantCodes = codesOf(datum);
                    var nodes = document.querySelectorAll('.tt-suggestion, .tt-selectable');
                    // Prefer the node carrying THIS datum: two products can share a
                    // name, and clicking the first label would pick the wrong one.
                    for (var di = 0; di < nodes.length && !picked; di++) {
                        var obj = null;
                        try { obj = jq(nodes[di]).data('ttSelectableObject'); } catch (e) {}
                        if (obj && datum && obj.id != null && String(obj.id) === String(datum.id)) { nodes[di].click(); picked = true; }
                    }
                    for (var si = 0; si < nodes.length && !picked; si++) {
                        var label = norm((nodes[si].innerText || '').replace(/\s+/g, ' ').trim());
                        var codeHit = wantCodes.some(function(cd) { return cd && label.indexOf(cd) >= 0; });
                        if (label && ((wanted && (label === wanted || label.indexOf(wanted) === 0)) || (!wanted && codeHit))) {
                            nodes[si].click();
                            picked = true;
                            break;
                        }
                    }
                } catch(e) {}
                if (!picked) {
                    jq(inp).trigger('typeahead:select', [datum]);
                    jq(inp).trigger('typeahead:selected', [datum, dataset.name || '']);
                }
                // Report "found" only once a line is really there. A fixed 1.2s wait
                // said "found" for a row that never filled, and the caller saved.
                // Invoice picks run two lookups in a row, so give it room.
                // Remember what the page itself learned about stock for this pick —
                // passively, from its own barcode lookup. An INVOICE won't add a line
                // it has no stock for (the hidden #allowNegativeStock is "1" when
                // negative stock is NOT allowed); the page says so in a toast that a
                // background tab never shows. Without this, "no row" had no reason.
                if (!window.__vasyStockHooked && jq(document).ajaxSuccess) {
                    window.__vasyStockHooked = true;
                    jq(document).ajaxSuccess(function (ev, xhr, st) {
                        if (!st || !/\/product\/sales\/barcode\/json/.test(st.url || '')) return;
                        try {
                            var j = JSON.parse(xhr.responseText || '{}'), rr = (j.response || [])[0] || {};
                            window.__vasyLastStock = { qty: parseFloat(rr.availableQty), variant: rr.varientName || '',
                                                       name: (rr.productVo && rr.productVo.name) || '' };
                        } catch (x) {}
                    });
                }
                window.__vasyLastStock = null;
                var gridKnown = document.querySelector('input[id^="itemcode"]') !== null;
                var tEnd = Date.now() + 12000, tPick = Date.now();
                var negBlocked = function () { var e = document.getElementById('allowNegativeStock'); return !!(e && e.value === '1'); };
                await sleep(600);
                while (gridKnown && filledRows() <= before && Date.now() < tEnd) {
                    // The page's own stock lookup already said "none" and selling below
                    // zero is off — no row is coming; don't sit out the full 12 s.
                    var s0 = window.__vasyLastStock;
                    if (s0 && isFinite(s0.qty) && s0.qty <= 0 && negBlocked() && Date.now() - tPick > 2500) break;
                    await sleep(250);
                }
                if (gridKnown && filledRows() <= before) {
                    var st = window.__vasyLastStock, negEl = document.getElementById('allowNegativeStock');
                    return finish('norow:' + (nm(datum) || query) + '|' + (st && isFinite(st.qty) ? st.qty : '') +
                                  '|' + (negEl ? (negEl.value === '1' ? 'blocked' : 'allowed') : ''));
                }
                await sleep(300);
                applyRowValues(qty, price, discount);
                await sleep(150);
                finish('found:' + (nm(datum) || query));
            } catch(err) {
                finish('error:' + (err && err.message ? err.message : 'unknown'));
            }
        })();
    });
})();
