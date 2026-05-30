# Claude Skills — Installer & Catalog Design

> **What is this file:** Design/spec for the infrastructure that turns this repo into a
> distributable catalog of Claude Code skills, with an interactive installer.
> **Audience:** the repo maintainer (owner) and contributors.
> **Owner:** marcello.barile
> **Status legend:** `Planned` = designed, not built. `Implemented` = merged & working.

## Goal

Let other users install **only the skills they want** from this repo into their personal
Claude Code skills directory, and keep a README skill catalog that never drifts from the
actual skill contents.

## Constraints & Decisions

- **Install target:** `~/.claude/skills/<skill-name>/` (user scope). No project scope, no
  plugin marketplace.
- **Wizard tech:** Node.js, interactive prompts via `@clack/prompts`.
- **README listing:** auto-generated from each skill's `SKILL.md` frontmatter. Single
  source of truth shared with the wizard.
- **Sample skill:** none. Repo ships infrastructure only; `skills/` may be empty.
- **Primary install UX:** `npx github:<owner>/claude-skills`. Fallback: clone + `npm start`.

## Repo Layout

```
skills/
  <skill-name>/
    SKILL.md            # frontmatter: name, description; + skill body
    ...                 # optional extra files (references/, scripts/, assets)
bin/
  install.mjs           # interactive wizard (package.json "bin")
scripts/
  gen-readme.mjs        # regenerate the skills table in README
lib/
  skills.mjs            # shared discovery: scan skills/, parse frontmatter
test/
  skills.test.js        # node:test for discovery + copy logic
package.json            # bin + scripts + deps
README.md               # catalog table between <!-- SKILLS:START/END --> markers
docs/superpowers/specs/  # this spec
```

## Components

### `lib/skills.mjs` — discovery (single source of truth)
- `discoverSkills(skillsDir)` → array of `{ name, description, dir }`.
- Scans `skills/*/SKILL.md`. Parses YAML frontmatter with `gray-matter`.
- `name` defaults to the directory name if frontmatter `name` is absent.
- Malformed/missing frontmatter → skill **skipped with a warning**, never throws.
- Empty or missing `skills/` → returns `[]` (no crash).
- `copySkill(srcDir, destDir)` → recursive copy of a skill directory.

Used by **both** the wizard and the README generator → no drift.

### `bin/install.mjs` — wizard
Flow:
1. Discover available skills.
2. If none: print "Nessuna skill disponibile nel repo." and exit 0.
3. `@clack/prompts` multiselect: each row = `name` + `description`.
4. For each selected skill:
   - dest = `~/.claude/skills/<name>/`.
   - If dest exists: prompt **overwrite / skip** (per skill).
   - Else: recursive copy.
5. Ensure `~/.claude/skills/` exists (create if missing).
6. Final summary: installed / skipped / overwritten counts.
- `Ctrl-C` / cancel at any prompt → clean exit, nothing half-copied beyond skills already
  confirmed.

### `scripts/gen-readme.mjs` — README generator
- `npm run docs`.
- Discover skills, render a Markdown table (`| Skill | Description |`).
- Replace content **only** between `<!-- SKILLS:START -->` and `<!-- SKILLS:END -->`.
  Rest of README is hand-written (intro, install command, usage, contributing).
- Empty catalog → table body shows a single "_Nessuna skill ancora._" row.
- Idempotent: running twice with no skill change yields no diff.

### `package.json`
- `"bin": { "claude-skills-install": "bin/install.mjs" }` (enables `npx github:...`).
- `"scripts": { "start": "node bin/install.mjs", "docs": "node scripts/gen-readme.mjs", "test": "node --test" }`.
- deps: `@clack/prompts`, `gray-matter`. ESM (`"type": "module"`).

## SKILL.md convention (documented in README "Contributing")

```markdown
---
name: my-skill
description: One-line summary shown in catalog and wizard.
---

# My Skill
...skill body...
```

## Error Handling

| Case | Behavior |
|------|----------|
| `skills/` missing/empty | wizard: friendly exit; gen-readme: placeholder row |
| Frontmatter missing/malformed | skill skipped + stderr warning, others proceed |
| Missing `description` | empty description, still listed |
| Dest skill dir exists | per-skill overwrite/skip prompt |
| `~/.claude/skills/` missing | created automatically |
| User cancels prompt | clean exit, no partial copy of unconfirmed skills |

## Testing

`test/skills.test.js` (`node:test`), against temp fixtures:
- `discoverSkills`: valid skills, missing frontmatter (skipped), missing `name` (falls back
  to dir name), empty dir (`[]`).
- `copySkill`: recursive copy including nested files; overwrite replaces cleanly.
- README render: table output for N skills and for empty catalog; marker replacement leaves
  surrounding text intact.

Wizard prompt UI is not unit-tested (interactive shell).

## Out of Scope (YAGNI)

- Project-scope / plugin-marketplace install.
- Versioning, update/uninstall commands, skill dependencies.
- Auto-running gen-readme via git hook (run manually for now).
- Windows-specific path handling beyond what Node `os.homedir()` provides.
