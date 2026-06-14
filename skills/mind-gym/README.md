# mind-gym

Cognitive training agent for Claude Code. Proposes a puzzle calibrated to your profile and history, guides you Socratically (never spoiling the answer), then offers a transferable insight. Profile and history persist across sessions — difficulty and domain rotate automatically.

---

## What it does

Each session:
1. Loads your profile and history from `~/.claude/mind-gym/`
2. Picks a domain and difficulty level based on history (adaptive)
3. Generates a puzzle — commits the solution internally before showing you anything
4. Guides you with escalating hints if you're stuck
5. Verifies your answer (objectively for math/code, reasoned for logic/humanities)
6. Optionally offers a 1–2 line transferable insight
7. Updates history and recalibrates your level for that domain

---

## Trigger phrases

- "Give me a brain teaser"
- "I want a coding kata"
- "Train my brain"
- "I feel mentally rusty — challenge me"
- "Propose a logic puzzle"
- "Keep me sharp"

---

## Domains

| Domain | What it includes |
|---|---|
| `logic` | Deduction, lateral thinking, constraint puzzles |
| `math` | Numeric, algebraic, combinatorial |
| `programming` | Bug hunts, algorithm challenges, katas |
| `humanities` | Ethics, philosophy, etymology, verbal reasoning, writing |
| **Dynamic** | Inferred from your profile — e.g. `clinical reasoning` for a physician |

Dynamic domains are routed by heuristic from `references/domains.md` rather than force-fit into a base category.

---

## Tool routing

| Puzzle type | Where it runs |
|---|---|
| Logic, humanities, non-technical dynamic | Terminal (text exchange) |
| Math | Python via Bash — objective verification |
| Programming | Editor / REPL + runnable tests |

---

## Socratic ladder

Hints escalate only as needed:
1. Stimulus question ("What would you need to know to solve this?")
2. Nudge (reframe the problem)
3. Clue (one concrete hint)
4. Subproblem decomposition
5. Full solution (on explicit request or after 3 stuck attempts)

---

## Persistent state

Stored under `~/.claude/mind-gym/` (created on first use):

```
~/.claude/mind-gym/
├── profile.json      ← profession, interests, per-domain levels, preferences
└── history.jsonl     ← one record per puzzle (domain, difficulty, outcome, hash)
```

`profile.json` schema:
- `profession` / `interests` — text, used to infer dynamic domains
- `levels` — `{ "logic": 2, "math": 3, … }` — adaptive difficulty per domain
- `prefs` — `{ "sessionLength": 1, "tone": "…", "timeBudget": "…" }`

`history.jsonl` record:
```json
{ "date": "…", "domain": "logic", "difficulty": 2, "outcome": "solved", "attempts": 1, "hash": "a3f7c1" }
```

`outcome` values: `solved` | `partial` | `gave-up`. `hash` is a short stable hash of the puzzle statement — used to avoid re-proposing the same puzzle.

---

## Difficulty calibration

- Start from `levels[domain]` (default 2 if no history).
- After a fast solve: bump level up by 1.
- After getting stuck: bump level down by 1.
- Domains rotate across sessions for breadth; an explicit user request overrides rotation.

---

## Defaults

- Full solution after **3** stuck attempts (or on explicit request).
- Session length: **1** puzzle, then offer the next.

---

## Files

```
mind-gym/
├── SKILL.md
└── references/
    ├── domains.md   ← domain taxonomy + tool-routing heuristic
    └── tone.md      ← voice rules: no inflated praise, no lecturing, empathetic guidance
```
