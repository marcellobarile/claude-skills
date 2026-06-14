---
id: 2026-06-14-1006-spec-versioning-uses-explicit-superpowers
date: 2026-06-14T10:06+02:00
project: -Users-marcello.barile-src-mine-claude-skills
status: active
git_sha: 954453f
tags: [spec-versioning]
---

# Use explicit --superpowers flag in /spec-new and /plan-new instead of filesystem auto-detection

## Context
`spec-versioning` commands previously checked whether `docs/superpowers/specs` or `docs/superpowers/plans` existed and silently routed there. This caused ambiguous behavior in repos that mix layouts (e.g. plans from `superpowers:writing-plans` alongside hand-authored specs in `docs/specs/`).

## Decision
Use an explicit `--superpowers` flag at call site: `/spec-new --superpowers <topic>` and `/plan-new --superpowers <feature>`. Default (no flag) routes to `docs/specs/` and `docs/plans/`.

## Alternatives considered
- **Filesystem auto-detection** — dropped: silent, fragile when both layouts coexist in the same repo
- **Env var (SPEC_DIR/PLAN_DIR)** — dropped: requires per-project config boilerplate; flag is self-documenting at call site

## Rationale
- Explicit flag makes routing intent visible and unambiguous
- Repos mixing layouts are a real scenario (`superpowers:writing-plans` always writes to `docs/superpowers/plans/`)
- No filesystem state needed to determine behavior
- Reading skills are instructed to scan both paths regardless of write convention

## Scope / Impact
- Files: `skills/spec-versioning/SKILL.md`, `skills/spec-versioning/commands/spec-new.md`, `skills/spec-versioning/commands/plan-new.md`
- Areas: spec-versioning skill, /spec-new and /plan-new commands
- Downstream dependencies: any skill that scaffolds or reads specs/plans should check both `docs/specs/` and `docs/superpowers/specs/`

## Revert plan
1. Remove `--superpowers` flag parsing from `commands/spec-new.md` and `commands/plan-new.md`
2. Restore auto-detection: check if `docs/superpowers/specs` or `docs/superpowers/plans` exist and route there
3. Risks: silent misrouting returns in mixed-layout repos

## Follow-ups
- [ ] Verify other skills that consume specs/plans actually implement the dual-path read rule
