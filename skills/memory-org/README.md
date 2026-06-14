# memory-org

Convention and tooling for organizing Claude memories across projects. Defines where project-specific memories live (git-tracked, inside the repo) vs. generic cross-project memories (in `~/.claude/CLAUDE.md`), and wires the symlink so Claude finds them in both places.

---

## The problem it solves

Claude Code stores memories in `~/.claude/projects/<slug>/memory/`. Without this skill, all project memories accumulate in `~/.claude/` and are invisible to git — no history, no diffs, no PR-level context. This skill establishes a convention that puts project-scoped memories inside the repo and symlinks them back to where Claude expects them.

---

## Convention

| Memory type | Where it lives | Git-tracked |
|---|---|---|
| Project-specific (architecture, specs, project feedback) | `<repo>/docs/memory/` → symlinked from `~/.claude/projects/<slug>/memory/` | Yes |
| Generic / cross-project (role, coding prefs, response style) | `~/.claude/CLAUDE.md` | No (personal) |
| Shared monorepos (where Claude artifacts must not be committed) | `~/.claude/projects/<slug>/memory/` only | No |

---

## Decision rule

1. Is this memory specific to one project? → `<repo>/docs/memory/`, update its `MEMORY.md` index.
2. Does it apply across all projects? → `~/.claude/CLAUDE.md`. No separate file needed.
3. In a shared/work monorepo where Claude artifacts must not be committed? → `~/.claude/projects/<slug>/memory/` only.

---

## Commands

| Command | What it does |
|---|---|
| `/memory-setup` | Interactive setup — creates `docs/memory/`, migrates existing memories, wires the symlink |

---

## Symlink setup (manual)

```sh
mkdir -p <repo>/docs/memory
mv ~/.claude/projects/<slug>/memory/* <repo>/docs/memory/
rmdir ~/.claude/projects/<slug>/memory
ln -s <repo>/docs/memory ~/.claude/projects/<slug>/memory
```

After this, Claude reads and writes memories to `<repo>/docs/memory/` and they travel with the repo.

---

## Files

```
memory-org/
├── SKILL.md
├── setup.mjs               ← registers any Claude Code settings needed
├── teardown.mjs
├── commands/
│   └── memory-setup.md     ← /memory-setup command definition
└── scripts/
    └── setup-project-memory.sh  ← shell script that performs the symlink wiring
```
