---
allowed-tools: Bash(python3:*), Bash(gh:*), Bash(git:*), Bash(ls:*), Bash(mkdir:*), Bash(cat:*), Bash(rm:*), Read, Write, Edit
description: Sync Claude Code skills from GitHub repos
---

## Context

User invoked `/sync-skills` with arguments: $ARGUMENTS

Script: `~/.claude/skills/sync-skills/scripts/sync.py`
SKILL.md (for add/remove): `~/.claude/skills/sync-skills/SKILL.md`

## Your task

Parse $ARGUMENTS to determine subcommand:

### `` (empty) / `sync` / `list` / `scan`

Run the script directly:

```bash
python3 ~/.claude/skills/sync-skills/scripts/sync.py $ARGUMENTS
```

Print output to user. Done.

### `add`

Read `~/.claude/skills/sync-skills/SKILL.md` and follow the `/sync-skills add` instructions.

### `remove <name>`

Read `~/.claude/skills/sync-skills/SKILL.md` and follow the `/sync-skills remove` instructions.
