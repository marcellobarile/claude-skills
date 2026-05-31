---
name: mind-gym
description: >
  Cognitive training against brain atrophy. Proposes a puzzle calibrated to the
  user's profile, guides the resolution empathetically with Socratic hints (never
  spoiling the answer), offers a transferable growth insight, and routes technical
  puzzles to the right tool (Python for math, REPL/editor + tests for programming)
  while keeping logic and humanistic puzzles in the terminal. USE when the user asks
  to train/exercise their brain or mind, wants a puzzle, riddle, brain teaser, kata,
  or cognitive workout, says they feel mentally rusty, or asks to "keep me sharp" /
  "give me a challenge" / "propose a problem to solve". Maintains a persistent
  profile and history under ~/.claude/mind-gym/ to adapt difficulty and rotate
  domains across sessions.
---

# mind-gym — Cognitive training

Propose a puzzle suited to the user, guide its resolution without spoiling it, then
offer a short transferable insight. It is a **persistent trainer**: profile and
history survive across sessions and drive adaptive difficulty and domain rotation.

> **Output language.** Present everything in the user's language, inferred from the
> conversation. Do not hardcode a default language.

## Persistent state

Stored under `~/.claude/mind-gym/` (create the directory on first use):

- `profile.json`
  - `profession` / `interests` — free text, used to infer dynamic domains.
  - `levels` — map `domain -> integer level` (1 = easy). Adaptive difficulty.
  - `prefs` — `{ "sessionLength": 1, "tone": "...", "timeBudget": "..." }`.
- `history.jsonl` — one JSON object per line per puzzle:
  `{ "date", "domain", "difficulty", "outcome", "attempts", "hash" }`
  where `outcome` is `solved` | `partial` | `gave-up` and `hash` is a short stable
  hash of the puzzle statement, used to avoid re-proposing the same puzzle.

Read these files directly. If missing, treat the profile as empty.

## Domain taxonomy (open)

Base domains: `logic` (deduction, lateral thinking), `math` (numeric/algebraic/
combinatorial), `programming` (bug-hunt, algorithms, katas), `humanities` (ethics,
philosophy, writing, etymology, verbal reasoning).

When the profile matches none of these (e.g. a physician), infer a relevant
**dynamic domain** at runtime (e.g. clinical reasoning) and route it by the
heuristic in `references/domains.md` — do not force-fit a base domain.

## Tool routing

Decide by one heuristic, not a fixed list (details in `references/domains.md`):

- **Conceptual / verbal** (logic, humanities, non-technical dynamic domains)
  → stay in the **terminal**.
- **Computational** (math, programming, technical dynamic domains) → **open the tool**:
  - math → Python via Bash (also used for objective verification).
  - programming → editor / REPL + runnable tests.

## Workflow

Run in order.

### 1. Load profile

Read `~/.claude/mind-gym/`. If the profile is missing or the context is unknown, ask
for: profession, domain of interest, level, time available. Offer to save it.

### 2. Pick domain + difficulty

- Difficulty: start from `levels[domain]` (default 2). Adapt from history.
- Rotate domains for breadth across sessions; honor an explicit user request.

### 3. Generate the puzzle with a hidden pre-commit

Before showing anything, fix internally the **solution + verification method**. Keep
them hidden. The puzzle must be well-formed: a single unambiguous answer that is
checkable. Skip any statement whose `hash` is already in `history.jsonl`.

### 4. Route the tool

Apply the routing heuristic. For math, prepare to verify with Python; for
programming, set up runnable tests.

### 5. Present the puzzle

State it clearly in the user's language. Do not reveal hints or the solution yet.

### 6. Guide (Socratic ladder)

Escalate only as needed: stimulus question → nudge → clue → subproblem → full
solution. Reveal the **full solution only on explicit request or after 3 stuck
attempts**. Follow the voice rules in `references/tone.md`.

### 7. Verify the answer

- Technical → run a script / tests (objective). For math, compute in Python.
- Conceptual → reasoned comparison against the pre-committed solution.

### 8. Growth insight (optional, not preachy)

Offer 1–2 lines linking the technique used to a transferable thinking pattern
("want a takeaway?"). Obey `references/tone.md`: no inflated praise, no lecturing,
no "you should have…".

### 9. Update state

Append a record to `history.jsonl`. Recalibrate `levels[domain]`: bump up on a fast
solve, down when the user got stuck. Persist `profile.json`.

### 10. Continue or close

Default session = 1 puzzle. Offer the next one or stop.

## Defaults

- Full solution after **3** stuck attempts (or on request).
- Session = **1** puzzle, then offer the next.
