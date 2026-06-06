---
allowed-tools: Bash(~/.claude/skills/debug-decisions/.bin/setup-project-decisions.sh:*), Bash(~/.claude/skills/debug-decisions/.bin/slug.sh), Bash(pwd:*)
description: Wire repo-scoped project decisions (docs/decisions symlinked into ~/.claude/debug-decisions)
---

## Context

Current directory (used as project root for the symlink):
!`pwd`

Current project slug (same derivation as /decision):
!`~/.claude/skills/debug-decisions/.bin/slug.sh`

## Your task

1. Use the slug and directory above directly — do not re-derive from git root.
2. Run `~/.claude/skills/debug-decisions/.bin/setup-project-decisions.sh "<current-dir>" "<slug>"`.
3. Report the resulting symlink to the user. Do not commit the symlink itself — commit the files inside `docs/decisions/`.
