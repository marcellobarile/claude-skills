---
name: sync-skills
description: Sync Claude Code skills from GitHub repos. Use when user invokes /sync-skills, /sync-skills add, /sync-skills remove, /sync-skills scan, or asks to manage or set up skill syncing.
---

# sync-skills

Sync Claude Code skills from GitHub repos using the `gh` CLI. Reads `~/.claude/skill-sync.yml` and fetches each tracked skill into `~/.claude/skills/`.

## Step 0 — Precondition Checks

Run **only during Interview Mode** (first-time setup). On subsequent operations, let `gh`/`git` fail naturally — their error output is self-explanatory.

```bash
gh --version
```
If command not found: output `Error: gh CLI not found. Install at https://cli.github.com` and stop.

```bash
gh auth status
```
If not authenticated: output `Error: not authenticated with GitHub. Run: gh auth login` and stop.

```bash
git --version
```
If command not found: output `Error: git not found. Change detection requires git. Install git and retry.` and stop.

## Manifest Format

Location: `~/.claude/skill-sync.yml`

```yaml
skills:
  - repo: myorg/myrepo                    # GitHub owner/repo (required)
    path: tools/claude/skills/my-skill    # path inside repo — file or directory (required)
    ref: main                             # branch/tag/sha (optional, default: main)
    name: my-skill                        # local name override (optional)
```

**Name resolution when `name` is omitted:**
- `path` is a directory → last segment: `a/b/my-skill` → `my-skill`
- `path` is a file → parent directory: `a/b/my-skill/SKILL.md` → `my-skill`

Local destination: `~/.claude/skills/<name>/`

## Commands

### Default — `/sync-skills`

1. Check if `~/.claude/skill-sync.yml` exists
   - Missing → run Interview Mode, then sync
   - Present but malformed → show YAML parse error with line number, stop
3. For each skill entry: run Fetch Skill
4. Print Sync Report

### `/sync-skills list`

1. Load `~/.claude/skill-sync.yml`; if missing: "No manifest found. Run /sync-skills to create one."
2. For each entry, print one line:
   ```
   <name>  <repo>  <path>  [ref: <ref>]
   ```
3. Print total: `N skill(s) tracked`

### `/sync-skills add`

1. Load `~/.claude/skill-sync.yml`; if missing, create empty file and inform user: "Creating new manifest at ~/.claude/skill-sync.yml" (do not run Interview Mode — add is explicit, no guided setup needed)
3. Ask: "GitHub URL or repo? (paste a GitHub URL like `https://github.com/owner/repo/tree/ref/path`, or enter `owner/repo`)"
   - **If input is a full GitHub URL** matching `https://github.com/{owner}/{repo}/tree/{ref}/{path}`:
     - Extract `repo = {owner}/{repo}`, `ref = {ref}`, `path = {path}`
     - Show: "Parsed → repo: `{repo}`, ref: `{ref}`, path: `{path}`"
     - Skip steps 4 and 5 (already derived)
   - **If input matches `owner/repo`** (one slash, no URL scheme): proceed to steps 4 and 5
   - **If invalid**: prompt again: "Expected a GitHub URL or owner/repo (e.g. myorg/myrepo)"
4. *(Only if not derived from URL)* Ask: "Path to skill in repo (file or directory)?"
5. *(Only if not derived from URL)* Ask: "Which ref (branch, tag, or sha)?" — if the user expresses indifference or says anything meaning "default", use `main`
6. Ask: "Local name for this skill?" — if the user expresses indifference or says anything meaning "default", derive from path
7. Show entry as YAML, ask: "Add this? (yes/no)"
8. If yes: append entry to `~/.claude/skill-sync.yml`, then run Fetch Skill for this entry, print result

### `/sync-skills remove <name>`

1. Load `~/.claude/skill-sync.yml`; if missing: "No manifest found at ~/.claude/skill-sync.yml"
2. Find entry whose resolved name matches `<name>`; if none: "No skill named '<name>' in manifest"
3. Ask: "Also delete local files at `~/.claude/skills/<name>/`? (yes/no)"
4. Remove entry from manifest YAML, write file
5. If yes: `rm -rf ~/.claude/skills/<name>/`
6. Confirm: "Removed `<name>` from tracking" (append " and deleted local files" if applicable)

### `/sync-skills scan`

1. Load `~/.claude/skill-sync.yml`; if missing: "No manifest found"
2. For each entry, check: `test -d ~/.claude/skills/<name>/`
3. Collect entries where directory is absent
4. If none: "No orphaned entries found"
5. If found: remove those entries from manifest YAML, write file, print Scan Report

## Interview Mode

Triggered by `/sync-skills` when `~/.claude/skill-sync.yml` does not exist. Goal: guide user to build the manifest from scratch, optionally importing existing local skills.

### Step I1 — Run precondition checks (Step 0)

