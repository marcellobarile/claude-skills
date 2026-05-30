---
allowed-tools: Bash(~/.claude/skills/debug-decisions/.bin/*:*), Bash(mkdir:*), Bash(cat:*), Read, Write, Edit
description: Register an architectural decision for the current project (or --global)
---

## Context

See `~/.claude/skills/debug-decisions/SKILL.md`

User invoked `/decision` with arguments: $ARGUMENTS

Resolve current project slug:
!`~/.claude/skills/debug-decisions/.bin/slug.sh`

Get current git SHA (or null):
!`~/.claude/skills/debug-decisions/.bin/git-sha.sh`

## Your task

Register a new architectural decision following the schema in `~/.claude/skills/debug-decisions/.schema/decision-template.md`.

**Parse `$ARGUMENTS`** for these flags before the free-text description:
- `--critical` → tag the decision `critical`, allow extended prose in Context/Rationale, prefix INDEX status with `⚠`.
- `--global` → save under `_global/` instead of the project slug.
- `--tags tag1,tag2` → add explicit tags (comma-separated).

The remaining free text is the **description input** for the decision.

**Steps:**

1. Determine target slug:
   - If `--global` → slug is literally `_global`.
   - Otherwise use the slug output above.
2. Run `~/.claude/skills/debug-decisions/.bin/ensure-project-dir.sh <slug>` to ensure the project dir + INDEX exist.
3. Generate the decision id: `~/.claude/skills/debug-decisions/.bin/decision-id.sh "<description input>"`.
4. Compose the decision file content following `decision-template.md`. **Critical rule:** if you cannot deduce Context, Alternatives Considered, or Rationale from the conversation history, **stop and ask the user** before writing. Never invent.
   - `id`, `date` (ISO8601 with timezone), `project` (the slug), `git_sha`, `tags` (auto-detect `critical` if `--critical` or if description contains `security|breaking|migration|data-loss`; merge with any `--tags` provided).
   - Title: 1-line imperative restatement of the description.
   - Default to bullet/short-line prose. Only use extended prose if decision is critical.
5. Write the file: `~/.claude/debug-decisions/<slug>/<id>.md` using the `Write` tool.
6. Append to INDEX: `~/.claude/skills/debug-decisions/.bin/index-append.sh "<slug>" "<id>" "<YYYY-MM-DD>" "active" "<tags-csv>" "<title>"`.
7. Output to user (brief):
   ```
   Decision registered: <id>
   File: ~/.claude/debug-decisions/<slug>/<id>.md
   View: /decision-show <short-id-suffix>
   ```

**If id collides** (file already exists for same minute): append `-2`, `-3` to the minute portion. Never overwrite.

**If the INDEX header is malformed or missing**: do NOT auto-reconstruct. Stop, show the user what was found, ask for manual fix.
