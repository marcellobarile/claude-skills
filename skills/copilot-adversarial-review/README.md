# copilot-adversarial-review

Reviews a GitHub PR with the GitHub Copilot CLI (`copilot --allow-all-tools -s --prompt
'/review'`) in an isolated git worktree, then iterates fixes locally with the user until
findings converge — before a single push to the PR. Avoids a push → remote-comment →
pull → fix → push cycle by keeping the whole reviewer/implementer dialogue local.

---

## What it does

1. Checks `gh`, `git`, and `copilot` are installed and `gh` is authenticated.
2. Resolves the target PR (number or URL) and its head branch.
3. Creates an isolated `git worktree` for the PR — never touches your current branch or
   uncommitted work.
4. Runs Copilot as reviewer, Claude as implementer: Copilot flags findings, Claude
   proposes fixes, you confirm, Claude applies and commits, Copilot re-reviews. Repeats
   until zero findings, checking in with you every 5 iterations.
5. On convergence: a single confirmed push to the PR's branch.
6. If you stop before convergence: pushes whatever was fixed, marks the PR as draft
   (`gh pr ready <N> --undo`), and reports the remaining findings for manual follow-up.
7. Always cleans up the worktree.

---

## Command

| Command | What it does |
|---|---|
| `/copilot-adversarial-review <PR number or URL>` | Run the full review/fix loop against that PR |

---

## Requirements

- `gh` CLI, authenticated (`gh auth status`)
- `git`
- `copilot` CLI — `npm install -g @github/copilot` (Node.js 22+), then authenticate

---

## Design

Full design rationale: `docs/superpowers/specs/2026-07-14-copilot-adversarial-review-design.md`.
