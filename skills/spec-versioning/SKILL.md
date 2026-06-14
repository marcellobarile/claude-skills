---
name: spec-versioning
description: Convention for where design specs and implementation plans live in a repo (docs/specs and docs/plans), with /spec-new and /plan-new scaffolding commands. Use when creating a spec or plan, or organizing project design docs.
---

# spec-versioning

Keep design specs and implementation plans as versioned, repo-scoped Markdown.

## Layouts

Two supported layouts — both are first-class, not fallbacks for each other:

| Layout | Specs | Plans |
|---|---|---|
| **default** | `docs/specs/YYYY-MM-DD-<topic>-design.md` | `docs/plans/YYYY-MM-DD-<feature>.md` |
| **superpowers** | `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` | `docs/superpowers/plans/YYYY-MM-DD-<feature>.md` |

These are repo-scoped on purpose: they version with the code and travel in PRs.

## Commands

- `/spec-new <topic>` — scaffold a dated spec (default layout).
- `/spec-new --superpowers <topic>` — scaffold into `docs/superpowers/specs/`.
- `/plan-new <feature>` — scaffold a dated plan (default layout).
- `/plan-new --superpowers <feature>` — scaffold into `docs/superpowers/plans/`.

## Reading specs and plans

When searching for an existing spec or plan, always check **both** locations:

1. `docs/specs/` and `docs/plans/`
2. `docs/superpowers/specs/` and `docs/superpowers/plans/`

A repo may use different layouts for different artifacts (e.g. plans written by
`superpowers:writing-plans` land in `docs/superpowers/plans/`, while hand-authored specs may live
in `docs/specs/`). Never assume a single root.

## Writing quality

See `references/spec-writing-rules.md` for optional content rules (delivery-slice naming,
PoC-vs-delivered status terms, acronym expansion, "what is this file" header).
