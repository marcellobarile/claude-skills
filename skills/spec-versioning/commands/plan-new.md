---
allowed-tools: Bash(date:*), Bash(mkdir:*), Read, Write
description: Scaffold a dated implementation plan into docs/plans (or $PLAN_DIR)
---

## Context

User invoked `/plan-new` with arguments: $ARGUMENTS

Today (ISO date):
!`date +%Y-%m-%d`

## Your task

1. Treat `$ARGUMENTS` as the feature name. Kebab-case it for the filename.
2. Target directory: `docs/plans` unless the repo already uses `docs/superpowers/plans` — if so,
   use that.
3. Create the directory if missing.
4. Copy `~/.claude/skills/spec-versioning/templates/plan-template.md` into
   `<dir>/<date>-<feature-kebab>.md`, replacing `<feature>` placeholders.
5. Tell the user the path. Do not commit.
