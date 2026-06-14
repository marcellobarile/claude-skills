---
allowed-tools: Bash(date:*), Bash(mkdir:*), Read, Write
description: Scaffold a dated implementation plan into docs/plans (default) or docs/superpowers/plans (--superpowers)
---

## Context

User invoked `/plan-new` with arguments: $ARGUMENTS

Today (ISO date):
!`date +%Y-%m-%d`

## Your task

1. Check if `$ARGUMENTS` contains `--superpowers`. If yes, remove the flag from the feature string.
2. Treat the remaining arguments as the feature name. Kebab-case it for the filename.
3. Target directory:
   - `--superpowers` flag present → `docs/superpowers/plans`
   - otherwise → `docs/plans`
4. Create the directory if missing.
5. Copy `~/.claude/skills/spec-versioning/templates/plan-template.md` into
   `<dir>/<date>-<feature-kebab>.md`, replacing `<feature>` placeholders.
6. Tell the user the path. Do not commit.
