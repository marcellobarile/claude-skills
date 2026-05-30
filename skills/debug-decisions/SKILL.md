---
name: debug-decisions
description: Per-project tracking of architectural decisions made during Claude sessions. Registers decisions as versioned Markdown with revert plans, an INDEX, and an optional session-end reminder hook. Use when making or reviewing an architectural/approach decision, or when asked to record/list/revert a decision.
---

# debug-decisions

Track architectural / approach decisions per project, separate from git history.

## Commands

- `/decision <description>` — register a decision (flags: `--critical`, `--global`, `--tags a,b`).
- `/decision-list` — list decisions for the current project (`--critical` to filter).
- `/decision-show <id>` — view one decision in full.
- `/decision-revert <id>` — assisted revert with explicit confirmation at every step.
- `/decision-supersede <old-id> <description>` — supersede an old decision with a new one.

## Layout

- Code (scripts, schema, hook) lives in `~/.claude/skills/debug-decisions/`.
- Decision **data** lives in `~/.claude/debug-decisions/<slug>/` — one dir per project
  (slug = cwd with `/` → `-`), with an `INDEX.md` and one file per decision. `_global/` holds
  cross-project decisions.

## What counts as a decision

Only architectural / approach choices (e.g. "use file-per-decision instead of an append-only log").
Not file edits (git covers), destructive commands, or sub-agent spawns.

## Critical decisions

Tag `--critical` when irreversible, multi-team, security-relevant, or high blast radius. They allow
extended prose and get a `⚠` prefix in the INDEX.

## Stop hook

A `Stop` hook injects a retrospective reminder at session end if signals suggest an unregistered
decision. It never writes decision files — only ephemeral session state under `.state/`. Disable
via `.config.json`: `{ "stop_prompt": false }`.
