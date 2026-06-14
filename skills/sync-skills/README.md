# sync-skills

Manages a manifest of Claude Code skills sourced from GitHub repos and syncs them into `~/.claude/skills/`. Uses the `gh` CLI for all GitHub operations — no tokens to manage manually.

---

## What it does

Reads `~/.claude/skill-sync.yml`, fetches each tracked skill via the GitHub Contents API (through `gh api`), decodes the base64 payload, and writes files to `~/.claude/skills/<name>/`. Change detection via `git hash-object` skips files that haven't changed upstream.

---

## Commands

| Command | What it does |
|---|---|
| `/sync-skills` | Sync all skills in the manifest. First run → Interview Mode if manifest missing. |
| `/sync-skills list` | Print tracked skills from manifest (name, repo, path, ref) |
| `/sync-skills add` | Add a skill to the manifest (interactive). Accepts a full GitHub URL or `owner/repo` |
| `/sync-skills remove <name>` | Remove a skill from the manifest; optionally delete local files |
| `/sync-skills scan` | Remove manifest entries whose local directory is missing |

---

## Manifest format

Location: `~/.claude/skill-sync.yml`

```yaml
skills:
  - repo: myorg/myrepo          # GitHub owner/repo (required)
    path: tools/skills/my-skill # path inside repo — file or directory (required)
    ref: main                   # branch, tag, or SHA (optional, default: main)
    name: my-skill              # local name override (optional)
```

**Name resolution when `name` is omitted:**
- `path` is a directory → last segment: `a/b/my-skill` → `my-skill`
- `path` is a file → parent directory: `a/b/my-skill/SKILL.md` → `my-skill`

**Local destination**: `~/.claude/skills/<name>/`

---

## First-time setup (Interview Mode)

Triggered automatically when `/sync-skills` runs and `~/.claude/skill-sync.yml` doesn't exist:

1. Checks preconditions: `gh` installed, `gh auth status`, `git` installed
2. Scans `~/.claude/skills/` for existing local skills and asks which to track
3. For each: asks GitHub URL or `owner/repo`, path, ref
4. Lets you add additional skills
5. Shows YAML preview and asks for confirmation before writing

---

## Adding a skill

`/sync-skills add` accepts either:
- A full GitHub URL: `https://github.com/owner/repo/tree/ref/path/to/skill` — repo, ref, and path are parsed automatically
- A short form: `owner/repo` — then prompts for path and ref

---

## Sync mechanics

For each manifest entry:

1. `gh api repos/{repo}/contents/{path}?ref={ref}` — resolves whether the path is a file or directory
2. For directories: recurses into subdirs to collect all files
3. Per file: computes `git hash-object` of the local copy; skips write if SHA matches upstream
4. Decodes base64 content from the GitHub API response and writes to disk
5. Handles macOS (`base64 -D`) and Linux (`base64 -d`) decode flags; falls back to Python if neither works

---

## Sync report

After every sync:

```
Synced N skills:
  ✓ updated    skill-a
  = unchanged  skill-b
  ✗ failed     skill-c  (repo or path not found)
```

---

## Preconditions

Required before any operation:
- `gh` CLI installed and authenticated (`gh auth login` if not)
- `git` installed (used for change detection via `git hash-object`)

Precondition checks run automatically during Interview Mode. On subsequent runs, `gh` / `git` error output is considered self-explanatory.

---

## Files

```
sync-skills/
└── SKILL.md    ← full skill definition (commands are described inline)
```

No separate command files or scripts — the entire logic is described in `SKILL.md` and executed by Claude via Bash tool calls.
