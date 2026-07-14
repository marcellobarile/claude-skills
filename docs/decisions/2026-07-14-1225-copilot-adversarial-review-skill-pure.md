---
id: 2026-07-14-1225-copilot-adversarial-review-skill-pure
date: 2026-07-14T12:25+0200
project: -Users-marcello.barile-src-mine-claude-skills
status: active
git_sha: 9e0ecb6
tags: []
---

# Design copilot-adversarial-review as a pure wrapper, worktree-isolated, background-run skill

## Context
Brainstorming a new skill, `copilot-adversarial-review`, that spawns a GitHub Copilot CLI
review (`copilot --allow-all-tools --prompt '/review'`) against a given PR, from within
this claude-skills repo. Several structural choices were resolved via user Q&A before
writing the design spec.

## Decision
Build the skill as a pure wrapper around the Copilot CLI (no Claude-side synthesis of
findings), using an isolated `git worktree` for the PR checkout, running Copilot in the
background with a completion notification, and always cleaning up the worktree afterward.

## Alternatives considered
- **Adversarial synthesis** (Claude runs its own review, cross-checks against Copilot's findings) — dropped: user wants a simple wrapper, not a merged/reconciled output.
- **Copilot-as-validator** (feed Claude's own findings to Copilot to confirm/refute) — dropped: same reason, adds complexity not wanted.
- **Direct checkout in current repo** (stash-and-restore) — dropped: worktree isolation keeps the user's working tree/branch untouched, safer under the git safety protocol.
- **Blocking foreground execution** — dropped: Copilot review can take minutes on large PRs; background + notify keeps the session responsive.
- **Leave worktree behind after review** — dropped: skill is one-shot; no reason to leave clutter.

## Rationale
- Matches the user's explicit request: a wrapper skill, not an adversarial merge process.
- Worktree isolation respects the git safety protocol (never touch uncommitted work).
- Background execution avoids blocking chat during long Copilot runs.
- Always-cleanup keeps repeated invocations idempotent, no orphaned worktrees/branches.

## Scope / Impact
- Files: `skills/copilot-adversarial-review/SKILL.md`, `skills/copilot-adversarial-review/commands/copilot-adversarial-review.md`, `skills/copilot-adversarial-review/setup.mjs`, `skills/copilot-adversarial-review/teardown.mjs` (not yet created — spec/plan pending)
- Areas: skill authoring, git worktree orchestration, external CLI (`copilot`) invocation
- Downstream dependencies: implementation plan (`superpowers:writing-plans`) will build against this design; design spec pending at `docs/superpowers/specs/2026-07-14-copilot-adversarial-review-design.md`

## Revert plan
1. If wrapper-only proves insufficient, add a synthesis step (Claude's own review + comparison against Copilot's) as a follow-up design iteration — no files to revert since implementation isn't written yet.
2. If worktree isolation proves too heavy, switch to direct checkout with stash-and-restore — revise the checkout steps in `SKILL.md`.
3. Risks: none yet — this decision precedes implementation; revert cost is only re-brainstorming, not code rollback.

## Follow-ups
- [ ] Write and get user approval on the design spec doc (`docs/superpowers/specs/2026-07-14-copilot-adversarial-review-design.md`)
- [ ] Confirm actual `copilot` CLI flags (`--allow-all-tools`, `--prompt`, `-s`) via `copilot help` once installed — docs didn't fully confirm them
- [ ] Implement via `superpowers:writing-plans` after spec approval
