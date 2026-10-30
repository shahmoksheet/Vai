# Vasy AI Agent for VasyERP

**Type it. Vasy does the clicking.**

Vasy AI Agent is a free Chrome extension that works inside VasyERP. You type, or say, what you need in plain English or Hinglish, and it fills the real VasyERP screens for you: purchase orders, customers, receipts, stock checks, balances, reports and more. It also answers live questions straight from your books.

There's no API key, no credits to buy and no subscription. It all runs in your browser.

[![Watch the 76-second film](media/images/Poster-16x9-reveal.jpg)](media/video/Vasy-AI-Agent-Ad-16x9.mp4)

▶ **[Watch the film (16:9, 76 s)](media/video/Vasy-AI-Agent-Ad-16x9.mp4)** · **[Full walkthrough (3½ min)](../../releases/latest)** · **[Vertical cut for phones (9:16, 36 s)](media/video/Vasy-AI-Agent-Ad-9x16.mp4)** · **[Pitch deck (.pptx)](../../releases/latest)** · **[Download v17.3.1](release/Vasy-AI-Agent-v17.3.1.zip)**

Every shot in the films is the real agent working on a VasyERP test account. Sped-up waits are marked ⏩ on screen.

---

## What it does

| You type | Vasy does |
|---|---|
| `create purchase order for Sharma Textiles 2 Notebook1 at 400` | Opens a new PO, picks the supplier, adds the item and rate, saves it |
| `add customer Anand Stores 98xxxxxxxx` | Fills the contact form and saves the customer |
| `what are the total sales today` / `aaj ka sale kitna hua` | Reads today's sales off your dashboard |
| `how healthy is my business` | Business Health Index, in one line |
| `notebook1 kitna bacha hai` / `stock of PP10955` | Stock on hand, per product |
| `Sharma Textiles ka kitna baki hai` / `how much does Gupta Stores owe` | Customer or supplier balance, with the next step |
| `Gupta Stores ne 600 diye upi se` | Fills the receipt and **waits for your yes** before posting |
| `open bank reconciliation` / `go to items settings` | Opens any of VasyERP's 77 modules by name |
| `print INV/1379` | Opens the document's print or PDF view |

It also covers:
- **Documents:** sales invoices, estimates, sales orders, delivery challans, credit and debit notes, material inward, supplier bills, payments and expenses.
- **Stock:** stock transfers and requests, production runs and recipes.
- **Admin and data:** settings switches, reports, Tally export, and questions to Vina.

**Built to be safe and easy**
- **Your OK first:** anything that moves money or stock is filled in, then held until you reply *yes*.
- **Tab autocomplete:** completes commands and names as you type, and learns from your history.
- **Learns your wording:** when a new phrasing works, it remembers it and answers instantly next time.
- **Your language:** plain English, Hinglish, and 13 languages through Chrome's built-in translator where available. You can also speak commands.
- **Two ways in:** a chat bubble you can drag anywhere (Alt+V), or a side-by-side console window (Alt+Shift+V).

## Private by design

- **No cloud AI.** Commands are understood inside your browser. On supported PCs it can also use Chrome's built-in on-device model. On computers with less memory, it opens that model only when needed and frees it afterwards.
- **No accounts or keys.** The extension talks only to your own VasyERP server. Chat history and learned wordings stay in your browser's local storage. Voice input uses Chrome's speech service.
- **It never types passwords.** It only opens the Change Password page; you type the password yourself.

## Install

1. Download [`release/Vasy-AI-Agent-v17.3.1.zip`](release/Vasy-AI-Agent-v17.3.1.zip) and unzip it. Check it against [`CHECKSUMS.sha256`](CHECKSUMS.sha256) if you like.
2. In Chrome, open `chrome://extensions` and switch on **Developer mode**.
3. Click **Load unpacked** and choose the unzipped folder.
4. Open VasyERP and click the Vasy bubble in the corner, or press **Alt+V**.

## Repository layout

```
.
├── README.md            this page
├── index.html           the product website (GitHub Pages)
├── LICENSE              all rights reserved — read before using anything here
├── CHANGELOG.md         what changed in each version
├── PUBLISHING.md        how this repo is published and updated (VS Code → GitHub)
├── CHECKSUMS.sha256     SHA-256 of every downloadable file
├── extension/           the extension's source, exactly as it ships
│   ├── manifest.json
│   ├── background.js        understanding commands, routing, on-device AI, learning
│   ├── content_agent.js     works the VasyERP screens (forms, lists, lookups)
│   ├── content_bubble.js    the chat bubble
│   ├── vasy_main_helper.js  page-side helper for VasyERP's dropdowns
│   ├── popup.html / popup.js        toolbar menu (AI status, what Vasy learned)
│   ├── console.html / console.js    the side-by-side console
│   ├── landing.html         about, guide and FAQ
│   ├── bubble.css / console.css
│   └── icons/
├── release/             the installable build
├── media/
│   ├── video/           the 16:9 film and the 9:16 vertical cut
│   └── images/          posters and thumbnails
└── marketing/
    └── AD-COPY.md       titles, captions and hashtags for each platform

The 3½-minute walkthrough (117 MB) and the 20-slide pitch deck (161 MB) are larger than GitHub allows in a repository,
so they are attached to the [latest release](../../releases/latest).
```

## License

**All rights reserved. This is not open-source software.** You may view the code and install the official build for your own use. You may not copy, modify or redistribute it, or reuse the videos and images, without written permission. See [LICENSE](LICENSE).

Developed by **Moksheet Shah** · [LinkedIn](https://www.linkedin.com/in/moksheet-shah-14a30a21a/)

<sub>VasyERP is a trademark of its owner. On-device AI and translation use Chrome's built-in models where your PC supports them.</sub>
