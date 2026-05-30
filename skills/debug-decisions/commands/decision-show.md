---
allowed-tools: Bash(~/.claude/skills/debug-decisions/.bin/*:*), Read, Bash(ls:*), Bash(grep:*)
description: Show a single decision in full, by id or partial id
---

## Context

User invoked `/decision-show` with arguments: $ARGUMENTS

Resolve current project slug:
!`~/.claude/skills/debug-decisions/.bin/slug.sh`

## Your task

Display a single decision file by id or partial id.

**Parse `$ARGUMENTS`**:
- First positional: `<id-or-partial>` (required).
- `--global` → search in `_global/` instead.

**Steps:**

1. Determine target dir:
   - `--global` → `~/.claude/debug-decisions/_global/`
   - else → `~/.claude/debug-decisions/<slug>/`
2. List candidate files: `ls <dir>/*.md` excluding `INDEX.md`. Filter to filenames containing the partial id (substring match, case-insensitive).
3. Match resolution:
   - **0 matches** → output "No decision found for '<input>'. Closest decisions:" followed by up to 3 nearest by Levenshtein or simple substring approximation on ids extracted from `INDEX.md`. If no INDEX, just say none found.
   - **Exactly 1 match** → proceed.
   - **>1 matches** → list candidates with one-line title preview (read first `# ` heading line of each), ask user to disambiguate.
4. Read the single matched file with `Read` tool.
5. Output the file content verbatim in a fenced markdown block so frontmatter renders as visible YAML.

**Token discipline:** read only the single matched file. Do not pre-read all candidates.
