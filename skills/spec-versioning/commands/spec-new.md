---
allowed-tools: Bash(date:*), Bash(mkdir:*), Read, Write
description: Scaffold a dated design spec into docs/specs (default) or docs/superpowers/specs (--superpowers)
---

## Context

User invoked `/spec-new` with arguments: $ARGUMENTS

Today (ISO date):
!`date +%Y-%m-%d`

## Your task

1. Check if `$ARGUMENTS` contains `--superpowers`. If yes, remove the flag from the topic string.
2. Treat the remaining arguments as the topic. Kebab-case it for the filename.
3. Target directory:
   - `--superpowers` flag present → `docs/superpowers/specs`
   - otherwise → `docs/specs`
4. Create the directory if missing.
5. Copy `~/.claude/skills/spec-versioning/templates/spec-template.md` into
   `<dir>/<date>-<topic-kebab>-design.md`, replacing `<topic>` and `<owner>` placeholders.
6. Tell the user the path. Do not commit.
