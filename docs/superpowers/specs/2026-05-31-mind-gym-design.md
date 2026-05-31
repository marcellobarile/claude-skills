# mind-gym — Design

> **What is this file.** Design spec (implementation contract) for the `mind-gym`
> skill. Audience: the implementer of the skill. Owner: marcello.barile. No companion
> files yet; the implementation plan (writing-plans) will be derived from this.

## Purpose

A Claude Code skill against cognitive atrophy. On invocation it proposes a puzzle
calibrated to the user's profile, guides resolution empathetically (Socratic), offers
a transferable growth insight without being preachy, and routes to the right tool:
terminal for conceptual/verbal puzzles, opens a computational tool (Python, REPL,
editor + tests) for technical ones.

It is a **persistent trainer**: profile and history survive across sessions and drive
adaptive difficulty and domain rotation.

## Non-goals (YAGNI)

- No scores, streaks, badges, or gamification.
- No curated puzzle catalog — puzzles are model-generated.
- No web UI. Pure terminal + tool invocation.

Add any of these only on explicit request.

## Constraints

- **Self-contained skill files.** The produced `SKILL.md` and `references/*` must not
  mention or depend on any other skill by name. Conventions referenced in this spec
  (storage layout, output-language behavior) are to be inlined as plain rules in the
  skill, not as cross-skill references.
- **Output language inferred by the agent** — never hardcode a default language.

## Storage

Skill-owned data under `~/.claude/<skill>/`.

`~/.claude/mind-gym/`
- `profile.json`
  - `profession` / `interests` — free text, used to infer dynamic domains.
  - `levels` — map `domain -> integer level` (adaptive difficulty per domain).
  - `prefs` — default session length, preferred tone, default time budget.
- `history.jsonl` — one record per puzzle:
  - `date`, `domain`, `difficulty`, `outcome` (solved/partial/gave-up),
    `attempts`, `hash` (dedupe to avoid re-proposing the same puzzle).

The model reads/writes these files directly (JSON / JSON Lines). No helper script
needed for storage.

## Domain taxonomy (open)

Base domains:
- `logic` — deduction, lateral thinking.
- `math` — numeric / algebraic / combinatorial.
- `programming` — bug-hunt, algorithms, katas.
- `humanities` — ethics, philosophy, writing, etymology, verbal reasoning.

Plus **dynamic domains**: when the profile (e.g. a physician) matches none of the
base domains, infer a relevant domain at runtime (e.g. clinical reasoning) and route
by the technical-vs-conceptual heuristic below — do not force-fit a base domain.

## Tool routing (requirements c & d)

Decide by a single heuristic, not a fixed list:

- **Conceptual / verbal** (logic, humanities, non-technical dynamic domains)
  → stay in the **terminal**.
- **Computational** (math, programming, technical dynamic domains)
  → **open the tool**:
  - math → Python via Bash (also used for objective verification).
  - programming → editor / REPL + runnable tests.

## Workflow

1. **Load profile.** If missing or context unknown, ask: profession, domain of
   interest, level, time available. Offer to save the profile.
2. **Pick domain + difficulty.** Adaptive from history; rotate domains for breadth;
   honor an explicit user request when given.
3. **Generate puzzle with hidden pre-commit.** Before showing anything, the model
   fixes internally the *solution + verification method*. Never spoiled. Well-formed
   constraint: single unambiguous answer that is checkable.
4. **Route the tool** per the heuristic above.
5. **Present** the puzzle in the user's language (inferred by the agent; do not
   hardcode a default language).
6. **Socratic guidance ladder:** stimulus question → nudge → clue → subproblem →
   full solution. Full solution only on explicit request **or after 3 stuck
   attempts**. No spoilers ahead of the ladder.
7. **Verify the answer:**
   - technical → script / tests that actually run (objective).
   - conceptual → reasoned comparison against the pre-committed solution.
8. **Growth insight (requirement c), not preachy:** 1–2 lines linking the technique
   used to a transferable thinking pattern. Offered, not forced ("want a takeaway?").
   Tone rules live in `references/tone.md`: no inflated praise, no lecturing, no
   "you should have…".
9. **Update** profile + history: record outcome, recalibrate level (fast solve → up,
   stuck → down), mark the puzzle hash as seen.
10. **Offer the next puzzle or close.** Default session = 1 puzzle.

## Defaults

- Full solution after **3** stuck attempts (or on request).
- Session = **1** puzzle, then offer the next.

## Files to create

- `skills/mind-gym/SKILL.md` — frontmatter (`name`, `description` with strong trigger
  phrases) + the workflow above.
- `skills/mind-gym/references/tone.md` — voice rules for guidance and growth insights.
- `skills/mind-gym/references/domains.md` — routing heuristic and how to infer
  dynamic domains from the profile.

> Note: the README catalog renderer (`scripts/gen-readme.mjs`) pulls the description
> from `SKILL.md` frontmatter; run `npm run docs` after the skill lands. `npm test`
> validates the installer against the skill set.

No generation script (puzzles are model-generated); math verification is ad-hoc
Python via Bash.

## Open questions

None blocking. README catalog table to be regenerated (`npm run docs`) after the
skill lands.
