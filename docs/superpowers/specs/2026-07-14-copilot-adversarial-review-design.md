# copilot-adversarial-review — design

## What is this file

Design spec for a new Claude Code skill, `copilot-adversarial-review`. Audience: whoever
implements or later modifies the skill. Owner: marcello.barile. Companion file: the
implementation plan (to be written by `superpowers:writing-plans` under
`docs/superpowers/plans/`), which covers task breakdown and build order — this spec is
the design contract (what it does and why).

## Purpose

Given a PR, spawn a GitHub Copilot CLI (`copilot`) review session
(`copilot --allow-all-tools --prompt '/review'`) against that PR's code, isolated from the
user's current working tree. Copilot acts as the **reviewer**; Claude (running the skill)
acts as the **implementer**: it reads Copilot's findings, proposes fixes, applies confirmed
fixes locally, and re-invokes Copilot until findings converge to zero (or a soft cap is
hit) — all before ever touching the remote PR. This avoids a push → remote-comment →
pull → fix → push cycle: the reviewer/implementer dialogue happens entirely in a local
worktree, with a single push at the end.

This is a **pure wrapper**: Claude never runs its own independent review and merges it
with Copilot's. Claude's only role on the findings themselves is *implementer* — applying
fixes Copilot flagged, with user confirmation — not a second, competing reviewer.

## File layout

Mirrors the `sync-skills` skill's structure:

```
skills/copilot-adversarial-review/
  SKILL.md
  commands/copilot-adversarial-review.md
  setup.mjs     # installs the slash command into ~/.claude/commands/
  teardown.mjs  # removes it
  README.md     # convention followed by every other skill in this repo (8/8)
```

No dedicated script (e.g. no `scripts/*.py`) — the skill is a sequence of shell
orchestration steps Claude executes directly via Bash, not a standalone program.

## Flow

### 1. Precondition checks

