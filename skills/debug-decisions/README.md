# debug-decisions

Per-project architectural decision tracker for Claude Code. Registers decisions as versioned Markdown with revert plans, maintains an `INDEX.md`, and prompts at session end when it detects an unregistered decision. Decisions can be stored in `~/.claude/` or wired into a repo's `docs/decisions/` so they travel in git.

---

## What it does

Every non-trivial architectural or approach choice made during a Claude session can be registered with `/decision`. Each entry gets:
- A stable ID (e.g. `D-0007`)
- A description, timestamp, and current git SHA
- A structured revert plan
- Optional tags and criticality flag
- Automatic appending to the project's `INDEX.md`

At session end, a `Stop` hook fires if it detects signals of an unregistered decision and prompts you to record it. It writes nothing — only reminds.

---

## Commands

| Command | What it does |
|---|---|
| `/decision <description>` | Register a decision. Flags: `--critical`, `--global`, `--tags a,b` |
| `/decision-list` | List all decisions for the current project. Flag: `--critical` to filter |
| `/decision-show <id>` | Show one decision in full (description, context, revert plan) |
| `/decision-revert <id>` | Guided revert with explicit confirmation at every step |
| `/decision-supersede <old-id> <description>` | Mark old decision superseded, register new one |
| `/decision-link` | Wire `docs/decisions/` in the current git repo as the storage backend |

---

## Storage layout

```
~/.claude/debug-decisions/
├── <slug>/           ← one dir per project (slug = cwd with / → -)
│   ├── INDEX.md
│   └── D-0001.md … D-NNNN.md
└── _global/          ← decisions registered with --global (never git-linked)
```

After running `/decision-link`, the per-project dir becomes a symlink to `<repo>/docs/decisions/`, and decisions are committed alongside the code.

Decision files live in `~/.claude/skills/debug-decisions/` (the skill itself). Data lives in `~/.claude/debug-decisions/`.

---

## Critical decisions

Tag `--critical` when a decision is:
- Irreversible or hard to undo
- Affects multiple teams
- Security-relevant
- High blast radius

Critical decisions appear with a `⚠` prefix in the INDEX and allow extended prose in the body.

---

## Stop hook

A JavaScript `Stop` hook (`hooks/decisions-stop-prompt.js`) inspects ephemeral session state under `.state/` at the end of each session. If it finds signals of an unregistered decision, it injects a retrospective reminder. It never writes decision files.

Disable via `.config.json`:
```json
{ "stop_prompt": false }
```

---

## What counts as a decision

Only architectural or approach choices, e.g.:
- "Use file-per-decision instead of an append-only log"
- "Switch from REST to GraphQL for the settings API"
- "Store sessions in Redis rather than Postgres"

Not tracked:
- Individual file edits (git covers those)
- Destructive shell commands
- Sub-agent spawns

---

## Files

```
debug-decisions/
├── SKILL.md
├── .config.json          ← { "stop_prompt": true/false }
├── .schema/              ← JSON schema for decision files
├── setup.mjs             ← installs hook + registers .bin/* permissions
├── teardown.mjs          ← removes hook + cleans permissions
├── commands/
│   ├── decision.md
│   ├── decision-link.md
│   ├── decision-list.md
│   ├── decision-revert.md
│   ├── decision-show.md
│   └── decision-supersede.md
├── hooks/
│   └── decisions-stop-prompt.js
└── .bin/
    ├── decision-id.sh       ← generate next D-NNNN id
    ├── ensure-project-dir.sh
    ├── git-sha.sh
    ├── index-append.sh
    ├── index-update-status.sh
    ├── setup-project-decisions.sh
    ├── slug.sh              ← cwd → filesystem-safe slug
    └── tests/               ← shell unit tests for all .bin scripts
```

---

## Setup / teardown

`setup.mjs` runs on install: registers the `Stop` hook in Claude Code settings and adds `.bin/*` to allowed permissions so Claude can run the shell helpers without prompting.

`teardown.mjs` reverses both.
