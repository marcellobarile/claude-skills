---
allowed-tools: Bash(gh:*), Bash(git:*), Bash(ls:*), Bash(mkdir:*), Bash(uname:*), Bash(base64:*), Bash(printf:*), Bash(rm:*), Bash(test:*), Bash(cat:*), Read, Write, Edit
description: Sync Claude Code skills from GitHub repos
---

## Context

See `~/.claude/skills/sync-skills/SKILL.md`

User invoked `/sync-skills` with arguments: $ARGUMENTS

## Your task

Read `~/.claude/skills/sync-skills/SKILL.md` and follow its instructions exactly.

Subcommand (derived from $ARGUMENTS):
- empty → default sync
- `list` → list tracked skills
- `add` → add a new skill
- `remove <name>` → remove a skill
- `scan` → scan for orphaned entries
