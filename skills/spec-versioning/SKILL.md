---
name: spec-versioning
description: Convention for where design specs and implementation plans live in a repo (docs/specs and docs/plans), with /spec-new and /plan-new scaffolding commands. Use when creating a spec or plan, or organizing project design docs.
---

# spec-versioning

Keep design specs and implementation plans as versioned, repo-scoped Markdown.

## Convention

- Specs → `<repo>/docs/specs/YYYY-MM-DD-<topic>-design.md`
- Plans → `<repo>/docs/plans/YYYY-MM-DD-<feature>.md`

These are repo-scoped on purpose: they version with the code and travel in PRs.

### Opt-in: superpowers layout

If you use the superpowers plugin, set the path prefix to `docs/superpowers/` so specs land in
`docs/superpowers/specs/` and plans in `docs/superpowers/plans/`. The `/spec-new` and `/plan-new`
commands read an optional `SPEC_DIR` / `PLAN_DIR` override; default is the neutral layout above.

## Commands

- `/spec-new <topic>` — scaffold a dated spec from `templates/spec-template.md`.
- `/plan-new <feature>` — scaffold a dated plan from `templates/plan-template.md`.

## Writing quality

See `references/spec-writing-rules.md` for optional content rules (delivery-slice naming,
PoC-vs-delivered status terms, acronym expansion, "what is this file" header).
