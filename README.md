# claude-skills

A collection of skills that I ideated for [Claude Code](https://docs.claude.com/en/docs/claude-code), with an
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
e.g. `personal-trainer` training logs under `~/.claude/personal-trainer/` — is **never** deleted;
remove it by hand if you want it gone.

## Available skills

The agent-tooling skills that used to live here (`debug-decisions`, `memory-org`,
`mind-gym`, `spec-versioning`, `sync-skills`) moved to
[sondalab-ai/skillkit](https://github.com/sondalab-ai/skillkit).

<!-- SKILLS:START -->

| Skill | Description |
| --- | --- |
| `astro-visibility` | Computes which deep-sky objects (nebulae, galaxies, clusters) are observable and imageable from a given location at a given time, with altitude, azimuth, astronomical-night window, rise/set/transit, and framing suggestions based on the imaging gear. ALWAYS use this skill when the user asks what is visible/imageable in a region of the sky ("what's to the north/south/east/west", "nebulae to the west from [place]", "what should I image tonight", "targets for tonight", "objects visible from [place]", "what do I avoid because it goes through the zenith"), or for any astrophotography session planning that depends on location and time. The skill asks for or derives the geolocation, uses real-time clock, and uses the user's gear parameters when known, computing everything with a precise Python script (never by hand). |
| `copilot-adversarial-review` | Reviews a GitHub PR with the GitHub Copilot CLI (`copilot --allow-all-tools -s --prompt '/review'`) in an isolated git worktree, then iterates fixes locally with the user until findings converge, before a single push to the PR. Use when asked to run a Copilot review, an adversarial review, or a second-opinion review on a pull request, or when the user invokes /copilot-adversarial-review. |
| `cv-builder` | Builds a professional, HR-friendly CV for the user. First gathers data from their online presence — GitHub (public API), Medium (RSS), personal site (web fetch) — and accepts pasted exports for gated sources like LinkedIn; then interviews the user to fill gaps one question at a time. Renders a skimmable, self-contained HTML page (3 selectable themes) with print-to-PDF, and persists a structured profile for fast regeneration. USE when the user asks to create/build/update/generate their CV, résumé, or curriculum vitae, wants a CV from their GitHub/LinkedIn/Medium, or asks for an HTML/PDF resume. Generic master CV — no job-description tailoring. |
| `personal-trainer` | Elite personal trainer and mental coach agent. USE whenever the user asks for a workout plan, training program, exercise advice, fitness coaching, gym session tracking, athletic preparation, body recomposition, strength or muscle-building guidance, injury-aware training, sport-specific conditioning, or says things like "help me train", "design my workouts", "coach me", "track my session", "log my workout", "how do I get stronger", "I want to lose fat and gain muscle", "prepare me for [sport/race/competition]", or "check my progress". Also triggers when the user shares session data, RPE feedback, or asks to export their training history. Maintains a persistent profile and full training log under ~/.claude/personal-trainer/ across all sessions. |

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
