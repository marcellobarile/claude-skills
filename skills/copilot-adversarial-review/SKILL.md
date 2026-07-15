---
name: copilot-adversarial-review
description: Reviews a GitHub PR with the GitHub Copilot CLI (`copilot --allow-all-tools -s --prompt '/review'`) in an isolated git worktree, then iterates fixes locally with the user until findings converge, before a single push to the PR. Use when asked to run a Copilot review, an adversarial review, or a second-opinion review on a pull request, or when the user invokes /copilot-adversarial-review.
---

# copilot-adversarial-review

Runs the GitHub Copilot CLI as an independent reviewer against a PR, with Claude acting
only as *implementer* on Copilot's findings — never as a second, competing reviewer. The
reviewer/implementer dialogue happens entirely in a disposable local worktree; the real
PR only sees a single push at the end. This avoids a push → remote-comment → pull → fix
→ push cycle.

> **Output language.** Present findings, prompts, and summaries to the user in the
> user's own language, per the user's preferences or the surrounding instructions. Keep
> `copilot`/`gh`/`git` command output, file paths, and branch names unchanged.

## Step 0 — Precondition checks

Run every invocation (do not skip, do not assume from a prior session):

```bash
gh --version
```
Missing → stop: `Error: gh CLI not found. Install at https://cli.github.com`

```bash
gh auth status
```
Not authenticated → stop: `Error: not authenticated with GitHub. Run: gh auth login`

```bash
git --version
```
Missing → stop: `Error: git not found. Install git and retry.`

```bash
command -v copilot
```
Missing → stop:
```
Error: copilot CLI not found.
Install: npm install -g @github/copilot   (requires Node.js 22+)
Docs: https://docs.github.com/copilot/how-tos/set-up/install-copilot-cli
```

## Step 1 — Resolve the PR

Input: `$ARGUMENTS` (PR number or full GitHub PR URL, from the slash command) or the
user's message if invoked by description-match instead of the slash command.

1. Missing entirely → ask the user for a PR number or URL.
2. Full URL (`https://github.com/<owner>/<repo>/pull/<N>`) → extract `owner`, `repo`,
   `N` from it.
3. Bare number → `N` is that number; resolve `owner/repo` from the current checkout
   (this call takes no user-supplied input, safe to run before validation):
   ```bash
   gh repo view --json nameWithOwner -q .nameWithOwner
   ```
4. **Validate before interpolating `N`/`owner`/`repo` into any other command.** They are
   external input, substituted textually into `git`/`gh` command strings throughout this
   procedure — validate immediately after extraction (step 2/3), before anything else in
   this section runs a command that uses them:
   - `N` must match `^[0-9]+$` (a bare positive integer).
   - `owner` and `repo` (from a URL) must each match `^[A-Za-z0-9._-]+$`.
   - On failure: stop with an explicit error. Do not run any git/gh command with the
     unvalidated value.
5. If the resolved `owner/repo` does not match the current repo's checkout, refuse —
   do not clone another repo implicitly:
   ```
   This skill only reviews PRs of the current repo's checkout ("<origin-owner/repo>").
   Run it from a clone of <owner>/<repo> instead.
   ```
6. Only now, with `N` validated — resolve the PR's actual head branch name (needed later
   to push back correctly — the local worktree branch created in Step 2 is **not** the
   same ref):
   ```bash
   gh pr view <N> --json headRefName -q .headRefName
   ```
   Store this as `HEAD_REF` — but note (Step 3 below) that this value must be
   substituted literally into later commands, not referenced as a persisted `$HEAD_REF`
   shell variable.

## Step 2 — Isolated worktree

Never touch the user's current branch or uncommitted work. Also never `cd` the agent's
shell into the worktree — the Bash tool's working directory persists across calls in
this environment, so a bare `cd` would leave the agent's shell inside a directory that
Step 6 later deletes. Address every worktree-targeted command with an explicit
`-C "$WORKTREE_PATH"` (both `git` and `copilot` support this flag) — never ambient cwd.

