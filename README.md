# Tandem Flow Studio

Flow-chart creator for Tandem site maps. Static app for GitHub Pages — no build step, no CDN, no API keys.

**App name:** Tandem Flow Studio (formerly Webflow Studio / Webflow-Studio-V1)

## Pages

| Page | Purpose |
|------|---------|
| `index.html` | Dashboard — Old/New Flow hero cards, your charts, backup/restore |
| `studio.html` | Editor — shapes, edges, text, freehand, layers, pinned notes |
| `vault.html` | Notes vault — All / Folders / Tags, Obsidian-style Markdown |

## Quick start

1. Unzip this repo
2. Open `index.html` locally, **or** upload the folder to GitHub and enable Pages
3. Old Flow (42 nodes) and New Flow (34 nodes) seed automatically as **editable** projects

Data is stored in `localStorage`. Use **Backup all** on the dashboard to download a full JSON backup.

## Stack

- Vanilla HTML / CSS / JS
- Vendored: D3, marked, jsPDF, html2canvas (`assets/vendor/`)
- Obsidian-dark theme (`#1a1a2e` primary)

## Tests

```bash
python3 tests/test_backend.py    # Test 1 — data / _builtIn / persistence
python3 tests/test_frontend.py   # Test 2 — UX structure + HTTP smoke
```

Both suites run two passes and require 2/2 PASS.

## Source data

- `assets/js/data-old.js` → `window.TANDEM_OLD_FLOW`
- `assets/js/data-new.js` → `window.TANDEM_NEW_FLOW`
- Mermaid sources in `source-md/`

Nodes are a **flat** array; edges are arrays `["from","to"]` or `["from","to",{dashed,label}]`.

## Licence notes

Obsidian CSS variable names / dark palette patterns adapted from obsidian-maps (MIT).
