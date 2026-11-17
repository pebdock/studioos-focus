#!/usr/bin/env python3
"""Check presentation/rollout source contracts against a Git ref. No dependencies.

Run from any directory: python tests/ui_parity.py --base origin/main
Git's clean filter is used for byte comparisons so checkout CRLF conversion
cannot look like a JavaScript edit. Only the authorized worker cache VERSION
literal may differ. This checks source parity, not every runtime
outcome; the browser checks in docs/QA-INVENTORY.md remain necessary.
"""

import argparse
import base64
from collections import Counter
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
BEHAVIOR = {"id", "role", "name", "type", "for", "href", "src", "value", "min", "max", "step", "required", "disabled", "hidden", "readonly", "multiple", "checked", "selected", "pattern", "maxlength", "autocomplete", "tabindex", "contenteditable", "form", "action", "method"}
VISUAL_FORBIDDEN = re.compile(r"\b(?:localStorage|sessionStorage|fetch|XMLHttpRequest|indexedDB)\b|\b(?:location|history)\s*\.")


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def normalized(value):
    return value.replace("\r\n", "\n")


def cache_version_only(before, after):
    """The authorized rollout may change one cache identifier, never handlers."""
    pattern = r'^const VERSION = "studioos-focus-[0-9]{12}";$'
    old, old_count = re.subn(pattern, 'const VERSION = "CACHE_VERSION";', before, flags=re.M)
    new, new_count = re.subn(pattern, 'const VERSION = "CACHE_VERSION";', after, flags=re.M)
    return old_count == new_count == 1 and old == new


def is_hook(name):
    return name in BEHAVIOR or name == "class" or name.startswith(("data-", "aria-", "on"))


