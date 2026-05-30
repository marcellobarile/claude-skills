# claude-skills

A catalog of [Claude Code](https://docs.claude.com/en/docs/claude-code) skills, with an
interactive installer that lets you pick **only the skills you want** and copies them into
your personal skills directory (`~/.claude/skills/`).

## Install

Run the wizard with `npx` (no clone needed):

```bash
npx github:marcellobarile/claude-skills
```

Or clone and run it locally:

```bash
git clone https://github.com/marcellobarile/claude-skills
cd claude-skills
npm install
npm start
```

The wizard lists the available skills, lets you multi-select, and installs each chosen skill
into `~/.claude/skills/<name>/`. If a skill is already installed, it asks before overwriting.

Some skills ship extra wiring (slash commands, hooks) via a `setup.mjs`. After copying such a
skill, the installer asks whether to run its setup, which copies commands into
`~/.claude/commands/` and registers any hooks in `~/.claude/settings.json` (backed up first,
idempotently).

## Uninstall

Run the uninstaller wizard:

```bash
npm run uninstall
```

It lists the skills currently installed in `~/.claude/skills/`, lets you multi-select, runs each
skill's `teardown.mjs` (removing the slash commands it installed and de-registering its hooks from
`~/.claude/settings.json`, with a backup), then deletes the skill directory. Recorded user data —
e.g. `debug-decisions` decision records under `~/.claude/debug-decisions/` — is **never** deleted;
remove it by hand if you want it gone.

## Available skills

<!-- SKILLS:START -->

| Skill | Description |
| --- | --- |
| `debug-decisions` | Per-project tracking of architectural decisions made during Claude sessions. Registers decisions as versioned Markdown with revert plans, an INDEX, and an optional session-end reminder hook. Use when making or reviewing an architectural/approach decision, or when asked to record/list/revert a decision. |
| `memory-org` | Convention for where Claude memories live — repo-scoped project memories in docs/memory (git-tracked, symlinked into ~/.claude) vs generic memories in ~/.claude/CLAUDE.md. Use when saving a memory, organizing project memory, or setting up per-project memory. |
| `spec-versioning` | Convention for where design specs and implementation plans live in a repo (docs/specs and docs/plans), with /spec-new and /plan-new scaffolding commands. Use when creating a spec or plan, or organizing project design docs. |
| `sync-skills` | Sync Claude Code skills from GitHub repos. Use when user invokes /sync-skills, /sync-skills add, /sync-skills remove, /sync-skills scan, or asks to manage or set up skill syncing. |

<!-- SKILLS:END -->

## Manual install

Each skill lives in `skills/<name>/`. To install one by hand, copy its directory into
`~/.claude/skills/`:

```bash
cp -R skills/<name> ~/.claude/skills/
```

## Contributing a skill

Add a directory under `skills/` containing a `SKILL.md` with YAML frontmatter:

```markdown
---
name: my-skill
description: One-line summary shown in the catalog and the installer.
---

# My Skill

...skill body...
```

Extra files (references, scripts, assets) can live alongside `SKILL.md`; the installer copies
the whole directory. After adding or editing a skill, regenerate the catalog table:

```bash
npm run docs
```

## License

MIT
