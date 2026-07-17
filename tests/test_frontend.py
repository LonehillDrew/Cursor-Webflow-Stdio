#!/usr/bin/env python3
"""
Test 2 — Frontend UX / working functions (structure, theme, HTTP smoke).
Requires 2/2 passes.
"""
from __future__ import annotations

import http.server
import re
import socketserver
import sys
import threading
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Runner:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.failures = []

    def assert_(self, cond, msg):
        if cond:
            self.passed += 1
            sys.stdout.write(".")
        else:
            self.failed += 1
            self.failures.append(msg)
            sys.stdout.write("F")
        sys.stdout.flush()


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def strip_ui_calls(src: str) -> str:
    src = re.sub(r"TFS\.UI\.prompt\(", "UI_PROMPT(", src)
    src = re.sub(r"TFS\.UI\.confirmDelete\(", "UI_CONFIRM_DEL(", src)
    src = re.sub(r"TFS\.UI\.confirm\(", "UI_CONFIRM(", src)
    src = re.sub(r"TFS\.UI\.alert\(", "UI_ALERT(", src)
    src = re.sub(r"await this\.confirm\(", "UI_CONFIRM(", src)
    src = re.sub(r"this\.confirm\(", "UI_CONFIRM(", src)
    return src


def run_suite(label: str) -> Runner:
    r = Runner()
    print(f"\n[{label}] ", end="")

    index = read("index.html")
    studio = read("studio.html")
    vault = read("vault.html")
    css = read("assets/css/styles.css")
    dash = read("assets/js/dashboard.js")
    studio_js = read("assets/js/studio.js")
    vault_js = read("assets/js/vault.js")
    tools = read("assets/js/tools.js")
    canvas = read("assets/js/canvas.js")
    ui = read("assets/js/ui.js")
    storage = read("assets/js/storage.js")

    r.assert_("Tandem Flow Studio" in index, "index brands Tandem Flow Studio")
    r.assert_("Tandem Flow Studio" in studio, "studio brands Tandem Flow Studio")
    r.assert_("Tandem Flow Studio" in vault, "vault brands Tandem Flow Studio")

    r.assert_('id="hero-cards"' in index, "Dashboard has hero-cards")
    r.assert_('id="project-list"' in index, "Dashboard has project-list")
    r.assert_('id="backup-btn"' in index, "Dashboard has Backup all")
    r.assert_('id="dup-old-btn"' in index and 'id="dup-new-btn"' in index, "Duplicate quick actions")
    r.assert_("ui.js" in index, "index loads ui.js")

    r.assert_('data-tool="rect"' in studio, "Studio has shape tools")
    r.assert_('data-tool="edge"' in studio, "Studio has edge tool")
    r.assert_('data-panel-tab="notes"' in studio, "Studio has Notes tab")
    r.assert_('id="notes-content"' in studio, "Studio has notes-content")
    r.assert_("ui.js" in studio and "canvas.js" in studio and "tools.js" in studio, "studio scripts")

    r.assert_('data-vault-tab="all"' in vault, "Vault All tab")
    r.assert_('data-vault-tab="folders"' in vault, "Vault Folders tab")
    r.assert_('data-vault-tab="tags"' in vault, "Vault Tags tab")
    r.assert_('id="vault-empty"' in vault, "Vault empty state")
    r.assert_('id="export-vault-btn"' in vault, "Vault export button")
    r.assert_("ui.js" in vault, "vault loads ui.js")

    r.assert_("--background-primary: #1a1a2e" in css, "Obsidian primary #1a1a2e")
    r.assert_("--interactive-accent: #4878c6" in css, "Accent #4878c6")
    r.assert_(".hero-card" in css, "hero-card styles")
    r.assert_(".modal-overlay" in css and ".modal-input" in css, "modal styles")
    r.assert_(".vault-tabs" in css, "vault tabs styles")
    r.assert_(".pinned-note" in css, "pinned note styles")

    for name, src in [
        ("dashboard.js", dash),
        ("studio.js", studio_js),
        ("vault.js", vault_js),
        ("tools.js", tools),
        ("storage.js", storage),
    ]:
        stripped = strip_ui_calls(src)
        r.assert_(not re.search(r"\bprompt\s*\(", stripped), f"{name} no native prompt()")
        r.assert_(not re.search(r"\bconfirm\s*\(", stripped), f"{name} no native confirm()")

    r.assert_("TFS.UI" in ui and "prompt(" in ui, "ui.js modal API")
    r.assert_(".filter(" in canvas and "toolName !== 'select'" in canvas, "zoom filter protects tools")
    r.assert_("dblclick.zoom" in canvas, "dblclick zoom disabled")
    r.assert_("setTool('select')" in tools, "tools return to select")

    r.assert_("src.nodes" in storage, "storage flat nodes")
    r.assert_("Array.isArray(e)" in storage, "storage array edges")
    r.assert_("ensureBuiltIns" in storage, "ensureBuiltIns")
    r.assert_("exportBackup" in storage and "tfs-backup" in storage, "full backup")
    r.assert_("_renderNotesPanel" in studio_js and "Pinned notes" in studio_js, "pinned notes panel")

    for v in ["d3.min.js", "marked.min.js", "jspdf.umd.min.js", "html2canvas.min.js"]:
        r.assert_((ROOT / "assets/vendor" / v).exists(), f"vendor/{v}")
    r.assert_("cdn." not in index and "cdn." not in studio, "No CDN")

    for f in [
        "assets/js/data-old.js",
        "assets/js/data-new.js",
        "assets/js/storage.js",
        "assets/js/canvas.js",
        "assets/js/tools.js",
        "assets/js/panels.js",
        "assets/js/studio.js",
        "assets/js/dashboard.js",
        "assets/js/vault.js",
        "assets/js/ui.js",
        "assets/css/styles.css",
        ".github/workflows/static.yml",
    ]:
        r.assert_((ROOT / f).exists(), f"{f} exists")

    # Functional: dashboard render hooks + vault empty CTA
    r.assert_("ensureBuiltIns" in dash and "hero-cards" in dash, "dashboard seeds + heroes")
    r.assert_("exportBackup" in dash or "Backup" in index, "backup wiring")
    r.assert_("No note selected" in vault, "vault empty CTA copy")
    r.assert_("projectStats" in dash, "dashboard shows stats")

    print(f"\n{label}: {r.passed} passed, {r.failed} failed")
    for f in r.failures:
        print(f"  - {f}")
    return r


