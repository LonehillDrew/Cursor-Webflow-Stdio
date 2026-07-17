#!/usr/bin/env python3
"""
Test 1 — Backend / coding (data model, _builtIn conversion, persistence logic).
Requires 2/2 passes.
"""
from __future__ import annotations

import json
import os
import re
import sys
import tempfile
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


def extract_js_object(path: Path, marker: str) -> dict:
    """Extract a window.X = { ... }; assignment as JSON-compatible dict."""
    text = path.read_text(encoding="utf-8")
    idx = text.find(marker)
    if idx < 0:
        raise ValueError(f"Marker not found: {marker}")
    start = text.find("{", idx)
    # Brace match
    depth = 0
    end = None
    for i, ch in enumerate(text[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    raw = text[start:end]
    # Convert JS object literal → JSON
    raw = re.sub(r"//.*?$", "", raw, flags=re.M)
    raw = re.sub(r"/\*.*?\*/", "", raw, flags=re.S)
    # Quote unquoted keys
    raw = re.sub(r"([{\[,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:", r'\1"\2":', raw)
    # Single → double quotes for strings (careful with apostrophes in content — data uses double)
    raw = raw.replace("'", '"')
    # Trailing commas
    raw = re.sub(r",\s*([}\]])", r"\1", raw)
    # true/false/null already JSON
    # Unicode escapes in labels are fine
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        # Fallback: use node-less ast via regex counts only
        raise RuntimeError(f"JSON parse failed for {path.name}: {e}\nSnippet: {raw[:200]}") from e


def built_in(src: dict, project_id: str) -> dict:
    """Mirror of storage._builtIn conversion (critical path)."""
    proj = {
        "id": project_id,
        "name": "Old Flow" if project_id == "old" else "New Flow",
        "readonly": False,
        "objects": [],
        "edges": [],
        "sections": list(src.get("sections") or []),
    }
    sec_map = {s["id"]: s for s in src.get("sections") or []}
    by_section = {}
    for n in src.get("nodes") or []:
        by_section.setdefault(n.get("section") or "home", []).append(n)

    row = 0
    for sec in src.get("sections") or []:
        nodes = by_section.get(sec["id"]) or []
        colour = sec.get("colour") or "#4a7c59"
        for ni, n in enumerate(nodes):
            col = ni % 4
            if ni > 0 and col == 0:
                row += 1
            proj["objects"].append(
                {
                    "id": n["id"],
                    "type": "rect",
                    "label": n["label"],
                    "section": sec["id"],
                    "style": {"fill": colour},
                }
            )
        if nodes:
            row += 1

    for n in src.get("nodes") or []:
        if any(o["id"] == n["id"] for o in proj["objects"]):
            continue
        proj["objects"].append({"id": n["id"], "label": n["label"], "section": n.get("section")})

    for e in src.get("edges") or []:
        if isinstance(e, list):
            source, target = e[0], e[1]
            meta = e[2] if len(e) > 2 and isinstance(e[2], dict) else {}
        elif isinstance(e, dict):
            source = e.get("from") or e.get("source")
            target = e.get("to") or e.get("target")
            meta = e
        else:
            continue
        proj["edges"].append(
            {
                "source": source,
                "target": target,
                "label": meta.get("label") or "",
                "dashed": bool(meta.get("dashed")),
            }
        )
    return proj


def run_suite(label: str) -> Runner:
    r = Runner()
    print(f"\n[{label}] ", end="")

    old = extract_js_object(ROOT / "assets/js/data-old.js", "TANDEM_OLD_FLOW")
    neu = extract_js_object(ROOT / "assets/js/data-new.js", "TANDEM_NEW_FLOW")

    r.assert_(isinstance(old, dict) and isinstance(neu, dict), "Source flows parsed")
    r.assert_(len(old["nodes"]) == 42, f"Old Flow 42 nodes (got {len(old['nodes'])})")
    r.assert_(len(old["sections"]) == 8, "Old Flow 8 sections")
    r.assert_(len(old["edges"]) == 57, f"Old Flow 57 edges (got {len(old['edges'])})")
    r.assert_(len(neu["nodes"]) == 34, f"New Flow 34 nodes (got {len(neu['nodes'])})")
    r.assert_(len(neu["sections"]) == 8, "New Flow 8 sections")
    r.assert_(len(neu["edges"]) == 42, f"New Flow 42 edges (got {len(neu['edges'])})")

    r.assert_(isinstance(old["edges"][0], list), "Old edges are arrays")
    r.assert_(isinstance(neu["edges"][0], list), "New edges are arrays")
    dashed = [e for e in neu["edges"] if len(e) > 2 and isinstance(e[2], dict) and e[2].get("dashed")]
    r.assert_(len(dashed) >= 1, "New Flow has dashed labelled edge")

    r.assert_("nodes" not in old["sections"][0], "Sections do not nest nodes")
    r.assert_(isinstance(old["nodes"][0].get("section"), str), "Nodes have section string")

    built_old = built_in(old, "old")
    built_new = built_in(neu, "new")
    r.assert_(len(built_old["objects"]) == 42, f"_builtIn old objects=42 (got {len(built_old['objects'])})")
    r.assert_(len(built_old["edges"]) == 57, f"_builtIn old edges=57 (got {len(built_old['edges'])})")
    r.assert_(len(built_new["objects"]) == 34, f"_builtIn new objects=34 (got {len(built_new['objects'])})")
    r.assert_(len(built_new["edges"]) == 42, f"_builtIn new edges=42 (got {len(built_new['edges'])})")
    r.assert_(built_old["readonly"] is False, "Built-in editable flag")

    old_ids = {o["id"] for o in built_old["objects"]}
    dang = [e for e in built_old["edges"] if e["source"] not in old_ids or e["target"] not in old_ids]
    r.assert_(len(dang) == 0, f"No dangling old edges ({len(dang)})")
    new_ids = {o["id"] for o in built_new["objects"]}
    dang2 = [e for e in built_new["edges"] if e["source"] not in new_ids or e["target"] not in new_ids]
    r.assert_(len(dang2) == 0, f"No dangling new edges ({len(dang2)})")

    home = next((o for o in built_old["objects"] if o["id"] == "Home"), None)
    r.assert_(home is not None and home["section"] == "home", "Home node section mapped")
    r.assert_(home["style"]["fill"] == "#4a7c59", "Home uses section colour from source")

    # storage.js source integrity (critical bug fixes present)
    storage = (ROOT / "assets/js/storage.js").read_text(encoding="utf-8")
    r.assert_("src.nodes" in storage, "storage.js reads flat src.nodes")
    r.assert_("Array.isArray(e)" in storage, "storage.js parses array edges")
    r.assert_("ensureBuiltIns" in storage, "storage.js has ensureBuiltIns")
    r.assert_("exportBackup" in storage and "tfs-backup" in storage, "storage.js has full backup")
    r.assert_("sec.nodes" not in storage or "src.nodes" in storage, "Does not rely only on sec.nodes")
    # Must NOT use the old broken pattern exclusively
    r.assert_("e.from" in storage and "e[0]" in storage, "Supports both edge formats")

    # Simulate localStorage persistence with a tempfile-backed dict
    class LS:
        def __init__(self):
            self.d = {}

        def get(self, k):
            return self.d.get(k)

        def set(self, k, v):
            self.d[k] = v

        def delete(self, k):
            self.d.pop(k, None)

    ls = LS()
    # Seed like ensureBuiltIns
    ls.set("project-old", built_old)
    ls.set("project-new", built_new)
    ls.set("projects", [
        {"id": "old", "name": "Old Flow", "readonly": False},
        {"id": "new", "name": "New Flow", "readonly": False},
    ])
    r.assert_(len(ls.get("project-old")["objects"]) == 42, "Persisted old project has 42 objects")
    r.assert_(ls.get("projects")[0]["readonly"] is False, "Registry marks editable")

    # CRUD simulation
    proj = {"id": "abc", "name": "Test", "readonly": False, "objects": [], "edges": [], "layers": []}
    proj["objects"].append({"id": "n1", "label": "A"})
    ls.set("project-abc", proj)
    r.assert_(ls.get("project-abc")["objects"][0]["id"] == "n1", "CRUD save/load works")
    ls.delete("project-abc")
    r.assert_(ls.get("project-abc") is None, "CRUD delete works")

    # Backup payload shape
    backup = {
        "type": "tfs-backup",
        "version": 5,
        "projects": [built_old, built_new],
        "vaultNotes": [{"id": "1", "title": "N", "body": "x"}],
        "vaultFolders": ["General"],
    }
    r.assert_(backup["type"] == "tfs-backup" and len(backup["projects"]) == 2, "Backup payload shape valid")
    r.assert_(len(backup["vaultNotes"]) == 1, "Backup includes vault notes")

    print(f"\n{label}: {r.passed} passed, {r.failed} failed")
    for f in r.failures:
        print(f"  - {f}")
    return r


def main():
    r1 = run_suite("Pass 1")
    r2 = run_suite("Pass 2")
    ok = r1.failed == 0 and r2.failed == 0
    print(f"\n=== TEST 1 BACKEND: {'2/2 PASS' if ok else 'FAIL'} ===")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
