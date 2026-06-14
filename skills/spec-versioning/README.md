# spec-versioning

Convention and scaffolding commands for keeping design specs and implementation plans as versioned, repo-scoped Markdown. Specs live in `docs/specs/`, plans in `docs/plans/`, both date-stamped and committed alongside the code they describe.

---

## Why repo-scoped

Specs and plans that live outside the repo drift from the code. Putting them under `docs/` means they version with the codebase, appear in PRs for review, and are findable by anyone who clones the repo — without needing a separate wiki or Notion page.

---

## Convention

| Artifact | Path | Example |
|---|---|---|
| Design spec | `<repo>/docs/specs/YYYY-MM-DD-<topic>-design.md` | `docs/specs/2026-06-14-auth-redesign-design.md` |
| Implementation plan | `<repo>/docs/plans/YYYY-MM-DD-<feature>.md` | `docs/plans/2026-06-14-oauth-migration.md` |

---

## Commands

| Command | What it does |
|---|---|
| `/spec-new <topic>` | Scaffold a dated spec file from the spec template |
| `/plan-new <feature>` | Scaffold a dated plan file from the plan template |

Both commands read optional `SPEC_DIR` / `PLAN_DIR` env overrides; default is the neutral layout above.

---

## Superpowers layout (opt-in)

If you use the superpowers plugin, set path prefix to `docs/superpowers/`:
- Specs → `docs/superpowers/specs/`
- Plans → `docs/superpowers/plans/`

The commands respect a `SPEC_DIR` / `PLAN_DIR` override — no code change needed.

---

## Writing rules (`references/spec-writing-rules.md`)

Applied automatically when generating content:

- **Slice naming**: delivery splits use `Slice 1` / `Slice 2` (not `Branch` — overloaded with git, not `Part` — too vague)
- **Status terms**: distinguish PoC from delivered. Use `PoC implemented (not delivered)` or `Placeholder (not delivered)` — never `Implemented` for prototype work
- **No bare acronyms**: first use expands in full, e.g. "depth-first search (DFS)"
- **"What is this file" header**: every spec/plan opens with a blockquote stating purpose, audience, owner, and relationship to companion files
- **Unsourced claims**: roadmap/availability claims are either sourced or marked `(assumption — confirmed with <name>, <date>)`

---

## Files

```
spec-versioning/
├── SKILL.md
├── setup.mjs               ← registers any Claude Code settings needed
├── teardown.mjs
├── commands/
│   ├── spec-new.md         ← /spec-new command definition
│   └── plan-new.md         ← /plan-new command definition
├── references/
│   └── spec-writing-rules.md
└── templates/
    ├── spec-template.md    ← scaffold filled by /spec-new
    └── plan-template.md    ← scaffold filled by /plan-new
```