def http_smoke() -> tuple[bool, int, int]:
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(ROOT), **kwargs)

        def log_message(self, *args):
            pass

    with socketserver.TCPServer(("127.0.0.1", 0), Handler) as httpd:
        port = httpd.server_address[1]
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        paths = [
            "/index.html",
            "/studio.html",
            "/vault.html",
            "/assets/css/styles.css",
            "/assets/js/storage.js",
            "/assets/js/ui.js",
            "/assets/js/data-old.js",
            "/assets/js/dashboard.js",
            "/assets/vendor/d3.min.js",
        ]
        fails = 0
        for p in paths:
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}{p}", timeout=5) as resp:
                    if resp.status != 200:
                        fails += 1
            except Exception:
                fails += 1
        httpd.shutdown()
        return fails == 0, len(paths), fails


def main():
    r1 = run_suite("Pass 1")
    r2 = run_suite("Pass 2")
    ok_http, total, fails = http_smoke()
    print(f"\nHTTP smoke: {'PASS' if ok_http else 'FAIL'} ({total - fails}/{total} assets)")
    all_ok = r1.failed == 0 and r2.failed == 0 and ok_http
    print(f"\n=== TEST 2 FRONTEND: {'2/2 PASS' if all_ok else 'FAIL'} ===")
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
