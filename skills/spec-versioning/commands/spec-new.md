---
allowed-tools: Bash(date:*), Bash(mkdir:*), Read, Write
description: Scaffold a dated design spec into docs/specs (or $SPEC_DIR)
---

## Context

User invoked `/spec-new` with arguments: $ARGUMENTS

Today (ISO date):
!`date +%Y-%m-%d`

## Your task

1. Treat `$ARGUMENTS` as the topic. Kebab-case it for the filename.
2. Target directory: `docs/specs` unless the repo already uses `docs/superpowers/specs`
   (check with the Read/Glob tools) — if so, use that.
3. Create the directory if missing.
4. Copy `~/.claude/skills/spec-versioning/templates/spec-template.md` into
   `<dir>/<date>-<topic-kebab>-design.md`, replacing `<topic>` and `<owner>` placeholders.
5. Tell the user the path. Do not commit.
