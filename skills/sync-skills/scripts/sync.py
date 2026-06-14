#!/usr/bin/env python3
"""
sync-skills helper — handles sync (default), list, and scan subcommands.
Usage:
  sync.py          — fetch all skills in skill-sync.yml
  sync.py list     — print tracked skills
  sync.py scan     — remove manifest entries whose local dir is missing
"""

import subprocess, json, os, base64, sys
import re

MANIFEST_PATH = os.path.expanduser("~/.claude/skill-sync.yml")
SKILLS_DIR    = os.path.expanduser("~/.claude/skills")


# ── YAML parser (no deps) ────────────────────────────────────────────────────

def parse_manifest(path):
    if not os.path.exists(path):
        print(f"No manifest found at {path}. Run /sync-skills to create one.")
        sys.exit(1)
    with open(path) as f:
        text = f.read()

    skills = []
    current = None
    for line in text.splitlines():
        if re.match(r"^\s*-\s+repo:", line):
            if current:
                skills.append(current)
            current = {"repo": line.split(":", 1)[1].strip(), "ref": "main", "name": None, "path": None}
        elif current and re.match(r"^\s+path:", line):
            current["path"] = line.split(":", 1)[1].strip()
        elif current and re.match(r"^\s+ref:", line):
            current["ref"] = line.split(":", 1)[1].strip()
        elif current and re.match(r"^\s+name:", line):
            current["name"] = line.split(":", 1)[1].strip()
    if current:
        skills.append(current)

    for s in skills:
        if not s["name"]:
            s["name"] = s["path"].rstrip("/").split("/")[-1] if s["path"] else "unknown"

    return skills


def write_manifest(skills):
    lines = ["skills:"]
    for s in skills:
        lines.append(f"  - repo: {s['repo']}")
        lines.append(f"    path: {s['path']}")
        if s["ref"] != "main":
            lines.append(f"    ref: {s['ref']}")
        lines.append(f"    name: {s['name']}")
    with open(MANIFEST_PATH, "w") as f:
        f.write("\n".join(lines) + "\n")


# ── GitHub helpers ───────────────────────────────────────────────────────────

def gh_api(endpoint):
    r = subprocess.run(["gh", "api", endpoint], capture_output=True, text=True)
    if r.returncode != 0:
        return None, r.stderr.strip()
    return json.loads(r.stdout), None


def collect_files(repo, path, ref):
    data, err = gh_api(f"repos/{repo}/contents/{path}?ref={ref}")
    if err:
        return [], err
    files = []
    if isinstance(data, dict) and data.get("type") == "file":
        files.append(data)
    elif isinstance(data, list):
        for item in data:
            if item["type"] == "file":
                files.append(item)
            elif item["type"] == "dir":
                sub, e = collect_files(repo, item["path"], ref)
                if e:
                    return [], e
                files.extend(sub)
    return files, None


def local_sha(path):
    r = subprocess.run(["git", "hash-object", path], capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else ""


def write_file(dest, b64content):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    raw = base64.b64decode(b64content)
    with open(dest, "wb") as f:
        f.write(raw)


# ── Subcommands ──────────────────────────────────────────────────────────────

def cmd_list(skills):
    print(f"{'NAME':<24} {'REPO':<40} {'PATH':<50} REF")
    print("-" * 120)
    for s in skills:
        print(f"{s['name']:<24} {s['repo']:<40} {s['path']:<50} {s['ref']}")
    print(f"\n{len(skills)} skill(s) tracked")


def cmd_sync(skills):
    results = {}
    for entry in skills:
        repo, path, ref, name = entry["repo"], entry["path"], entry["ref"], entry["name"]
        files, err = collect_files(repo, path, ref)
        if err:
            results[name] = ("failed", f"collect error: {err}")
            continue

        updated = unchanged = failed = 0
        fail_detail = ""
        for f in files:
            rel = f["path"][len(path):].lstrip("/")
            dest = os.path.join(SKILLS_DIR, name, rel)
            if local_sha(dest) == f["sha"]:
                unchanged += 1
                continue
            fdata, ferr = gh_api(f["url"].replace("https://api.github.com/", ""))
            if ferr:
                failed += 1
                fail_detail = ferr
                continue
            try:
                write_file(dest, fdata["content"])
                updated += 1
            except Exception as e:
                failed += 1
                fail_detail = str(e)

        if failed:
            results[name] = ("failed", fail_detail)
        elif updated:
            results[name] = ("updated", f"{updated} file(s) written, {unchanged} unchanged")
        else:
            results[name] = ("unchanged", f"all {unchanged} file(s) up to date")

    print(f"\nSynced {len(skills)} skills:")
    for name, (status, detail) in results.items():
        icon = "✓" if status == "updated" else ("=" if status == "unchanged" else "✗")
        print(f"  {icon} {status:<10} {name}  ({detail})")


def cmd_scan(skills):
    orphaned = [s for s in skills if not os.path.isdir(os.path.join(SKILLS_DIR, s["name"]))]
    if not orphaned:
        print("No orphaned entries found.")
        return
    kept = [s for s in skills if s not in orphaned]
    write_manifest(kept)
    print(f"Scan found {len(orphaned)} orphaned entry(s) (local dir missing):")
    for s in orphaned:
        print(f"  - {s['name']}  → removed from skill-sync.yml")


# ── Entry point ──────────────────────────────────────────────────────────────

def main():
    sub = sys.argv[1] if len(sys.argv) > 1 else ""
    skills = parse_manifest(MANIFEST_PATH)

    if sub == "list":
        cmd_list(skills)
    elif sub == "scan":
        cmd_scan(skills)
    elif sub in ("", "sync"):
        cmd_sync(skills)
    else:
        print(f"Unknown subcommand: {sub}")
        print("Usage: sync.py [list|scan]  (add/remove handled by the model)")
        sys.exit(1)


if __name__ == "__main__":
    main()