class Markup(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.nodes = []
        self.scripts = []
        self.current_script = None
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.nodes.append((tag, attrs))
        if tag == "script":
            self.current_script = {"attrs": attrs, "text": ""}
            self.scripts.append(self.current_script)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_data(self, data):
        if self.current_script is not None:
            self.current_script["text"] += data

    def handle_endtag(self, tag):
        if tag == "script":
            self.current_script = None


def retains(old, new):
    for key, value in old.items():
        if not is_hook(key):
            continue
        if key == "class":
            if not set((value or "").split()) <= set((new.get(key) or "").split()):
                return False
        elif key not in new or new[key] != value:
            return False
    return True


def check_markup(before, after, filename):
    """Allow moving/wrapping nodes and adding UI classes; retain old hooks."""
    errors = []
    old, new = Markup(before), Markup(after)
    ids = Counter(a["id"] for _, a in new.nodes if "id" in a)
    errors.extend(f"{filename}: duplicate id {key}" for key, count in ids.items() if count > 1)
    old_ids = {a["id"] for _, a in old.nodes if "id" in a}
    new_ids = {key for key in ids if key not in old_ids}
    errors.extend(f"{filename}: new id must use ui-glass- namespace: {key}" for key in sorted(new_ids) if not key.startswith("ui-glass-"))

    available = list(enumerate(new.nodes))
    hook_count = 0
    # Check nodes with IDs first. Then use multiset matching for repeated class
    # hooks without IDs; no assumption about newly added wrapper positions.
    originals = sorted(old.nodes, key=lambda node: "id" not in node[1])
    for tag, attrs in originals:
        if not any(is_hook(key) for key in attrs):
            continue
        hook_count += 1
        match = next((i for i, (_, (nt, na)) in enumerate(available) if nt == tag and retains(attrs, na)), None)
        if match is None:
            identity = attrs.get("id") or attrs.get("class") or str({k: v for k, v in attrs.items() if is_hook(k)})
            errors.append(f"{filename}: removed/changed hook on <{tag}> {identity}")
        else:
            available.pop(match)

    prior_scripts = []
    added_inline = []
    original_inline_ids = {item["attrs"].get("id") for item in old.scripts if not item["attrs"].get("src")}
    for item in new.scripts:
        src = item["attrs"].get("src", "")
        if src and Path(src.split("?", 1)[0]).name.startswith("ui-glass-"):
            continue
        if not src and item["attrs"].get("id") == "ui-glass-controls" and "ui-glass-controls" not in original_inline_ids:
            added_inline.append(item)
            if VISUAL_FORBIDDEN.search(item["text"]):
                errors.append(f"{filename}: visual inline block touches storage, network, or routing")
            continue
        prior_scripts.append(item)
    if old.scripts != prior_scripts:
        errors.append(f"{filename}: original script order, attributes, or inline code changed")

    def policy(markup):
        meta = next((attrs for tag, attrs in markup.nodes if tag == "meta" and attrs.get("http-equiv", "").lower() == "content-security-policy"), None)
        if meta is None:
            return {}
        return {parts[0]: parts[1:] for directive in meta.get("content", "").split(";") if (parts := directive.split())}

    old_policy, new_policy = policy(old), policy(new)
    expected_policy = dict(old_policy)
    hashes = ["'sha256-" + base64.b64encode(hashlib.sha256(item["text"].encode("utf-8")).digest()).decode() + "'" for item in added_inline]
    if hashes:
        expected_policy["script-src"] = old_policy.get("script-src", []) + hashes
    if new_policy != expected_policy:
        errors.append(f"{filename}: CSP must preserve original restrictions and authorize only the exact ui-glass-controls SHA256")
    return errors, {"ids": len(old_ids), "hook_nodes": hook_count, "scripts": len(old.scripts), "new_ui_ids": len(new_ids), "new_inline_ui_blocks": len(added_inline), "inline_csp_sha256": hashes}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="origin/main", help="Git ref to protect (default: origin/main)")
    parser.add_argument("--json", type=Path, help="Optional machine-readable report path")
    args = parser.parse_args()
    sha = git("rev-parse", args.base).decode().strip()
    paths = git("ls-tree", "-r", "--name-only", sha).decode().splitlines()
    app_scripts = [p for p in paths if Path(p).suffix in {".js", ".mjs"} and not p.startswith((".github/", "tests/"))]
    html_files = [p for p in paths if p.endswith(".html")]
    errors = []
    protected = []
    stats = {"production_scripts": len(app_scripts), "html": {}, "literal_selector_calls": 0, "event_bindings": 0, "storage_references": 0}
    for name in app_scripts:
        path = ROOT / name
        old_hash = git("rev-parse", f"{sha}:{name}").decode().strip()
        if not path.is_file():
            errors.append(f"Protected runtime missing: {name}")
            continue
        new_hash = git("hash-object", f"--path={name}", name).decode().strip()
        metadata_only = name == "sw.js" and cache_version_only(
            normalized(git("show", f"{sha}:{name}").decode("utf-8")),
            normalized(path.read_text(encoding="utf-8")),
        ) and old_hash != new_hash
        if old_hash != new_hash and not metadata_only:
            errors.append(f"Protected runtime changed: {name}")
        protected.append({"path": name, "git_blob": old_hash, "unchanged": old_hash == new_hash, "cache_version_only": metadata_only})
        text = path.read_text(encoding="utf-8")
        stats["literal_selector_calls"] += len(re.findall(r"(?:querySelector(?:All)?|getElementById|closest|matches|\$)\(\s*['\"]", text))
        stats["event_bindings"] += len(re.findall(r"\.addEventListener\s*\(|\.on(?:click|change|input|keydown)\s*=", text))
        stats["storage_references"] += len(re.findall(r"\b(?:localStorage|sessionStorage)\b", text))

    for name in html_files:
        if not (ROOT / name).is_file():
            errors.append(f"Original HTML missing: {name}")
            continue
        before = normalized(git("show", f"{sha}:{name}").decode("utf-8"))
        after = normalized((ROOT / name).read_text(encoding="utf-8"))
        found, stat = check_markup(before, after, name)
        errors.extend(found)
        stats["html"][name] = stat

    # A new visual-only module must not create a second application data path.
    # New test scripts are deliberately outside this check.
    added_scripts = [p for p in ROOT.glob("*.js") if p.name not in paths]
    for path in added_scripts:
        if not path.name.startswith("ui-glass-"):
            errors.append(f"New production script needs ui-glass- prefix: {path.name}")
        source = path.read_text(encoding="utf-8")
        if VISUAL_FORBIDDEN.search(source):
            errors.append(f"Visual module touches storage, network, or routing: {path.name}")

    report = {"ok": not errors, "base_ref": args.base, "base_sha": sha, "stats": stats, "protected_scripts": protected, "errors": errors, "limits": "Source contracts only. Dynamic DOM, timer behavior, rendered layout, and authenticated Google sync require browser/integration checks."}
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
