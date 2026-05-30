---
name: memory-org
description: Convention for where Claude memories live — repo-scoped project memories in docs/memory (git-tracked, symlinked into ~/.claude) vs generic memories in ~/.claude/CLAUDE.md. Use when saving a memory, organizing project memory, or setting up per-project memory.
---

# memory-org

Decide where a memory belongs and wire repo-scoped memory so Claude finds it and git tracks it.

## Where memories live

- **Project-specific** (architecture, project context, project-specific feedback, specs) →
  `<repo>/docs/memory/`, symlinked from `~/.claude/projects/<slug>/memory/`.
- **Generic / cross-project** (your role, general coding prefs, response style) → `~/.claude/CLAUDE.md`.

## Decision rule

1. Specific to this project only? → `<repo>/docs/memory/`, update its `MEMORY.md` index.
2. Applies across all projects? → `~/.claude/CLAUDE.md`. No separate file.

## Exception — shared/work monorepos

In repos where you must not commit Claude artifacts, keep memories in
`~/.claude/projects/<slug>/memory/` only (not git-tracked).

## Setup

`/memory-setup` (or `scripts/setup-project-memory.sh <repo> <slug>`) creates `<repo>/docs/memory/`,
moves any existing memories out of `~/.claude/projects/<slug>/memory/`, and symlinks them back.
