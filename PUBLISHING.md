# Publishing this repository from VS Code

Follow these steps once to put everything on GitHub, set it so only you can change it, and switch on the website. After that, use **Updating later**.

---

## 1. Open the folder in VS Code

1. **File → Open Folder…** and choose `D:\Vasy AI\Vasy-AI-Agent-GitHub`.
2. If VS Code asks *"Do you trust the authors of the files in this folder?"*, choose **Yes**.

## 2. Publish to GitHub (one click)

1. Open **Source Control** in the left bar, or press `Ctrl+Shift+G`.
2. Click **Publish to GitHub**.
   - If you only see **Initialize Repository**, click it first, then **Publish Branch**.
3. VS Code asks for the repository name and visibility:
   - Name: `vasy-ai-agent` (or any name you like)
   - Choose **Publish to GitHub public repository**.
4. If it asks which files to include, **keep all of them ticked**.
5. If GitHub warns that `media/video/Vasy-AI-Agent-Ad-16x9.mp4` is larger than 50 MB, that's only a warning: GitHub accepts files up to 100 MB. Let it continue.

When it finishes, VS Code shows **Open on GitHub**. Click it to see your repo.

> **First commit message:** if VS Code asks, use `Vasy AI Agent v17.3.0 — first public release`.

## 3. Make sure only you can change it

On github.com, open your repo and go to **Settings**:

| Where | What to set | Why |
|---|---|---|
| **Collaborators** | Add nobody | Only you can push |
| **Rules → Rulesets → New branch ruleset** | Target `main`; tick **Restrict deletions** and **Block force pushes** | Nobody (not even a mistake) can wipe the history |
| **General → Features** | Untick **Wikis** and **Projects**; keep **Issues** if you want feedback | Fewer places others can write |
| **General → Pull Requests** | Optional: untick **Allow merge commits** etc. | You decide every change anyway |

Other people can still **view** and **fork** a public repo; GitHub always allows that. The `LICENSE` file is what forbids copying, modifying or redistributing it without your written permission.

## 4. Turn on the website (GitHub Pages)

1. **Settings → Pages**.
2. **Source:** *Deploy from a branch*. **Branch:** `main`, folder `/ (root)`. Click **Save**.
3. After about a minute, your site is live at `https://<your-username>.github.io/vasy-ai-agent/`.
   It is `index.html`: the product page with the film playing and a **Download** button.
4. Back on the repo's main page, click the ⚙ next to **About**, then:
   - **Website:** paste the Pages link and tick *Use your GitHub Pages website*
   - **Description:** `Free AI agent for VasyERP — type it, Vasy does the clicking. No API key, runs in your browser.`
   - **Topics:** `vasyerp`, `chrome-extension`, `ai-agent`, `erp`, `automation`, `hinglish`

## 5. Create the release (the download people install)

1. On the repo page, go to **Releases → Draft a new release**.
2. **Choose a tag:** type `v17.3.0` and press *Create new tag*.
3. **Title:** `Vasy AI Agent v17.3.0`
4. **Description:** paste the *v17.3.0* section from `CHANGELOG.md`.
5. **Attach files:** drag in `release/Vasy-AI-Agent-v17.3.0.zip`, `media/video/Vasy-AI-Agent-Ad-16x9.mp4`, `media/video/Vasy-AI-Agent-Ad-9x16.mp4` and `CHECKSUMS.sha256`.
6. Click **Publish release**.

## 6. Share it

Captions, titles and hashtags for YouTube, Instagram, LinkedIn and WhatsApp are in [`marketing/AD-COPY.md`](marketing/AD-COPY.md). The poster images in `media/images/` work as thumbnails.

---

## Updating later

1. Put the new files in place:
   - extension source → `extension/`
   - new build → `release/` (rename it to the new version)
   - new films or images → `media/`
2. Recompute the checksums by running this in the VS Code terminal (``Ctrl+` ``):

   ```powershell
   Get-ChildItem release\*.zip, media\video\*.mp4, media\images\*.jpg | Get-FileHash -Algorithm SHA256 | ForEach-Object { "{0}  {1}" -f $_.Hash.ToLower(), (Resolve-Path -Relative $_.Path).TrimStart('.\').Replace('\','/') } | Set-Content -Encoding ascii CHECKSUMS.sha256
   ```

3. Update the download links in `index.html` and `README.md` if the version changed, and add a section to `CHANGELOG.md`.
4. In **Source Control**:
   - type a message (e.g. `v17.4.0 — …`);
   - click **Commit**;
   - click **Sync Changes**.
5. Draft a new release with the new tag, as in step 5.

## Checking a download (for you or your users)

```powershell
Get-FileHash .\Vasy-AI-Agent-v17.3.0.zip -Algorithm SHA256
```

The hash must match the line for that file in `CHECKSUMS.sha256`. If it doesn't, the file isn't your official build.

## Never commit

- Passwords, API keys, cookies, or anything from a logged-in browser profile
- VasyERP's own manuals or internal documents
- Real customer data or screenshots of a live (non-test) account

`.gitignore` already blocks the usual OS and editor junk.
