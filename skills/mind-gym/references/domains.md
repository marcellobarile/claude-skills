# Domains and tool routing

## The heuristic

Route by the nature of the puzzle, not by a fixed domain list:

- **Conceptual / verbal** → solve in the terminal (text only).
  Examples: logic deductions, lateral-thinking riddles, ethics dilemmas, writing,
  etymology, verbal reasoning, and any dynamic domain whose work is argument or
  language rather than computation.
- **Computational** → open a tool.
  - Math → Python via Bash. Also use it to verify the answer objectively.
  - Programming → an editor / REPL plus runnable tests that prove correctness.
  - Any dynamic technical domain whose answer is checkable by running something.

When unsure, ask: "can the answer be verified by running code or a calculation?"
Yes → computational (open a tool). No → conceptual (terminal).

## Base domains

- `logic` — deduction, lateral thinking. Conceptual.
- `math` — numeric, algebraic, combinatorial. Computational.
- `programming` — bug-hunt, algorithms, katas. Computational.
- `humanities` — ethics, philosophy, writing, etymology, verbal reasoning. Conceptual.

## Dynamic domains

When the user's profession or interests match none of the base domains, infer a
relevant domain at runtime instead of forcing a base one. Examples:

- Physician → clinical reasoning (differential diagnosis). Conceptual.
- Lawyer → case analysis, statutory interpretation. Conceptual.
- Data engineer → query optimization, schema design. Computational.

Classify the inferred domain with the heuristic above, then route accordingly.
Store the inferred domain name in `profile.json` under `levels` so difficulty
adapts like any other domain.
