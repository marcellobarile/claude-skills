---
id: 2026-07-14-1234-copilot-adversarial-review-skill-local
date: 2026-07-14T12:34+0200
project: -Users-marcello.barile-src-mine-claude-skills
status: active
git_sha: 9e0ecb6
tags: []
---

# Replace single-pass Copilot review with a local reviewer/implementer convergence loop

## Context
Follow-up to [[2026-07-14-1225-copilot-adversarial-review-skill-pure]]. User asked to add
instructions so the "implementer" (Claude) and "reviewer" (Copilot CLI) dialogue happens
entirely locally, to avoid a push → remote-comment → pull → fix → push cycle against the
real PR.

## Decision
Turn the single Copilot review pass into a loop: Copilot reviews the worktree, Claude
proposes fixes for the findings (user confirms), applies confirmed fixes, then re-runs
Copilot on the updated worktree — repeating until zero findings. No fixed hard cap, but
iteration 5 is a decision checkpoint: pause and ask the user whether to continue or stop.
On stop-with-residual-findings, push the partial fixes and mark the PR draft
(`gh pr ready <N> --undo`) so it doesn't look falsely "ready." On clean convergence, do a
single confirmed push.

## Alternatives considered
- **Single-pass review** (original design) — dropped: doesn't address the user's stated goal of avoiding local/remote back-and-forth; findings would still require a separate local-fix-then-push-then-recheck cycle.
- **Hard iteration cap with silent stop** — dropped: could abandon a PR mid-fix without the user knowing why; a soft checkpoint that asks is safer.
- **Auto-apply all fixes without per-batch confirmation** — dropped: conflicts with the user's standing "propose fix, wait OK" preference for non-mechanical changes.

## Rationale
- Keeps the reviewer↔implementer dialogue inside one local worktree; the remote PR only sees a single push per stop condition, not one per iteration.
- The 5-iteration checkpoint surfaces runaway loops (fix reveals new findings repeatedly) to a human instead of looping indefinitely or silently giving up.
- Draft-marking on the stop path prevents a partially-fixed PR from being mistaken for reviewer-ready.

## Scope / Impact
- Files: `docs/superpowers/specs/2026-07-14-copilot-adversarial-review-design.md` (updated with §4-§6 loop/push/draft flow); future `skills/copilot-adversarial-review/SKILL.md`.
- Areas: same skill as [[2026-07-14-1225-copilot-adversarial-review-skill-pure]] — this decision extends, does not supersede, the "pure wrapper" framing (Claude still isn't running its own independent review, only acting as implementer on Copilot's findings).
- Downstream dependencies: implementation plan (`superpowers:writing-plans`) must implement the loop, the 5-iteration checkpoint, and `gh pr ready --undo` handling.

## Revert plan
1. Drop the loop, revert to single-pass review + one push — edit the spec's §4-§6 back to a linear flow.
2. Risks: none yet — precedes implementation; revert cost is spec edit only, no code to roll back.

## Follow-ups
- [x] `gh pr ready <N> --undo` verified against `gh pr ready --help` (gh 2.78.0) —
      correct current syntax.

Resolved during spec self-review: checkpoint recurs every 5 iterations (5, 10, 15, ...)
after a "continue" choice, not just once. Spec updated accordingly.
