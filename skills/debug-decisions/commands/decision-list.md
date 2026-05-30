---
allowed-tools: Bash(~/.claude/skills/debug-decisions/.bin/*:*), Read, Bash(grep:*), Bash(awk:*), Bash(wc:*)
description: List architectural decisions for the current project (or --global)
---

## Context

User invoked `/decision-list` with arguments: $ARGUMENTS

Resolve current project slug:
!`~/.claude/skills/debug-decisions/.bin/slug.sh`

## Your task

Show the INDEX of decisions, optionally filtered.

**Parse `$ARGUMENTS`** for flags:
- `--global` → list `_global/INDEX.md` instead.
- `--tag <tag>` → keep only rows whose Tags column contains `<tag>`.
- `--critical` → keep only rows with `⚠` in Status.
- `--status <active|reverted|superseded>` → keep only rows whose status (after stripping `⚠ ` prefix) starts with `<status>`.

**Steps:**

1. Determine target INDEX path:
   - `--global` → `~/.claude/debug-decisions/_global/INDEX.md`
   - else → `~/.claude/debug-decisions/<slug>/INDEX.md`
2. If file does not exist: output "No decisions registered for this project." and stop.
3. Read INDEX with `Read` tool. **Do NOT scan or read individual decision files.**
4. Print header (h1) + table header (separator + data rows), applying filters via grep/awk on row lines (lines starting with `| ` but not `|---` or `| ID `).
5. Compute counts:
   - `total` = data rows in unfiltered table
   - `critical` = rows with `⚠`
   - `reverted` = rows whose status starts with `reverted`
   - `superseded` = rows whose status starts with `superseded`
6. Append footer line: `<N> decisions, <X> critical, <Y> reverted, <Z> superseded.` Omit zero counts.

**Token discipline:** never load decision file bodies in this command. Only the INDEX.
