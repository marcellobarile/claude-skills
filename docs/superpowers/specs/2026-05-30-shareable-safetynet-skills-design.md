> **What is this file.** Design spec for turning three personal Claude Code "safetynet" best-practices into shareable skills published in the `claude-skills` catalog.
> **Audience:** the implementer (Claude or a human) and future maintainers of this repo.
> **Owner:** marcellobarile.
> **Companion files:** the implementation plan written by `writing-plans` will live in `docs/superpowers/plans/`; this spec is the contract, the plan covers sequencing.

# Shareable safetynet skills

## Goal

Extract three conventions currently baked into the author's personal `~/.claude` setup into self-contained, shareable skills in the `claude-skills` catalog, stripped of personal/employer-specific content:

1. `memory-org` — where Claude memories live (repo-scoped vs global) and how to wire them.
2. `debug-decisions` — per-project tracking of architectural decisions (the heavy toolkit).
3. `spec-versioning` — where specs/plans live in a repo, with scaffolding commands.

Non-goal: migrating the author's own central data; preserving Italian templates, caveman, or
employer-named exceptions.

## Scope decisions (locked)

- **Three separate skills**, one per concern — clean boundaries, each independently installable.
- **Full tooling** shipped (scripts, slash commands, hooks), generalized — not guidance-only.
- **All three built together** in one PR.
- **Per-skill `setup.mjs`** for wiring: the installer copies the skill, then runs the skill's own setup.
- **Generalized**, see "Generalization checklist".

## Architecture

### Installer extension (`bin/install.mjs`, `lib/`)

After `copySkill`, the installer checks for `skills/<name>/setup.mjs`. If present it prompts
`Run setup for <name>? (wires commands/hooks)`. On confirm it dynamically `import()`s the file and
calls its default export:

```js
export default async function setup({ skillDir, claudeDir, log }) { /* ... */ }
```

`skillDir` is the installed location (`~/.claude/skills/<name>/`), `claudeDir` is `~/.claude`.
Each skill encapsulates its own wiring. A skill without `setup.mjs` behaves exactly as today
(copy-only).

New helpers in `lib/`:

- `settings.mjs` — safe read/merge/write of `~/.claude/settings.json`:
  - backs up to `settings.json.bak.<timestamp>` before writing;
  - **idempotent** hook registration: does not duplicate a hook whose `command` already exists;
  - preserves unknown keys; pretty-prints with 2-space indent.
- `commands.mjs` — copies slash-command `.md` files into `~/.claude/commands/`, with overwrite
  confirmation consistent with the existing skill-overwrite prompt.

### Skill 1 — `memory-org`

- `SKILL.md` — the convention: project-specific memories → `<repo>/docs/memory/` symlinked from
  `~/.claude/projects/<slug>/memory/` (git-tracked, Claude-discoverable); generic/cross-project →
  `~/.claude/CLAUDE.md`. Decision rule for choosing. Shared/work-monorepo exception
  (generic wording, no employer name): keep memories in `~/.claude/projects/<slug>/memory/` only,
  not git-tracked.
- `setup-project-memory.sh` — generalized symlink helper taking repo path + slug; performs the
  `mkdir`/`mv`/`rmdir`/`ln -s` dance idempotently.
- Slash command `/memory-setup` invoking the script for the current repo.
- `setup.mjs` — installs the `/memory-setup` command.

### Skill 2 — `debug-decisions` (heavy)

Packaged inside `skills/debug-decisions/`:

- `SKILL.md` — what the system is, what counts as a decision, critical-decision rules.
- `commands/` — five command files: `decision`, `decision-list`, `decision-show`,
  `decision-revert`, `decision-supersede`. Path-generalized to reference the installed skill
  location and emit brief output (no forced language).
- `.bin/` — six shell scripts: `slug.sh`, `git-sha.sh`, `decision-id.sh`, `ensure-project-dir.sh`,
  `index-append.sh`, `index-update-status.sh`. Plus ported `.bin/tests`.
