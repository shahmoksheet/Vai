// © 2026 Moksheet Shah. All rights reserved. Shared for viewing only — no copying, modification or redistribution without written permission. See LICENSE.
'use strict';
// popup.js v17.3 — status, on-device AI & learning, console launcher. There is no
// API key: commands are understood inside the browser. Chrome's on-device model is
// optional and is downloaded from HERE because Chrome needs a click on an
// extension page to start that download.

document.getElementById('ver').textContent = 'v' + chrome.runtime.getManifest().version;

const AI_OPTS = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };
const $ = id => document.getElementById(id);
const WORDS = {
    available:    'Chrome’s on-device model is ready. Vasy uses it for wordings its rules don’t know, and asks before acting on what it read.',
    downloadable: 'Chrome can download its on-device model (a one-time download). Vasy works without it too.',
    downloading:  'Chrome is downloading its on-device model…',
    unavailable:  'This computer can’t run Chrome’s on-device model. Vasy keeps working with its own rules.',
};

async function refresh() {
    let s = null;
    try { s = await chrome.runtime.sendMessage({ action: 'ai_status' }); } catch (e) {}
    if (!s) { $('aiStatus').textContent = 'Couldn’t reach Vasy — reload the extension.'; return; }
    $('aiOn').checked = !s.off;
    $('aiOn').disabled = s.ai !== 'available';
    $('aiStatus').textContent = s.off && s.ai === 'available' ? 'Off — Vasy uses its own rules only.' : (WORDS[s.ai] || WORDS.unavailable);
    // The model needs ~3.5 GB while open; on smaller machines it isn't kept loaded
    if (!s.off && s.ai === 'available' && s.keepsWarm === false && s.mem)
        $('aiStatus').textContent += ` This computer has ${Math.round(s.mem.totalGB)} GB of memory, so Vasy opens the model only when a wording needs it and frees it soon after.`;
    $('aiDownload').hidden = !(s.ai === 'downloadable' || s.ai === 'downloading');
    const n = (s.learned && s.learned.examples) || 0;
    $('learnCount').textContent = n ? `Learned ${n} wording${n === 1 ? '' : 's'} from tasks that worked` : 'Nothing learned yet';
    $('learnForget').disabled = !n;
    renderLearned(n);
}

// Each remembered wording and the task it means — remove one without forgetting the rest
async function renderLearned(n) {
    const box = $('learnDetails'), list = $('learnList');
    box.hidden = !n;
    if (!n) { list.textContent = ''; return; }
    let r = null;
    try { r = await chrome.runtime.sendMessage({ action: 'learn_list' }); } catch (e) {}
    list.textContent = '';
    for (const it of (r && r.items) || []) {
        const li = document.createElement('li');
        const s = document.createElement('span');
        s.textContent = `“${it.u}”`;
        const sm = document.createElement('small'); sm.textContent = `${it.task}${it.replay ? ' · answered instantly' : ''}`;
        s.appendChild(sm);
        const x = document.createElement('button'); x.type = 'button'; x.title = 'Forget this one'; x.setAttribute('aria-label', 'Forget this wording'); x.textContent = '×';
        x.addEventListener('click', async () => { try { await chrome.runtime.sendMessage({ action: 'learn_remove', u: it.u }); } catch (e) {} refresh(); });
        li.append(s, x);
        list.appendChild(li);
    }
}

$('aiOn').addEventListener('change', async () => {
    try { await chrome.runtime.sendMessage({ action: 'ai_set', off: !$('aiOn').checked }); } catch (e) {}
    refresh();
});

$('aiDownload').addEventListener('click', async () => {
    const btn = $('aiDownload');
    if (typeof LanguageModel === 'undefined') { $('aiStatus').textContent = WORDS.unavailable; return; }
    btn.disabled = true; btn.textContent = 'Starting the download…';
    try {
        const s = await LanguageModel.create({ ...AI_OPTS, monitor(m) {
            m.addEventListener('downloadprogress', e => { btn.textContent = `Downloading… ${Math.round((e.loaded || 0) * 100)}%`; });
        } });
        s.destroy();
        btn.textContent = 'Ready';
    } catch (e) {
        btn.disabled = false; btn.textContent = 'Turn on on-device AI';
        $('aiStatus').textContent = 'Chrome couldn’t download its model here (' + String(e && e.message || e).slice(0, 80) + '). Vasy keeps working without it.';
        return;
    }
    refresh();
});

$('learnForget').addEventListener('click', async () => {
    const b = $('learnForget');
    if (b.dataset.armed !== '1') {   // confirm in place — no browser dialog
        b.dataset.armed = '1'; b.textContent = 'Sure?';
        setTimeout(() => { b.dataset.armed = ''; b.textContent = 'Forget'; }, 3000);
        return;
    }
    b.dataset.armed = ''; b.textContent = 'Forget';
    try { await chrome.runtime.sendMessage({ action: 'learn_forget' }); } catch (e) {}
    refresh();
});

// Vasy Console — its own window beside the ERP
document.getElementById('openConsoleBtn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'open_console' }).catch(() => {});
    window.close();
});

refresh();
