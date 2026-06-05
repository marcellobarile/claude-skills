---
allowed-tools: Bash(~/.claude/skills/debug-decisions/.bin/setup-project-decisions.sh:*), Bash(git rev-parse:*), Bash(pwd:*)
description: Wire repo-scoped project decisions (docs/decisions symlinked into ~/.claude/debug-decisions)
---

## Context

Current repo root:
!`git rev-parse --show-toplevel 2>/dev/null || pwd`

## Your task

1. Derive the project slug: take the repo root path above, replace every `/` with `-`.
2. Run `~/.claude/skills/debug-decisions/.bin/setup-project-decisions.sh "<repo-root>" "<slug>"`.
3. Report the resulting symlink to the user. Do not commit the symlink itself — commit the files inside `docs/decisions/`.
