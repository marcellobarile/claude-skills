---
allowed-tools: Bash(~/.claude/skills/debug-decisions/.bin/*:*), Read, Write, Edit, Bash(ls:*), Bash(grep:*)
description: Create a new decision that supersedes an existing one
---

## Context

User invoked `/decision-supersede` with arguments: $ARGUMENTS

Resolve current project slug:
!`~/.claude/skills/debug-decisions/.bin/slug.sh`

Get current git SHA:
!`~/.claude/skills/debug-decisions/.bin/git-sha.sh`

## Your task

Create a new decision that supersedes an existing one. The new decision references the old via a `## Supersedes` section; the old decision's status is updated.

**Parse `$ARGUMENTS`**:
- First positional: `<old-id-or-partial>` (required).
- Remainder: free-text description for the new decision.
- `--critical`, `--global`, `--tags` flags as in `/decision`.

**Steps:**

1. Resolve `<old-id>` to a single file (same matching logic as `/decision-show`). Abort if 0 or >1 match (with helpful message).
2. **Verify no cycle:** read the old file; if its `status` is `superseded-by:<X>` AND that `<X>` chain leads back to the new id (impossible since new id has no timestamp collision risk pre-creation, but check up to 10 hops anyway as defense-in-depth), abort.
3. Generate new id via `decision-id.sh "<description>"`. Handle id collision as in `/decision`.
4. Compose new decision file following the schema. **Add a `## Supersedes` section after `## Decision`:**
   ```markdown
   ## Supersedes
   - **<old-id>** — <one-line reason for supersession, ask user if not deducible>
   ```
5. Write new file via `Write` tool.
6. Append new row to INDEX via `index-append.sh`.
7. Update old decision file: change `status: active` (or whatever it currently is) to `status: superseded-by:<new-id>`. Append a `## Superseded by` section with date, new id, and one-line reason.
8. Update INDEX row for old decision: `index-update-status.sh <slug> <old-id> superseded-by:<new-id>`.
9. Output (brief):
   ```
   Decision <old-id> superseded by <new-id>.
   New file: <path>
   Old file updated with a reference to the new one.
   ```

**Never** delete the old decision file. Status mutation only.
