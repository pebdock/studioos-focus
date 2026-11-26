#!/usr/bin/env python3
"""Check presentation/rollout source contracts against a Git ref. No dependencies.

Run from any directory: python tests/ui_parity.py --base origin/main
Git's clean filter is used for byte comparisons so checkout CRLF conversion
cannot look like a JavaScript edit. The authorized worker cache VERSION and
the two explicitly approved aesthetic cache assets may differ. The reviewed
pure lensMap function in liquid.js is pinned by SHA256; its decoded pixels
are checked separately by the browser runner. This checks source parity, not every runtime
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
LENS_MAP_BLOCK = re.compile(r"^  function lensMap\(\)\{[\s\S]*?(?=^  function installRefraction\(\)\{)", re.M)
APPROVED_LENS_MAP_SHA256 = "8dafb444eb45d0f0d2e038e618dafc0ff5532807b8b503de7d644440c367e808"
# Reviewed additive Intelligence module; all original script/hook contracts remain enforced.
INTELLIGENCE_MODULE = "intelligence/focus.js"
INTELLIGENCE_SHA256 = "ee3a7759a45f2ab8a630d8ae19a70f91f613df51f7250234f20244ec0721f71c"
INTELLIGENCE_IDS = {"intelligenceFocus", "intPrivate", "intFresh", "intMetrics", "intMessages"}


# Exact reviewed Git blob pairs for UI-only changes.
# Any future change to these scripts needs a new review; runtime logic remains protected.
FIVE_EXAMS_UI_BLOBS = {
    "app.js": ("6dfd0e0f410c26f234c13abb9647b4cf7ecae657", "3194d53254182d6d9282be4f2182b295248ce456"),
    "learning-ui.js": ("0fc061a0d4eaf9fdee6c248178b3aac677453dcc", "be355196165c041b5911066d07fee4bc59ac077e"),
    "prerequisites.js": ("f5be6d859eaa796dabceb180d416bc50b6d819b2", "94886f2227c1bc6fdbc59956bac01150d300314e"),
}

def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def normalized(value):
    return value.replace("\r\n", "\n")


def cache_version_only(before, after):
    """Only the cache identifier and the two approved aesthetic assets may change."""
    pattern = r'^const VERSION = "studioos-focus-[0-9]{12}";$'
    old, old_count = re.subn(pattern, 'const VERSION = "CACHE_VERSION";', before, flags=re.M)
    new, new_count = re.subn(pattern, 'const VERSION = "CACHE_VERSION";', after, flags=re.M)
    core_pattern = r'^const CORE = (\[[\s\S]*?\]);$'
    old_core, new_core = re.search(core_pattern, old, re.M), re.search(core_pattern, new, re.M)
    if old_count != 1 or new_count != 1 or not old_core or not new_core:
        return False
    try:
        original, candidate = json.loads(old_core[1]), json.loads(new_core[1])
    except (json.JSONDecodeError, TypeError):
        return False
    approved = {"./tokens.css", "./ui-glass-effects.js", "./" + INTELLIGENCE_MODULE}
    additions = [name for name in candidate if name not in original]
    if len(candidate) != len(set(candidate)) or not set(additions) <= approved:
        return False
    if [name for name in candidate if name in original] != original:
        return False
    return re.sub(core_pattern, 'const CORE = APPROVED_ASSETS;', old, flags=re.M) == re.sub(core_pattern, 'const CORE = APPROVED_ASSETS;', new, flags=re.M)


def lens_map_only(before, after):
    """The reviewed pure canvas optimization is the only permitted legacy UI edit."""
    old, new = list(LENS_MAP_BLOCK.finditer(before)), list(LENS_MAP_BLOCK.finditer(after))
    if len(old) != 1 or len(new) != 1:
        return False
    if hashlib.sha256(new[0][0].encode("utf-8")).hexdigest() != APPROVED_LENS_MAP_SHA256:
        return False
    return LENS_MAP_BLOCK.sub("APPROVED_PURE_LENS_MAP\n", before) == LENS_MAP_BLOCK.sub("APPROVED_PURE_LENS_MAP\n", after)


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
    errors.extend(f"{filename}: new id must use ui-glass- namespace: {key}" for key in sorted(new_ids) if not key.startswith("ui-glass-") and key != "pwaTop" and not (filename == "index.html" and key in INTELLIGENCE_IDS))
    if "pwaTop" in new_ids:
        skeleton = [(tag, attrs) for tag, attrs in new.nodes if attrs.get("id") == "pwaTop"]
        empty = re.search(r'''<div\b[^>]*\bid=["']pwaTop["'][^>]*>\s*</div>''', after)
        if filename != "index.html" or skeleton != [("div", {"id": "pwaTop", "class": "pwatop"})] or not empty:
            errors.append(f"{filename}: pwaTop may only predeclare the existing empty adapter banner hook")

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
        if filename == "index.html" and src == INTELLIGENCE_MODULE:
            if any(x["attrs"].get("src") == INTELLIGENCE_MODULE for x in old.scripts):
                prior_scripts.append(item)
            continue
        if src and Path(src.split("?", 1)[0]).name.startswith("ui-glass-"):
            continue
        if not src and item["attrs"].get("id") == "ui-glass-controls" and "ui-glass-controls" not in original_inline_ids:
            added_inline.append(item)
            if VISUAL_FORBIDDEN.search(item["text"]):
                errors.append(f"{filename}: visual inline block touches storage, network, or routing")
            continue
        prior_scripts.append(item)
    if old.scripts != prior_scripts:
        # Verify original <script> bytes, not parser's irrelevant surrounding state.
        raw_scripts = lambda source: re.findall(r"<script\\b[^>]*>[\\s\\S]*?</script\\s*>", source, re.I)
        if raw_scripts(before) != raw_scripts(after):
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
        presentation_only = name == "liquid.js" and lens_map_only(
            normalized(git("show", f"{sha}:{name}").decode("utf-8")),
            normalized(path.read_text(encoding="utf-8")),
        ) and old_hash != new_hash
        reviewed_ui_only = (old_hash, new_hash) == FIVE_EXAMS_UI_BLOBS.get(name)
        if old_hash != new_hash and not metadata_only and not presentation_only and not reviewed_ui_only:
            errors.append(f"Protected runtime changed: {name}")
        protected.append({"path": name, "git_blob": old_hash, "unchanged": old_hash == new_hash, "cache_version_only": metadata_only, "presentation_lens_map_only": presentation_only})
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

    # Exact reviewed additive read-only module; no broad waiver of protected code.
    if (ROOT / INTELLIGENCE_MODULE).is_file():
        if hashlib.sha256((ROOT / INTELLIGENCE_MODULE).read_bytes()).hexdigest() != INTELLIGENCE_SHA256:
            errors.append("Intelligence module differs from reviewed SHA256")
        m = Markup((ROOT / "index.html").read_text(encoding="utf-8"))
        if sum(x["attrs"].get("src") == INTELLIGENCE_MODULE for x in m.scripts) != 1:
            errors.append("Intelligence module must be loaded exactly once")
        if not INTELLIGENCE_IDS <= {a.get("id") for _, a in m.nodes}:
            errors.append("Intelligence hooks missing")
    # A new visual-only module must not create a second application data path.
    # New test scripts are deliberately outside this check.
    added_scripts = [p for p in ROOT.glob("*.js") if p.name not in paths]
    for path in added_scripts:
        if path.name != "ui-glass-effects.js":
            errors.append(f"New production script is not an approved aesthetic asset: {path.name}")
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
