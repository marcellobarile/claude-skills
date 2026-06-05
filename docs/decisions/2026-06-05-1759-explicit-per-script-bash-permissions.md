---
id: 2026-06-05-1759-explicit-per-script-bash-permissions
date: 2026-06-05T17:59+02:00
project: -Users-marcello.barile-src-mine-claude-skills
status: active
git_sha: 59e31c3
tags: []
---

# Use explicit per-script Bash permissions instead of path wildcard in debug-decisions setup

## Context
`setup.mjs` was registering `Bash(~/.claude/skills/debug-decisions/.bin/*:*)` in `settings.json`. The Claude Code permission matcher does not support glob patterns in the command path (only in the args portion after `:`), so `!` inline shell substitutions in skill command files were blocked despite the entry existing.

## Decision
Register six explicit `Bash(<path>/script.sh)` / `Bash(<path>/script.sh:*)` entries — one per script in `.bin/` — instead of a single wildcard entry.

## Alternatives considered
- **`Bash(~/.claude/skills/debug-decisions/.bin/*:*)`** — dropped: wildcard in command path not supported by permission matcher.
- **Absolute paths in settings.json** — dropped: `~` is portable across users; no functional difference since Claude Code expands it consistently.

## Rationale
- `!` inline commands in skill files check `settings.json` allowlist; `allowed-tools` frontmatter only covers model Bash tool calls.
- Permission matcher supports `*` only after `:` (args glob), not inside the command path segment.
- Explicit entries are verbose but guaranteed to match; wildcard entries silently fail.

## Scope / Impact
- Files: `skills/debug-decisions/setup.mjs`, `skills/debug-decisions/teardown.mjs`
- Areas: skill install/uninstall, Claude Code permission system
- Downstream dependencies: any skill using `!` inline with custom scripts must follow same pattern.

## Revert plan
1. In `setup.mjs` replace the six explicit entries with `Bash(~/.claude/skills/debug-decisions/.bin/*:*)`.
2. In `teardown.mjs` mirror the same change.
3. Risks: `!` inline commands will be blocked again at session start until user manually approves.

## Follow-ups
- [ ] Verify whether `allowed-tools` frontmatter also needs explicit entries (vs wildcard) for Bash tool calls.
