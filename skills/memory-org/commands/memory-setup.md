---
allowed-tools: Bash(~/.claude/skills/memory-org/scripts/setup-project-memory.sh:*), Bash(git:*), Bash(pwd:*)
description: Wire repo-scoped project memory (docs/memory symlinked into ~/.claude)
---

## Context

Current repo root:
!`git rev-parse --show-toplevel 2>/dev/null || pwd`

## Your task

1. Derive the project slug the way Claude Code does: the absolute repo path with `/` replaced by `-`.
2. Run `~/.claude/skills/memory-org/scripts/setup-project-memory.sh "<repo-root>" "<slug>"`.
3. Report the resulting symlink to the user. Do not commit.
