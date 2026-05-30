---
allowed-tools: Bash(~/.claude/skills/debug-decisions/.bin/*:*), Read, Edit, Bash(git log:*), Bash(git rev-parse:*), Bash(ls:*), Bash(grep:*)
description: Show revert plan for a decision and execute it with explicit confirmation at every step
---

## Context

User invoked `/decision-revert` with arguments: $ARGUMENTS

**This command performs irreversible actions. Use full sentences, no abbreviations, for this entire flow.**

Resolve current project slug:
!`~/.claude/skills/debug-decisions/.bin/slug.sh`

## Your task

Walk the user through reverting an architectural decision, with explicit confirmation at each destructive step.

**Parse `$ARGUMENTS`**:
- First positional: `<id-or-partial>` (required).
- `--global` → search in `_global/`.

**Steps:**

1. Resolve target dir and find the file (same logic as `/decision-show`). If 0 matches, abort with helpful error. If >1, ask to disambiguate. Do NOT proceed on ambiguity.
2. Read the matched file.
3. **Check current status:**
   - If `status` already starts with `reverted:`, warn the user the decision is already reverted and ask if they want to proceed anyway (re-revert). If they decline, stop.
   - If `status: superseded-by:<id>`, warn and ask for confirmation before proceeding.
4. **Print the Revert plan and Scope/Impact sections** prominently to the user.
5. **If `git_sha` is not null AND cwd is in a git repo whose HEAD differs from that SHA**, run `git log <sha>..HEAD --oneline` and show the user what has changed in the repo since the decision was made. This is informational only — never destructive.
6. **Ask explicit confirmation:** "Proceed with the step-by-step revert? Each destructive step will require separate confirmation." Wait for "yes" / "ok". Anything else → abort.
7. **Execute Revert plan steps one at a time:**
   - For each step in the plan: print the step, explain what it will do, ask "Execute this step? (yes/no/skip)". Only proceed on "yes".
   - On "skip" → mark step as skipped, continue.
   - On "no" → abort. Mark status `revert-partial:<YYYY-MM-DD>` and append a Follow-up note describing where the revert stopped.
8. **After all steps complete:**
   - Ask user for brief reason/note for the revert.
   - Update the decision file: change `status: active` → `status: reverted:<YYYY-MM-DD>`, append a `## Revert log` section with the date, reason, and any skipped steps.
   - Update INDEX: `~/.claude/skills/debug-decisions/.bin/index-update-status.sh <slug> <id> reverted:<YYYY-MM-DD>`.
9. Output (full sentences): "Revert completed for <id>. File updated, INDEX updated."

**Never** silently auto-apply any step. **Never** delete the decision file (status mutation only). **Never** modify other decision files referenced by this one — if downstream dependencies exist in Scope/Impact, warn the user but do not cascade.
