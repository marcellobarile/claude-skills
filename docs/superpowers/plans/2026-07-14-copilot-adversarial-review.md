# copilot-adversarial-review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new Claude Code skill, `copilot-adversarial-review`, that reviews a GitHub PR with the GitHub Copilot CLI in an isolated git worktree, and locally iterates fixes with the user until findings converge — before ever pushing to the remote PR.

**Architecture:** A markdown-only skill (no dedicated script) following this repo's `sync-skills` / `spec-versioning` layout: `SKILL.md` carries the full procedure (both auto-trigger and `/copilot-adversarial-review` invocation read it), a thin `commands/copilot-adversarial-review.md` wires the slash command, and `setup.mjs`/`teardown.mjs` install/remove that command via the generic per-skill hook mechanism already used by `lib/setup.mjs`.

**Tech Stack:** Markdown (skill content), Node.js ESM (`setup.mjs`/`teardown.mjs`, matching the repo's existing `type: "module"` convention), `gh` CLi, `git`, `copilot` CLI (external, invoked by the agent executing the skill — not by any script in this repo).

## Global Constraints

- Design contract: `docs/superpowers/specs/2026-07-14-copilot-adversarial-review-design.md` — every task below implements a section of it; do not deviate without updating the spec first.
- Skill authoring rule (user's global CLAUDE.md): skills are self-contained — `SKILL.md` must never mention or depend on another skill by name.
- Output language rule (user's global CLAUDE.md): never hardcode a response language in the skill; it must present results in the user's language, inferred at runtime.
- Local commits per task are allowed (confirmed with the user during execution — required by the `subagent-driven-development` workflow for diff review and ledger recovery). **Never push**, under any circumstance — pushing is exclusively the user's action.
- No automated test suite for skill content — consistent with every sibling skill in this repo (`sync-skills`, `spec-versioning`, `memory-org` have none). `setup.mjs`/`teardown.mjs` follow the exact boilerplate already used by `spec-versioning` and `memory-org` (manual `readdirSync`/`copyFileSync` loop, no `lib/commands.mjs` helper — matches the established per-skill pattern, not the installer's internal lib).
- Confirmed external tool syntax (verified locally, not guessed): `copilot --allow-all-tools -s --prompt '/review'` (flags: `-p/--prompt` non-interactive, `--allow-all-tools` required for non-interactive mode, `-s/--silent` response-only output); `gh pr ready <N> --undo` (convert PR to draft).

---

### Task 1: `SKILL.md` — full procedure

**Files:**
- Create: `skills/copilot-adversarial-review/SKILL.md`

**Interfaces:**
- Consumes: nothing (entry point).
- Produces: the procedure that `commands/copilot-adversarial-review.md` (Task 2) points to. Downstream tasks assume this exact file exists at this exact path.

- [ ] **Step 1: Create the skill directory and write `SKILL.md`**

```bash
mkdir -p skills/copilot-adversarial-review/commands
```

Write `skills/copilot-adversarial-review/SKILL.md`:

````markdown
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
REPO_NAME="$(basename "$REPO_ROOT")"
WORKTREE_PATH="$(dirname "$REPO_ROOT")/${REPO_NAME}-copilot-review-pr-<N>"
REVIEW_BRANCH="copilot-review/pr-<N>"
```

`HEAD_REF` (resolved once via the API call in Step 1, not deterministic from `N` alone)
has no such shortcut — substitute its already-resolved literal value directly into each
later command that needs it, rather than referencing a variable from a different call.

**Stale state check first** (a crashed prior run may have left residue). Anchored to
`$REPO_ROOT` via `-C`, consistent with the no-ambient-cwd rule:
```bash
git -C "$REPO_ROOT" worktree list | grep -F "$WORKTREE_PATH" && git -C "$REPO_ROOT" worktree remove "$WORKTREE_PATH" --force
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
````

- [ ] **Step 2: Verify frontmatter parses correctly**

```bash
node -e "
const matter = require('gray-matter');
const fs = require('fs');
const { data } = matter(fs.readFileSync('skills/copilot-adversarial-review/SKILL.md', 'utf8'));
if (!data.name || !data.description) throw new Error('missing name/description in frontmatter');
console.log('OK:', data.name);
"
```
Expected output: `OK: copilot-adversarial-review`

- [ ] **Step 3: Commit** (run manually — do not run automatically per Global Constraints)

```bash
git add skills/copilot-adversarial-review/SKILL.md
git commit -m "feat(copilot-adversarial-review): add skill procedure"
```

---

### Task 2: Slash command wiring

**Files:**
- Create: `skills/copilot-adversarial-review/commands/copilot-adversarial-review.md`

**Interfaces:**
- Consumes: `skills/copilot-adversarial-review/SKILL.md` (Task 1) — points to it by absolute path `~/.claude/skills/copilot-adversarial-review/SKILL.md`, the install location `setup.mjs` (Task 3) copies into.
- Produces: the file `setup.mjs`/`teardown.mjs` (Task 3) install/remove by name (`copilot-adversarial-review.md`).

- [ ] **Step 1: Write the command file**

```markdown
---
allowed-tools: Bash(gh:*), Bash(git:*), Bash(copilot:*), Bash(command:*), Read, Write, Edit, Grep, Glob
description: Adversarial-review a PR with the GitHub Copilot CLI, iterating fixes locally before a single push
---

## Context

User invoked `/copilot-adversarial-review` with arguments: $ARGUMENTS

SKILL.md (full procedure): `~/.claude/skills/copilot-adversarial-review/SKILL.md`

## Your task

Read `~/.claude/skills/copilot-adversarial-review/SKILL.md` and follow it exactly, using
`$ARGUMENTS` as the PR number or URL input for Step 1.
```

Save to `skills/copilot-adversarial-review/commands/copilot-adversarial-review.md`.

- [ ] **Step 2: Verify frontmatter parses correctly**

```bash
node -e "
const matter = require('gray-matter');
const fs = require('fs');
const { data } = matter(fs.readFileSync('skills/copilot-adversarial-review/commands/copilot-adversarial-review.md', 'utf8'));
if (!data.description) throw new Error('missing description in frontmatter');
console.log('OK:', data.description);
"
```
Expected: prints the description line, no error.

- [ ] **Step 3: Commit** (run manually)

```bash
git add skills/copilot-adversarial-review/commands/copilot-adversarial-review.md
git commit -m "feat(copilot-adversarial-review): wire /copilot-adversarial-review command"
```

---

### Task 3: `setup.mjs` / `teardown.mjs`

**Files:**
- Create: `skills/copilot-adversarial-review/setup.mjs`
- Create: `skills/copilot-adversarial-review/teardown.mjs`

**Interfaces:**
- Consumes: called by the installer with `{ skillDir, claudeDir, log }` — same shape
  `test/setup.test.mjs`'s `loadSetup`/`loadTeardown` already exercises generically, and
  the same shape `spec-versioning`/`memory-org`'s `setup.mjs`/`teardown.mjs` use (copy
  this exact pattern, do not invent a new one).
- Produces: `~/.claude/commands/copilot-adversarial-review.md` on setup; removes it on
  teardown.

- [ ] **Step 1: Write `setup.mjs`**

```javascript
import { join } from "node:path";
import { mkdirSync, copyFileSync, readdirSync } from "node:fs";

export default async function setup({ skillDir, claudeDir, log }) {
  const src = join(skillDir, "commands");
  const dest = join(claudeDir, "commands");
  mkdirSync(dest, { recursive: true });
  for (const f of readdirSync(src).filter((n) => n.endsWith(".md"))) {
    copyFileSync(join(src, f), join(dest, f));
  }
  log.info("copilot-adversarial-review: command installed");
}
```

- [ ] **Step 2: Write `teardown.mjs`**

```javascript
import { join } from "node:path";
import { rmSync, existsSync, readdirSync } from "node:fs";

export default async function teardown({ skillDir, claudeDir, log }) {
  const src = join(skillDir, "commands");
  const dest = join(claudeDir, "commands");
  if (existsSync(src)) {
    for (const f of readdirSync(src).filter((n) => n.endsWith(".md"))) {
      const target = join(dest, f);
      if (existsSync(target)) rmSync(target);
    }
  }
  log.info("copilot-adversarial-review: command removed");
}
```

- [ ] **Step 3: Manual functional verification (temp dir, ad hoc — no permanent test file, matching `spec-versioning`/`memory-org` convention)**

```bash
node -e "
import('./skills/copilot-adversarial-review/setup.mjs').then(async (m) => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdd-'));
  const log = { info: console.log, warn: console.log, error: console.error };
  await m.default({ skillDir: path.resolve('skills/copilot-adversarial-review'), claudeDir, log });
  const installed = fs.existsSync(path.join(claudeDir, 'commands', 'copilot-adversarial-review.md'));
  console.log('installed:', installed);
  const t = await import('./skills/copilot-adversarial-review/teardown.mjs');
  await t.default({ skillDir: path.resolve('skills/copilot-adversarial-review'), claudeDir, log });
  const removed = !fs.existsSync(path.join(claudeDir, 'commands', 'copilot-adversarial-review.md'));
  console.log('removed:', removed);
});
"
```
Expected output:
```
copilot-adversarial-review: command installed
installed: true
copilot-adversarial-review: command removed
removed: true
```

- [ ] **Step 4: Run the existing repo test suite (regression check)**

```bash
npm test
```
Expected: all existing tests still pass (this task adds no new permanent test files, so
the count of passing tests is unchanged — only confirms nothing broke).

- [ ] **Step 5: Commit** (run manually)

```bash
git add skills/copilot-adversarial-review/setup.mjs skills/copilot-adversarial-review/teardown.mjs
git commit -m "feat(copilot-adversarial-review): add setup/teardown for command install"
```

---

### Task 4: `README.md` + final consistency sweep

**Files:**
- Create: `skills/copilot-adversarial-review/README.md`

**Interfaces:**
- Consumes: nothing (documentation only).
- Produces: nothing consumed by other tasks — this is the last task.

- [ ] **Step 1: Write `README.md`**

```markdown
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
```

- [ ] **Step 2: Artifact consistency sweep**

Check these invariants across all 5 files created in Tasks 1-4 (per user's global
CLAUDE.md "Artifact consistency sweep" rule):
- Skill name is spelled identically everywhere: `copilot-adversarial-review` (frontmatter
  `name:` in `SKILL.md`, directory name, command filename, README title).
- All shell command examples use the same variable names for the same things
  (`WORKTREE_PATH`, `REVIEW_BRANCH`, `HEAD_REF`, PR number as `<N>`) — no silent renames
  between `SKILL.md` and the command file.
- `setup.mjs`/`teardown.mjs` match the exact boilerplate shape of `spec-versioning`'s and
  `memory-org`'s, not `sync-skills`' (which has an extra `chmodSync` step this skill
  doesn't need — no script to mark executable).

Fix any mismatch found before moving on.

- [ ] **Step 3: Commit** (run manually)

```bash
git add skills/copilot-adversarial-review/README.md
git commit -m "docs(copilot-adversarial-review): add README"
```

---

## Manual end-to-end verification (not automated — requires a live GitHub PR)

This cannot be exercised by an implementing subagent without a real, disposable PR and
an authenticated Copilot subscription — consistent with the spec's "Testing /
verification: manual" section. After all 4 tasks are merged, the user should:

1. Open (or pick an existing) small PR in a repo they own.
2. Run `/copilot-adversarial-review <PR number>`.
3. Confirm: precondition checks fire correctly when a tool is temporarily renamed off
   `PATH`; the worktree appears under `git worktree list` during the run and is gone
   after; the loop actually re-invokes Copilot after a fix batch; the 5-iteration
   checkpoint pauses and asks rather than looping silently; push always asks for
   confirmation; draft-marking only fires on the stop-before-convergence path.