Run once per invocation (mirrors `sync-skills` Step 0 pattern — check, don't guess):

- `gh --version` — missing → error, stop: `gh CLI not found. Install at https://cli.github.com`
- `gh auth status` — not authenticated → error, stop: `not authenticated with GitHub. Run: gh auth login`
- `git --version` — missing → error, stop
- `command -v copilot` (or `copilot --version`) — missing → error, stop:
  ```
  copilot CLI not found. Install: npm install -g @github/copilot (requires Node.js 22+)
  Docs: https://docs.github.com/copilot/how-tos/set-up/install-copilot-cli
  ```

### 2. Resolve PR

`$ARGUMENTS` = PR number or full GitHub PR URL.

1. Missing → ask the user for it.
2. Full URL (`https://github.com/<owner>/<repo>/pull/<N>`) → extract owner/repo/number.
3. Bare number → assume current repo (resolved via `gh repo view` / `origin` — this call
   takes no user-supplied input, safe to run before validation).
4. **Validate before interpolating `N`/`owner`/`repo` into any other command.** They are
   external input, substituted textually into `git`/`gh` command strings throughout this
   flow — validate immediately after extraction (step 2/3), before anything else in this
   section runs a command that uses them:
   - `N` must match `^[0-9]+$` (a bare positive integer).
   - `owner` and `repo` (from a URL) must match `^[A-Za-z0-9._-]+$` each.
   - On failure: stop with an explicit error, do not attempt to run any git/gh command
     with the unvalidated value.
5. If the resolved owner/repo does not match the current repo's `origin` → refuse:
   "This skill only reviews PRs of the current repo's checkout. Run it from a clone of
   `<owner>/<repo>` instead." (No implicit cloning of arbitrary repos.)
6. Only now, with `N` validated — resolve and store the PR's actual head branch name:
   `gh pr view <N> --json headRefName -q .headRefName`. Needed later to push back to the
   correct remote branch (§5/§6) — the local worktree branch is named
   `copilot-review/pr-<N>`, which is not the same ref.

### 3. Worktree isolation

Never touch the user's current branch or uncommitted work. Also never `cd` the agent's
shell into the worktree — the Bash tool's working directory persists across calls in
this environment, so a bare `cd` would leave the agent's shell inside a directory that
Step 7 later deletes. Address every command that needs to run against the worktree with
an explicit `-C "$WORKTREE_PATH"` (`git` and `copilot` both support this flag) — never
ambient cwd.

**Variable scope: each Bash tool call is a separate shell process.** Only the working
directory persists between calls in this environment — environment variables and shell
functions do **not**. `REPO_ROOT`, `REPO_NAME`, `WORKTREE_PATH`, and `REVIEW_BRANCH` are
all deterministic functions of `<N>` and the repo root, so **recompute them at the top
of every Bash call that references them** (cheap, idempotent — do not rely on a value
set in an earlier call). `HEAD_REF` (resolved once via the API call in §2, not
deterministic from `<N>` alone) has no such shortcut: substitute its already-resolved
literal value directly into each later command that needs it, rather than referencing a
variable from a different call.

Every command below — including the stale-state check and the worktree creation itself
— is anchored to `$REPO_ROOT` explicitly via `-C`, consistent with that rule:

```bash
git -C "$REPO_ROOT" fetch origin pull/<N>/head:copilot-review/pr-<N>
git -C "$REPO_ROOT" worktree add ../<repo>-copilot-review-pr-<N> copilot-review/pr-<N>
```

All subsequent steps (review, fixes, commits) target this worktree via explicit `-C`,
never by changing the agent's own working directory.

### 4. Reviewer/implementer loop

Iteration counter starts at 0. Each iteration:

1. **Reviewer step** — targeting the worktree via `-C`, background-run:
   ```bash
   copilot -C "$WORKTREE_PATH" --allow-all-tools -s --prompt '/review' > "$WORKTREE_PATH/copilot-review-output.log" 2>&1
   ```
   via `run_in_background`; wait for the completion notification (no polling/sleep).
2. Claude reads `copilot-review-output.log`, extracts actionable findings (Copilot's
   output is free text, not structured — Claude interprets it).
3. **Zero findings** → loop ends, converged. Go to Push (§5).
4. **Findings present** → Claude presents them grouped in chat with proposed fixes
   (standard "flag everything, propose fix, wait OK" — no silent auto-apply for
   non-mechanical findings). User confirms all, some, or none.
5. Claude applies the confirmed fixes in the worktree, commits locally.
6. Increment iteration counter.
   - **Counter is a multiple of 5** (5, 10, 15, ...) → soft-cap red flag: pause, show
     current state (fixes applied so far, remaining findings, iteration count), ask the
     user explicitly: continue iterating, or stop now.
     - **User: stop** → go to §6 (partial push + draft).
     - **User: continue** → resume loop; the next checkpoint fires at the following
       multiple of 5 (no single hard ceiling, but the user is asked again every 5
       iterations rather than only once).
   - **Counter not a multiple of 5** → go back to step 1 (re-run Copilot on the updated
     worktree branch).

No fixed hard cap — every 5th iteration is a recurring decision checkpoint, not a one-time stop.

### 5. Push (convergence path)

Findings reached zero:

- Summarize what was fixed across iterations.
- Propose the push (standard confirm-before-push, since pushing is a shared-state,
  hard-to-reverse action): `git push origin copilot-review/pr-<N>:<headRefName>` (using
  the head branch name resolved in §2).
- On confirmation, push. Then cleanup (§7).

### 6. Partial push + draft (soft-cap stop path)

User chose to stop at the 5-iteration checkpoint with findings still open:

- Propose the push of whatever fixes were applied so far (same confirm-before-push
  gate), to `<headRefName>` resolved in §2.
- On confirmation, push, then mark the PR as draft: `gh pr ready <N> --undo` (only if
  not already draft) — signals to any human reviewers that it's not ready, avoiding
  confusion from a partially-fixed PR looking "done."
- Report the remaining findings clearly (verbatim from Copilot's last output) for manual
  follow-up.
- Cleanup (§7) regardless.

### 7. Cleanup

Always, on every exit path (converged, soft-cap stop, or hard failure). Both commands
run against `$REPO_ROOT` explicitly — the agent's shell never `cd`'d into the worktree
in the first place (§3), so there is no cwd to restore, but the commands themselves
must not implicitly depend on the current directory either:

```bash
git -C "$REPO_ROOT" worktree remove "$WORKTREE_PATH" --force
git -C "$REPO_ROOT" branch -D "$REVIEW_BRANCH"
```

## Error handling

- Missing `gh`/`git`/`copilot`, or `gh` unauthenticated → stop before any repo mutation
  (§1).
- PR belongs to a different repo than the current checkout → refuse, no clone (§2).
- `copilot` exits non-zero during a review pass → show the captured log/stderr, report
  the failure explicitly (no silent swallow), still run cleanup (§7). Do not attempt a
  push with an unknown/failed review state — ask the user how to proceed (retry,
  abandon).
- Any step that would discard uncommitted work is inherently avoided by construction
  (worktree never touches the user's current branch).

## Testing / verification

No automated test suite — this is a shell-orchestration skill, consistent with sibling
skills (`sync-skills` has none either). Verification is manual: run the skill against a
real PR in this repo (or another accessible repo) once implemented, and confirm:

- Precondition checks correctly block on missing tools.
- Worktree is created and always removed, on both the converged and soft-cap-stop paths.
- The loop actually re-invokes Copilot after fixes and terminates on zero findings.
- The 5-iteration checkpoint pauses and asks, rather than looping silently.
- Push always requires explicit confirmation; draft-marking only fires on the stop path.

## Open follow-ups

Both resolved during plan-writing, verified against locally installed tools
(`copilot` v. via `copilot --help`, `gh` 2.78.0 via `gh pr ready --help`):

- [x] `copilot` CLI flags confirmed: `-p, --prompt <text>` (non-interactive, exits after
      completion), `--allow-all-tools` ("required for non-interactive mode"), `-s,
      --silent` (response only, no stats — useful for scripting). The command in this
      spec (`copilot --allow-all-tools -s --prompt '/review'`) is valid syntax.
- [x] `gh pr ready <N> --undo` confirmed as the correct current syntax ("Convert a pull
      request to draft").
- [x] `copilot -C <directory>` confirmed via the locally installed binary's `--help`
      output: "Change working directory before doing anything else" — the load-bearing
      assumption behind §3/§4's explicit `-C` targeting is real, not guessed.