**Variable scope: each Bash tool call is a separate shell process.** Only the working
directory persists between calls in this environment — environment variables do **not**.
`REPO_ROOT`, `REPO_NAME`, `WORKTREE_PATH`, and `REVIEW_BRANCH` are deterministic
functions of `N` and the repo root, so **recompute them at the top of every Bash call
that references them** — do not rely on a value set in an earlier call:

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
REPO_NAME="${REPO_ROOT##*/}"
WORKTREE_PATH="${REPO_ROOT%/*}/${REPO_NAME}-copilot-review-pr-<N>"
REVIEW_BRANCH="copilot-review/pr-<N>"
```

`HEAD_REF` (resolved once via the API call in Step 1, not deterministic from `N` alone)
has no such shortcut — substitute its already-resolved literal value directly into each
later command that needs it, rather than referencing a variable from a different call.

**Stale state check first** (a crashed prior run may have left residue). Anchored to
`$REPO_ROOT` via `-C`, consistent with the no-ambient-cwd rule:
```bash
[[ "$(git -C "$REPO_ROOT" worktree list)" == *"$WORKTREE_PATH"* ]] && git -C "$REPO_ROOT" worktree remove "$WORKTREE_PATH" --force
git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$REVIEW_BRANCH" && git -C "$REPO_ROOT" branch -D "$REVIEW_BRANCH"
```
(Both are safe no-ops if nothing is found — `&&` short-circuits when the check fails.)

**Create the worktree:**
```bash
git -C "$REPO_ROOT" fetch origin "pull/<N>/head:$REVIEW_BRANCH"
git -C "$REPO_ROOT" worktree add "$WORKTREE_PATH" "$REVIEW_BRANCH"
```

All remaining steps target `$WORKTREE_PATH` via explicit `-C`, never by changing the
agent's own working directory.

## Step 3 — Reviewer/implementer convergence loop

Initialize `iteration = 0`.

**3a. Reviewer step.** Targeting `$WORKTREE_PATH` via `-C`, launch via the Bash tool with
`run_in_background: true` (do not poll or sleep — you receive a completion
notification):
```bash
copilot -C "$WORKTREE_PATH" --allow-all-tools -s --prompt '/review' > "$WORKTREE_PATH/copilot-review-output.log" 2>&1
```

**3b. Read findings.** On completion, read `$WORKTREE_PATH/copilot-review-output.log`.
Copilot's output is free text, not structured JSON — interpret it yourself to extract
the list of actionable findings.

**3c. Zero findings** → loop converged. Go to Step 4.

**3d. Findings present** → present them to the user grouped by severity, each with your
proposed fix (standard "flag everything, propose fix, wait for OK" — do not silently
auto-apply anything beyond genuinely mechanical, unambiguous fixes). The user may
confirm all, some, or none.

**3e. Apply confirmed fixes** in `$WORKTREE_PATH`, then commit locally:
```bash
git -C "$WORKTREE_PATH" add -A
git -C "$WORKTREE_PATH" commit -m "<describe what was fixed, in imperative mood, English>"
```
If the user confirmed none of the findings, do not commit — treat this as a stop signal
and go to Step 5 (partial-push path; there may be zero fixes to push, which is fine —
still report the unresolved findings).

**3f. Increment `iteration`.**
- **`iteration` is a multiple of 5** (5, 10, 15, ...) → soft-cap checkpoint. Pause, show
  the user: fixes applied so far (commit count/summary), remaining findings, and the
  iteration count. Ask explicitly (use `AskUserQuestion`): continue iterating, or stop
  now.
  - **Stop** → go to Step 5.
  - **Continue** → go back to 3a. The next checkpoint fires at the following multiple
    of 5 — there is no single hard ceiling, but the user is asked again every 5
    iterations.
- **Not a multiple of 5** → go back to 3a.

## Step 4 — Push (converged path)

Findings reached zero.

1. Summarize what was fixed across all iterations.
2. Propose the push (standard confirm-before-push — pushing is a shared-state,
   hard-to-reverse action; do not push without explicit user confirmation):
   ```bash
   git -C "$WORKTREE_PATH" push origin "$REVIEW_BRANCH:<HEAD_REF>"
   ```
3. On confirmation, push. Then go to Step 6 (cleanup).

## Step 5 — Partial push + draft (soft-cap stop path)

The user chose to stop with findings still open (or confirmed zero fixes at 3e).

1. If there is anything to push, propose the push of whatever was fixed so far (same
   confirm-before-push gate):
   ```bash
   git -C "$WORKTREE_PATH" push origin "$REVIEW_BRANCH:<HEAD_REF>"
   ```
2. On confirmation (or if there was nothing to push), mark the PR as draft, unless it
   already is one:
   ```bash
   gh pr view <N> --json isDraft -q .isDraft
   ```
   If `false`:
   ```bash
   gh pr ready <N> --undo
   ```
3. Report the remaining findings clearly (verbatim from the last `copilot-review-output.log`)
   for the user's manual follow-up.
4. Go to Step 6 (cleanup).

## Step 6 — Cleanup

Always, on every exit path (converged, soft-cap stop, or hard failure in Step 3a). Both
commands target `$REPO_ROOT` explicitly via `-C` — the agent's shell never `cd`'d into
the worktree in the first place (Step 2), so there is no cwd to restore, but the
commands themselves must not implicitly depend on the current directory either:

```bash
git -C "$REPO_ROOT" worktree remove "$WORKTREE_PATH" --force
git -C "$REPO_ROOT" branch -D "$REVIEW_BRANCH"
```

## Error handling

- Any Step 0 precondition failure → stop before any repo mutation. No cleanup needed
  (nothing was created yet).
- PR belongs to a different repo than the current checkout (Step 1.5) → refuse, no
  clone, no worktree created.
- `copilot` exits non-zero during a reviewer step (3a) → show the captured
  `copilot-review-output.log` content, report the failure explicitly (never swallow it
  silently). Do not attempt a push with an unknown/failed review state. Ask the user how
  to proceed (retry the reviewer step, or abandon — abandoning still runs Step 6
  cleanup).
- The worktree construction (Step 2) never touches the user's current branch or
  uncommitted work by design — there is nothing to stash or restore.