- `.schema/` — `decision-template.md`, `INDEX-skeleton.md`, translated to English.
- `.config.json` — Stop-hook tuning. Keywords generalized to English; documented as configurable.
- `hooks/decisions-stop-prompt.js` — Stop hook; injects a retrospective reminder at session end if
  signals suggest an unregistered decision. Never writes files. Path-generalized.
- `setup.mjs` — copies the five commands → `~/.claude/commands/`; registers the Stop hook in
  `~/.claude/settings.json` via `lib/settings.mjs`.

**Code vs data separation:**

- Code (scripts, schema, hook, config) lives in `~/.claude/skills/debug-decisions/`. Commands
  reference `~/.claude/skills/debug-decisions/.bin/*` and `.schema/*`.
- Decision data is stored centrally in `~/.claude/debug-decisions/<slug>/`, separate from the skill
  dir, so it survives skill reinstall/upgrade.

### Uninstaller (`bin/uninstall.mjs`, per-skill `teardown.mjs`)

Symmetric to install. `bin/uninstall.mjs` lists the skills currently in `~/.claude/skills/`
(via `discoverSkills(TARGET_DIR)`), multi-selects, and for each: runs the skill's own
`teardown.mjs` (on confirm), then deletes the skill directory. A skill without `teardown.mjs` is
just deleted.

Each `teardown.mjs` is self-contained (no repo `lib/` import, same reasoning as `setup.mjs`) and
mirrors that skill's setup:

- `spec-versioning` / `memory-org` — remove the slash commands they installed from
  `~/.claude/commands/`.
- `debug-decisions` — remove its five commands and de-register the Stop hook from
  `~/.claude/settings.json` (idempotent, backed up first). Recorded decision data under
  `~/.claude/debug-decisions/` is **never** deleted; teardown only prints where it lives.

New `lib/` helpers (unit-tested, mirrored inline by the teardowns): `settings.removeHook`,
`commands.removeCommands`, `setup.loadTeardown`.

### Skill 3 — `spec-versioning`

- `SKILL.md` — the convention: specs → `<repo>/docs/specs/`, plans → `<repo>/docs/plans/`
  (neutral default, repo-scoped, no plugin assumption). `superpowers/` path prefix offered as
  opt-in config for users running the superpowers plugin.
- Slash commands `/spec-new` and `/plan-new` — scaffold a dated file from a template into the
  configured directory.
- `references/spec-writing-rules.md` — optional, de-personalized PM-artifact content rules
  (delivery-slice naming, PoC-vs-delivered status terms, no bare acronyms, "what is this file"
  header). Referenced from `SKILL.md`, not mandatory.
- `setup.mjs` — installs the two commands.

### Catalog & docs

- `npm run docs` regenerates the README "Available skills" table from SKILL.md frontmatter (three
  new rows). Add a short note marking skills that ship extra wiring (`setup.mjs`).

## Generalization checklist (strip personal/employer)

- Italian → English across all `.schema` templates, command output instructions, and
  `.config.json` keywords (`scegli/decid/...` → `choose/decid/...`).
- Employer-named monorepo exception → generic "shared/work monorepo".
- Hardcoded `/Users/<user>/...` paths → resolved via `~`/homedir.
- Remove caveman references and personal spec-path references.

## Testing

- TDD on `lib/settings.mjs` — the risky part: idempotent hook merge, backup creation, preservation
  of unknown keys, 2-space formatting.
- Smoke test on `lib/commands.mjs` — copy + overwrite behavior.
- Port the existing `.bin/tests` for the debug-decisions shell scripts.
- `npm test` (node --test) stays green.

## Error handling

- `settings.mjs` never writes without a backup; on malformed existing JSON it stops and reports,
  does not overwrite.
- `setup.mjs` confirmation is opt-in; declining leaves the system in copy-only state.
- Command/INDEX edge cases preserve the original toolkit's rules (id collision → suffix; malformed
  INDEX → stop and ask, never auto-reconstruct).

## Deliverable

A single PR adding the three skills + installer extension + regenerated catalog. Author commits;
this session does not commit or push.