### Step I2 — Scan for existing local skills

```bash
ls ~/.claude/skills/
```

Collect subdirectory names, exclude: `anthropic-skills` (system-managed built-ins) and `sync-skills` (this skill itself).

If any found, ask: "I found these existing local skills: [list]. Which ones do you want to track?" — if the user expresses indifference or says anything meaning "none" or "skip", track none.

For each name the user enters:
- Ask: "GitHub URL or repo for `<name>`? (paste a GitHub URL like `https://github.com/owner/repo/tree/ref/path`, or enter `owner/repo`)"
  - **If full GitHub URL**: extract repo, ref, path from it; skip the next two questions for this entry
  - **If `owner/repo`** format: proceed to ask path and ref
  - **If invalid**: re-prompt with: "Expected a GitHub URL or owner/repo (e.g. myorg/myrepo)"
- *(Only if not derived from URL)* Ask: "Path in that repo (file or directory)?"
- *(Only if not derived from URL)* Ask: "Which ref (branch, tag, or sha)?" — if the user expresses indifference, use `main`
- Add entry to manifest list

### Step I3 — Add new skills loop

Ask: "Any other skill to add? Paste a GitHub URL or `owner/repo`." — if the user says anything meaning "no", "done", or "that's it", exit the loop and proceed to Step I4.

If user enters a URL or repo:
- **If full GitHub URL**: extract repo, ref, path; skip path/ref questions
- **If `owner/repo`** format:
  - Ask: "Path in that repo (file or directory)?"
  - Ask: "Which ref (branch, tag, or sha)?" — if the user expresses indifference, use `main`
- Ask: "Local name for this skill?" — if the user expresses indifference, derive from path
- Add entry to manifest list
- Repeat loop

### Step I4 — Confirm and write

Show YAML preview:
```yaml
skills:
  - repo: ...
    path: ...
    ...
```

Ask: "Create `~/.claude/skill-sync.yml` with this content? (yes/no)"

If yes: write file, then proceed to sync all entries.
If no: "Cancelled. Run /sync-skills again when ready."

## Fetch Skill

Fetches one skill entry (`repo`, `path`, `ref`, `name`) from GitHub and writes it to `~/.claude/skills/<name>/`.

### Step F1 — Inspect path

```bash
gh api repos/{repo}/contents/{path}?ref={ref}
```

Interpret response:
- JSON **object** with `"type": "file"` → single file. Build `file_list = [{full_path: path, sha: .sha, content: .content}]`
- JSON **array** → directory. Collect all items where `type == "file"` into `file_list`. For items where `type == "dir"`, call `gh api repos/{repo}/contents/{item.path}?ref={ref}` recursively and add results to `file_list`.
- HTTP 404 or error → record `✗ <name>: repo or path not found`, skip this skill.

### Step F2 — Detect OS for base64 decode

```bash
uname -s
```
- `Darwin` → macOS → use `base64 -D` for decode
- `Linux` → use `base64 -d` for decode
- Any other → use python3 fallback: `python3 -c 'import base64,sys; sys.stdout.buffer.write(base64.b64decode(sys.stdin.read()))'`

### Step F3 — For each file in file_list

Compute `relative_path`:
- If `{path}` is a **directory**: strip the `{path}/` prefix from `file.full_path`
- If `{path}` is a **file**: use the basename of `{path}` (e.g., `tools/skills/my-skill/SKILL.md` → `SKILL.md`)

If `{path}` is a file and its basename is not `SKILL.md`, warn: "Warning: file is not named SKILL.md — Claude Code may not auto-load this as a skill." Then continue.

**Change detection:**
```bash
local_sha=$(git hash-object ~/.claude/skills/{name}/{relative_path} 2>/dev/null || echo "")
```
If `local_sha == file.sha` → mark this file as **unchanged**, skip the write.

**Write file:**
```bash
mkdir -p "$(dirname ~/.claude/skills/{name}/{relative_path})"
b64content='{file.content}'
# macOS:
printf '%s' "$b64content" | base64 -D > ~/.claude/skills/{name}/{relative_path}
# Linux:
printf '%s' "$b64content" | base64 -d > ~/.claude/skills/{name}/{relative_path}
```

Note: `file.content` from GitHub API contains embedded newlines in the base64 string. Assigning to a variable first and using `printf '%s' "$b64content"` handles this correctly; `base64` ignores whitespace during decode.

**Track result per skill:**
- Any file written → skill result = `updated`
- All files unchanged → skill result = `unchanged`
- Any error during write → skill result = `failed` with error detail

## Sync Report

Print after every sync operation:

```
Synced N skills:
  ✓ updated    skill-a
  = unchanged  skill-b
  ✗ failed     skill-c  (repo or path not found)
```

## Scan Report

```
Scan found N orphaned entries (local dir missing):
  - old-skill  → removed from skill-sync.yml
```
