---
id: 2026-06-14-0909-readme-separato-da-skill-md
date: 2026-06-14T09:09+02:00
project: -Users-marcello.barile-src-mine-claude-skills
status: active
git_sha: aadd9e1
tags: [docs, skills]
---

# Separate README.md from SKILL.md in each skill

## Context

Skills had only `SKILL.md`, which serves as agent instructions loaded by Claude Code. No human-facing documentation existed. Adding READMEs required a decision on whether to keep a single file or split agent instructions from user docs.

## Decision

Keep `SKILL.md` as the agent-facing instruction document (loaded by Claude Code). Add a separate `README.md` per skill as the human-facing reference covering use cases, technical details, and file layout.

## Alternatives considered

- **Expand SKILL.md with a user-docs section** — dropped: SKILL.md is read by the agent at runtime; adding verbose human docs bloats the agent context unnecessarily.
- **Single README replacing SKILL.md** — dropped: Claude Code requires `SKILL.md` specifically for skill loading; renaming breaks the harness.

## Rationale

- Agent instructions and user documentation have different audiences and different verbosity needs.
- `SKILL.md` stays tight — agents parse it, token cost matters.
- `README.md` can be thorough — humans read it once, in a browser or editor.
- Standard OSS convention: every directory with a `README.md` is self-documenting in GitHub.

## Scope / Impact

- Files: `skills/*/README.md` (7 new files)
- Areas: skill documentation structure
- Downstream dependencies: any future skill should follow this two-file pattern

## Revert plan

1. Delete `skills/*/README.md` (7 files)
2. Risks: no human-facing docs remain; only agent instructions survive

## Follow-ups

- [ ] Add README authoring note to skill-creator skill or a contributing guide
