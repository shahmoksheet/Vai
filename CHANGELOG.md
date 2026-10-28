# Changelog

## v17.3.0 — 28 Oct 2026
**Faster and steadier on everyday office PCs**
- **No more random "stuck" replies on 8 GB laptops.** Chrome's on-device model needs about 3.5 GB. Vasy now keeps it loaded only on computers with room to spare. Elsewhere it opens the model when a new wording needs it, and frees it soon after.
- **Balance lookups are much faster.** "How much does X owe" went from up to 52 s to about 6 s, and a repeat question is quicker still.
- **More everyday wordings, no AI needed:**
  - "any notebook1 sitting in the godown", "notebook1 kitna bacha hai"
  - "Sharma Textiles ka kitna baki hai", "Gupta Stores se kitna lena hai", "what is X pending"
  - "X settled his khata with me 900 upi", "X ne 900 diye upi se"
- **Busy-computer safety net.** Vasy keeps its background process alive while a page loads, retries understanding a command once instead of failing, and tells you honestly when the computer is busy.
- **Readable page names.** "POS settings is open" instead of "/setting/pos is open".
- **Built-in flight log** of the last 150 steps, to diagnose any stall.

## v17.2.0 — 23 Oct 2026
- **"See what Vasy learned"** in the toolbar menu, with × to forget a single wording.
- The chat console keeps Chrome's model ready while it's open; Chrome warms it after start-up.
- Forgetting what was learned can no longer be undone by a background restart.

## v17.1.0 — 23 Oct 2026
- **Tab autocomplete** in the chat box: commands, then names from your own history.
- **Chrome's on-device AI** for wordings the rules don't know. It reads the sentence, shows how it understood it, and asks before anything that writes.
- **Self-learning:** wordings that worked are remembered and answered instantly.
- A live progress line, with a Stop button after 20 s.

## v17.0.0 — 22 Oct 2026
- **No cloud AI, no API key.** Everything is understood inside the browser.
- Open any of the 77 VasyERP modules by name.
- Production runs and recipes; the Business Health Index.
- Adapted to VasyERP 9.14.0.

## v16.x — October 2026
- POS scan and taps, return documents, edit and delete with confirmation.
- Party balances, stock lookups, and opening or printing a document by its number.
- Several items in one sentence; Hinglish sentence shapes.

## v15.0 — September 2026
- Typo and synonym tolerance ("creat purchse ordr" works).
- 13 languages through Chrome's built-in translator.
- Type-ahead suggestions.
