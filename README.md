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

## Available skills

<!-- SKILLS:START -->

| Skill | Description |
| --- | --- |
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
