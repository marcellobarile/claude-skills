# Shareable Safetynet Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish three personal Claude Code "safetynet" conventions (`memory-org`, `debug-decisions`, `spec-versioning`) as shareable, generalized skills in the `claude-skills` catalog, with an installer that wires each skill's commands/hooks.

**Architecture:** The existing installer copies `skills/<name>/` → `~/.claude/skills/<name>/`. We add two pure `lib/` helpers (`settings.mjs`, `commands.mjs`) and a per-skill `setup.mjs` convention: after copying a skill, the installer runs the skill's own `setup.mjs` (on user confirm) to wire slash commands and hooks. Each skill is self-contained; only `debug-decisions` needs hook wiring.

**Tech Stack:** Node.js ESM, `node:test`, `@clack/prompts`, `gray-matter`, POSIX shell (debug-decisions scripts).

**Spec:** `docs/superpowers/specs/2026-05-30-shareable-safetynet-skills-design.md`

**Source files to port (exist on the author's machine):**
- `~/.claude/commands/decision*.md` (5 files)
- `~/.claude/debug-decisions/.bin/*.sh` (6 scripts) and `.bin/tests`
- `~/.claude/debug-decisions/.schema/{decision-template.md,INDEX-skeleton.md}`
- `~/.claude/debug-decisions/.config.json`
- `~/.claude/hooks/decisions-stop-prompt.js`

---

## File Structure

```
lib/
  settings.mjs          # NEW: safe read/merge/write of ~/.claude/settings.json
  commands.mjs          # NEW: copy slash-command .md files into ~/.claude/commands/
  setup.mjs             # NEW: load a skill's setup.mjs (or null)
bin/
  install.mjs           # MODIFY: run skill setup.mjs after copy
test/
  settings.test.mjs     # NEW
  commands.test.mjs     # NEW
  setup.test.mjs        # NEW
skills/
  memory-org/
    SKILL.md
    setup.mjs
    scripts/setup-project-memory.sh
    commands/memory-setup.md
  spec-versioning/
    SKILL.md
    setup.mjs
    commands/{spec-new.md,plan-new.md}
    templates/{spec-template.md,plan-template.md}
    references/spec-writing-rules.md
  debug-decisions/
    SKILL.md
    setup.mjs
    commands/{decision,decision-list,decision-show,decision-revert,decision-supersede}.md
    .bin/*.sh
    .bin/tests
    .schema/{decision-template.md,INDEX-skeleton.md}
    .config.json
    hooks/decisions-stop-prompt.js
```

---

## Task 1: `lib/settings.mjs` — safe settings.json merge

**Files:**
- Create: `lib/settings.mjs`
- Test: `test/settings.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
// test/settings.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSettings, hookExists, addHook, writeSettings } from "../lib/settings.mjs";

function tmp() { return mkdtempSync(join(tmpdir(), "settings-")); }
const HOOK = { type: "command", command: "node /x/hook.js", timeout: 10 };

test("readSettings returns {} when file missing", () => {
  assert.deepEqual(readSettings(join(tmp(), "nope.json")), {});
});

test("readSettings throws on malformed JSON", () => {
  const p = join(tmp(), "settings.json");
  writeFileSync(p, "{ not json");
  assert.throws(() => readSettings(p), /Malformed/);
});

test("addHook adds a Stop hook group", () => {
  const next = addHook({}, "Stop", HOOK);
  assert.equal(next.hooks.Stop.length, 1);
  assert.deepEqual(next.hooks.Stop[0].hooks[0], HOOK);
});

test("addHook is idempotent on identical command", () => {
  const once = addHook({}, "Stop", HOOK);
  const twice = addHook(once, "Stop", HOOK);
  assert.equal(twice.hooks.Stop.length, 1);
});

test("addHook preserves unknown keys and other events", () => {
  const base = { model: "opus", hooks: { PreToolUse: [{ hooks: [] }] } };
  const next = addHook(base, "Stop", HOOK);
  assert.equal(next.model, "opus");
  assert.equal(next.hooks.PreToolUse.length, 1);
  assert.equal(next.hooks.Stop.length, 1);
});

test("hookExists detects a registered command", () => {
  const next = addHook({}, "Stop", HOOK);
  assert.equal(hookExists(next, "Stop", HOOK.command), true);
  assert.equal(hookExists(next, "Stop", "other"), false);
});

test("writeSettings backs up an existing file and writes 2-space JSON", () => {
  const dir = tmp();
  const p = join(dir, "settings.json");
  writeFileSync(p, JSON.stringify({ old: true }));
  writeSettings(p, { new: true });
  const written = readFileSync(p, "utf8");
  assert.equal(written, JSON.stringify({ new: true }, null, 2) + "\n");
  const backups = readdirSync(dir).filter((f) => f.startsWith("settings.json.bak."));
  assert.equal(backups.length, 1);
});

test("writeSettings skips backup when no prior file", () => {
  const dir = tmp();
  const p = join(dir, "settings.json");
  writeSettings(p, { a: 1 });
  assert.ok(existsSync(p));
  assert.equal(readdirSync(dir).filter((f) => f.includes(".bak.")).length, 0);
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `node --test test/settings.test.mjs`
Expected: FAIL — `Cannot find module '../lib/settings.mjs'`.

- [ ] **Step 3: Implement `lib/settings.mjs`**

```js
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";

/** Read settings.json, returning {} if absent. Throws on malformed JSON. */
export function readSettings(path) {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Malformed settings.json at ${path}: ${err.message}`);
  }
}

/** True if a hook with the same command is already registered for the event. */
export function hookExists(settings, event, command) {
  const groups = settings.hooks?.[event] ?? [];
  return groups.some((g) => (g.hooks ?? []).some((h) => h.command === command));
}

/** Return a new settings object with the hook added. Idempotent on command. */
export function addHook(settings, event, hookDef) {
  const next = structuredClone(settings);
  next.hooks ??= {};
  next.hooks[event] ??= [];
  if (hookExists(next, event, hookDef.command)) return next;
  next.hooks[event].push({ hooks: [hookDef] });
  return next;
}

/** Write settings, backing up any existing file to settings.json.bak.<timestamp>. */
export function writeSettings(path, settings) {
  if (existsSync(path)) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    copyFileSync(path, `${path}.bak.${ts}`);
  }
  writeFileSync(path, JSON.stringify(settings, null, 2) + "\n");
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `node --test test/settings.test.mjs`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/settings.mjs test/settings.test.mjs
git commit -m "feat: add safe settings.json merge helper"
```

---

## Task 2: `lib/commands.mjs` — install slash commands

**Files:**
- Create: `lib/commands.mjs`
- Test: `test/commands.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
// test/commands.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installCommands } from "../lib/commands.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "cmds-"));
  const src = join(root, "commands");
  const dest = join(root, "dest");
  mkdirSync(src, { recursive: true });
  writeFileSync(join(src, "a.md"), "A");
  writeFileSync(join(src, "b.md"), "B");
  writeFileSync(join(src, "ignore.txt"), "x");
  return { src, dest };
}

test("installCommands copies only .md files and creates dest", () => {
  const { src, dest } = fixture();
  const res = installCommands(src, dest);
  assert.deepEqual(res.installed.sort(), ["a.md", "b.md"]);
  assert.ok(existsSync(join(dest, "a.md")));
  assert.ok(!existsSync(join(dest, "ignore.txt")));
});

test("installCommands overwrites by default", () => {
  const { src, dest } = fixture();
  mkdirSync(dest, { recursive: true });
  writeFileSync(join(dest, "a.md"), "OLD");
  installCommands(src, dest);
  assert.equal(readFileSync(join(dest, "a.md"), "utf8"), "A");
});

test("installCommands skips existing when overwrite=false", () => {
  const { src, dest } = fixture();
  mkdirSync(dest, { recursive: true });
  writeFileSync(join(dest, "a.md"), "OLD");
  const res = installCommands(src, dest, { overwrite: false });
  assert.deepEqual(res.skipped, ["a.md"]);
  assert.equal(readFileSync(join(dest, "a.md"), "utf8"), "OLD");
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `node --test test/commands.test.mjs`
Expected: FAIL — `Cannot find module '../lib/commands.mjs'`.

- [ ] **Step 3: Implement `lib/commands.mjs`**

```js
import { mkdirSync, copyFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Copy every .md command file from srcDir into destDir.
 * Returns { installed: string[], skipped: string[] }.
 */
export function installCommands(srcDir, destDir, { overwrite = true } = {}) {
  mkdirSync(destDir, { recursive: true });
  const files = readdirSync(srcDir).filter((f) => f.endsWith(".md"));
  const result = { installed: [], skipped: [] };
  for (const f of files) {
    const dest = join(destDir, f);
    if (existsSync(dest) && !overwrite) {
      result.skipped.push(f);
      continue;
    }
    copyFileSync(join(srcDir, f), dest);
    result.installed.push(f);
  }
  return result;
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `node --test test/commands.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/commands.mjs test/commands.test.mjs
git commit -m "feat: add slash-command installer helper"
```

---

## Task 3: `lib/setup.mjs` — load a skill's setup module

**Files:**
- Create: `lib/setup.mjs`
- Test: `test/setup.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
// test/setup.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSetup } from "../lib/setup.mjs";

function skillDir(withSetup) {
  const dir = mkdtempSync(join(tmpdir(), "skill-"));
  if (withSetup) {
    writeFileSync(join(dir, "setup.mjs"), "export default async () => 'ran';\n");
  }
  return dir;
}

test("loadSetup returns null when no setup.mjs", async () => {
  assert.equal(await loadSetup(skillDir(false)), null);
});

test("loadSetup returns the default export function", async () => {
  const fn = await loadSetup(skillDir(true));
  assert.equal(typeof fn, "function");
  assert.equal(await fn({}), "ran");
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `node --test test/setup.test.mjs`
Expected: FAIL — `Cannot find module '../lib/setup.mjs'`.

- [ ] **Step 3: Implement `lib/setup.mjs`**

```js
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Load a skill's setup.mjs default export, or null if the skill has none.
 * The default export is `async ({ skillDir, claudeDir, log }) => void`.
 */
export async function loadSetup(skillDir) {
  const setupPath = join(skillDir, "setup.mjs");
  if (!existsSync(setupPath)) return null;
  const mod = await import(pathToFileURL(setupPath).href);
  return mod.default ?? null;
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `node --test test/setup.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/setup.mjs test/setup.test.mjs
git commit -m "feat: add skill setup.mjs loader"
```

---

## Task 4: Wire setup into the installer

**Files:**
- Modify: `bin/install.mjs`

- [ ] **Step 1: Add imports**

In `bin/install.mjs`, after the existing `import { discoverSkills, copySkill } from "../lib/skills.mjs";` line, add:

```js
import { loadSetup } from "../lib/setup.mjs";

const CLAUDE_DIR = join(homedir(), ".claude");
```

- [ ] **Step 2: Run skill setup after copy**

In the install loop, immediately after the existing `copySkill(skill.dir, dest);` / `log.success(...)` / `installed++;` block (before the loop continues), insert:

```js
    const setup = await loadSetup(dest);
    if (setup) {
      const runIt = await confirm({
        message: `Run setup for "${skill.name}"? (wires commands/hooks)`,
        initialValue: true,
      });
      if (isCancel(runIt)) bail();
      if (runIt) {
        try {
          await setup({ skillDir: dest, claudeDir: CLAUDE_DIR, log });
          log.success(`Wired: ${skill.name}`);
        } catch (err) {
          log.error(`Setup failed for ${skill.name}: ${err.message}`);
        }
      }
    }
```

- [ ] **Step 3: Manual smoke test**

Run: `node bin/install.mjs`
Expected: wizard lists skills; selecting a skill with a `setup.mjs` prompts "Run setup for ...". Cancel out without selecting destructive targets. (No automated test — CLI is prompt-driven; `lib/setup.mjs` carries the unit coverage.)

- [ ] **Step 4: Commit**

```bash
git add bin/install.mjs
git commit -m "feat: run per-skill setup.mjs after install"
```

---

## Task 5: `spec-versioning` skill

**Files:**
- Create: `skills/spec-versioning/SKILL.md`
- Create: `skills/spec-versioning/templates/spec-template.md`
- Create: `skills/spec-versioning/templates/plan-template.md`
- Create: `skills/spec-versioning/commands/spec-new.md`
- Create: `skills/spec-versioning/commands/plan-new.md`
- Create: `skills/spec-versioning/references/spec-writing-rules.md`
- Create: `skills/spec-versioning/setup.mjs`

- [ ] **Step 1: Write `SKILL.md`**

```markdown
---
name: spec-versioning
description: Convention for where design specs and implementation plans live in a repo (docs/specs and docs/plans), with /spec-new and /plan-new scaffolding commands. Use when creating a spec or plan, or organizing project design docs.
---

# spec-versioning

Keep design specs and implementation plans as versioned, repo-scoped Markdown.

## Convention

- Specs → `<repo>/docs/specs/YYYY-MM-DD-<topic>-design.md`
- Plans → `<repo>/docs/plans/YYYY-MM-DD-<feature>.md`

These are repo-scoped on purpose: they version with the code and travel in PRs.

### Opt-in: superpowers layout

If you use the superpowers plugin, set the path prefix to `docs/superpowers/` so specs land in
`docs/superpowers/specs/` and plans in `docs/superpowers/plans/`. The `/spec-new` and `/plan-new`
commands read an optional `SPEC_DIR` / `PLAN_DIR` override; default is the neutral layout above.

## Commands

- `/spec-new <topic>` — scaffold a dated spec from `templates/spec-template.md`.
- `/plan-new <feature>` — scaffold a dated plan from `templates/plan-template.md`.

## Writing quality

See `references/spec-writing-rules.md` for optional content rules (delivery-slice naming,
PoC-vs-delivered status terms, acronym expansion, "what is this file" header).
```

- [ ] **Step 2: Write `templates/spec-template.md`**

```markdown
> **What is this file.** Design spec for <topic>.
> **Audience:** implementer and future maintainers.
> **Owner:** <owner>.
> **Companion files:** the implementation plan in `docs/plans/`.

# <Topic>

## Goal

<One paragraph: what this builds and why.>

## Scope (locked)

- <Decision 1>

## Architecture

<Components, boundaries, data flow.>

## Testing

<What gets tested and how.>

## Error handling

<Failure modes and responses.>

## Deliverable

<What ships.>
```

- [ ] **Step 3: Write `templates/plan-template.md`**

```markdown
# <Feature> Implementation Plan

**Goal:** <one sentence>

**Architecture:** <2-3 sentences>

**Tech Stack:** <key tech>

---

## Task 1: <Component>

**Files:**
- Create: `path`
- Test: `path`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run it, verify it fails**
- [ ] **Step 3: Minimal implementation**
- [ ] **Step 4: Run it, verify it passes**
- [ ] **Step 5: Commit**
```

- [ ] **Step 4: Write `commands/spec-new.md`**

```markdown
---
allowed-tools: Bash(date:*), Bash(mkdir:*), Read, Write
description: Scaffold a dated design spec into docs/specs (or $SPEC_DIR)
---

## Context

User invoked `/spec-new` with arguments: $ARGUMENTS

Today (ISO date):
!`date +%Y-%m-%d`

## Your task

1. Treat `$ARGUMENTS` as the topic. Kebab-case it for the filename.
2. Target directory: `docs/specs` unless the repo already uses `docs/superpowers/specs`
   (check with the Read/Glob tools) — if so, use that.
3. Create the directory if missing.
4. Copy `~/.claude/skills/spec-versioning/templates/spec-template.md` into
   `<dir>/<date>-<topic-kebab>-design.md`, replacing `<topic>` and `<owner>` placeholders.
5. Tell the user the path. Do not commit.
```

- [ ] **Step 5: Write `commands/plan-new.md`**

```markdown
---
allowed-tools: Bash(date:*), Bash(mkdir:*), Read, Write
description: Scaffold a dated implementation plan into docs/plans (or $PLAN_DIR)
---

## Context

User invoked `/plan-new` with arguments: $ARGUMENTS

Today (ISO date):
!`date +%Y-%m-%d`

## Your task

1. Treat `$ARGUMENTS` as the feature name. Kebab-case it for the filename.
2. Target directory: `docs/plans` unless the repo already uses `docs/superpowers/plans` — if so,
   use that.
3. Create the directory if missing.
4. Copy `~/.claude/skills/spec-versioning/templates/plan-template.md` into
   `<dir>/<date>-<feature-kebab>.md`, replacing `<feature>` placeholders.
5. Tell the user the path. Do not commit.
```

- [ ] **Step 6: Write `references/spec-writing-rules.md`** (de-personalized)

```markdown
# Spec & plan writing rules (optional)

- **Delivery slices.** When splitting an epic into deliverable chunks, name them `Slice 1` /
  `Slice 2`. Avoid `Branch` (git-overloaded) and `Part` (vaguer).
- **Status terms distinguish PoC from delivered.** Reserve `Implemented` / `Shipped` / `Delivered`
  for behavior merged to production and available to users. For prototypes use
  `PoC implemented (not delivered)`, `Placeholder (not delivered)`, or `Fail-fast stub (not
  delivered)`. Include a one-line legend when first used.
- **No bare acronyms.** Expand on first use or add a glossary. Prefer canonical API names over
  invented shorthand. Spell out algorithm terms (e.g. "depth-first search (DFS)") on first use.
- **"What is this file" header.** Open every spec/plan with a blockquote stating file purpose,
  audience, owner, and its relationship to companion files.
- **Unsourced roadmap/availability claims** must be linked to a source or marked
  `(assumption — confirmed with <name>, <YYYY-MM-DD>)`.
```

- [ ] **Step 7: Write `setup.mjs`**

```js
import { join } from "node:path";
import { installCommands } from "../../lib/commands.mjs";

export default async function setup({ skillDir, claudeDir, log }) {
  const res = installCommands(join(skillDir, "commands"), join(claudeDir, "commands"));
  log.info(`spec-versioning: installed commands ${res.installed.join(", ")}`);
}
```

> Note: when installed, the skill lives at `~/.claude/skills/spec-versioning/`, so the relative
> `../../lib/commands.mjs` import will not resolve. To keep `setup.mjs` self-contained, inline the
> copy logic instead of importing from `lib`:

```js
import { join } from "node:path";
import { mkdirSync, copyFileSync, existsSync, readdirSync } from "node:fs";

export default async function setup({ skillDir, claudeDir, log }) {
  const src = join(skillDir, "commands");
  const dest = join(claudeDir, "commands");
  mkdirSync(dest, { recursive: true });
  for (const f of readdirSync(src).filter((n) => n.endsWith(".md"))) {
    copyFileSync(join(src, f), join(dest, f));
  }
  log.info("spec-versioning: commands installed");
}
```

Use the **second (inlined)** version. Delete the first.

- [ ] **Step 8: Verify catalog discovery**

Run: `node -e "import('./lib/skills.mjs').then(m => console.log(m.discoverSkills().map(s => s.name)))"`
Expected: array includes `spec-versioning`.

- [ ] **Step 9: Commit**

```bash
git add skills/spec-versioning
git commit -m "feat: add spec-versioning skill"
```

---

## Task 6: `memory-org` skill

**Files:**
- Create: `skills/memory-org/SKILL.md`
- Create: `skills/memory-org/scripts/setup-project-memory.sh`
- Create: `skills/memory-org/commands/memory-setup.md`
- Create: `skills/memory-org/setup.mjs`

- [ ] **Step 1: Write `SKILL.md`** (generalized from `~/.claude/memory-org.md`)

```markdown
---
name: memory-org
description: Convention for where Claude memories live — repo-scoped project memories in docs/memory (git-tracked, symlinked into ~/.claude) vs generic memories in ~/.claude/CLAUDE.md. Use when saving a memory, organizing project memory, or setting up per-project memory.
---

# memory-org

Decide where a memory belongs and wire repo-scoped memory so Claude finds it and git tracks it.

## Where memories live

- **Project-specific** (architecture, project context, project-specific feedback, specs) →
  `<repo>/docs/memory/`, symlinked from `~/.claude/projects/<slug>/memory/`.
- **Generic / cross-project** (your role, general coding prefs, response style) → `~/.claude/CLAUDE.md`.

## Decision rule

1. Specific to this project only? → `<repo>/docs/memory/`, update its `MEMORY.md` index.
2. Applies across all projects? → `~/.claude/CLAUDE.md`. No separate file.

## Exception — shared/work monorepos

In repos where you must not commit Claude artifacts, keep memories in
`~/.claude/projects/<slug>/memory/` only (not git-tracked).

## Setup

`/memory-setup` (or `scripts/setup-project-memory.sh <repo> <slug>`) creates `<repo>/docs/memory/`,
moves any existing memories out of `~/.claude/projects/<slug>/memory/`, and symlinks them back.
```

- [ ] **Step 2: Write `scripts/setup-project-memory.sh`** (generalized, idempotent)

```bash
#!/usr/bin/env bash
# Wire repo-scoped project memory: <repo>/docs/memory symlinked from
# ~/.claude/projects/<slug>/memory. Idempotent.
# Usage: setup-project-memory.sh <repo-path> <project-slug>
set -euo pipefail

repo="${1:?Usage: setup-project-memory.sh <repo-path> <project-slug>}"
slug="${2:?Usage: setup-project-memory.sh <repo-path> <project-slug>}"

repo_mem="$repo/docs/memory"
proj_mem="$HOME/.claude/projects/$slug/memory"

mkdir -p "$repo_mem"

# If the project memory is already the symlink we want, done.
if [[ -L "$proj_mem" ]]; then
  echo "Already linked: $proj_mem -> $(readlink "$proj_mem")"
  exit 0
fi

# Move any existing real memory files into the repo, then replace with a symlink.
if [[ -d "$proj_mem" ]]; then
  shopt -s dotglob nullglob
  files=("$proj_mem"/*)
  if (( ${#files[@]} )); then
    mv "${files[@]}" "$repo_mem/"
  fi
  shopt -u dotglob nullglob
  rmdir "$proj_mem"
fi

mkdir -p "$(dirname "$proj_mem")"
ln -s "$repo_mem" "$proj_mem"
echo "Linked: $proj_mem -> $repo_mem"
```

- [ ] **Step 3: Make the script executable and smoke-test it**

```bash
chmod +x skills/memory-org/scripts/setup-project-memory.sh
tmp=$(mktemp -d); HOME_BAK="$HOME"
skills/memory-org/scripts/setup-project-memory.sh "$tmp/repo" "smoke-slug"
ls -la "$HOME/.claude/projects/smoke-slug/memory"
```

Expected: prints `Linked: .../smoke-slug/memory -> .../repo/docs/memory`; the path is a symlink.
Clean up: `rm -rf "$tmp" "$HOME/.claude/projects/smoke-slug"`.

- [ ] **Step 4: Write `commands/memory-setup.md`**

```markdown
---
allowed-tools: Bash(~/.claude/skills/memory-org/scripts/setup-project-memory.sh:*), Bash(git:*), Bash(pwd:*)
description: Wire repo-scoped project memory (docs/memory symlinked into ~/.claude)
---

## Context

Current repo root:
!`git rev-parse --show-toplevel 2>/dev/null || pwd`

## Your task

1. Derive the project slug the way Claude Code does: the absolute repo path with `/` replaced by `-`.
2. Run `~/.claude/skills/memory-org/scripts/setup-project-memory.sh "<repo-root>" "<slug>"`.
3. Report the resulting symlink to the user. Do not commit.
```

- [ ] **Step 5: Write `setup.mjs`** (inlined copy, same pattern as Task 5)

```js
import { join } from "node:path";
import { mkdirSync, copyFileSync, readdirSync, chmodSync } from "node:fs";

export default async function setup({ skillDir, claudeDir, log }) {
  const src = join(skillDir, "commands");
  const dest = join(claudeDir, "commands");
  mkdirSync(dest, { recursive: true });
  for (const f of readdirSync(src).filter((n) => n.endsWith(".md"))) {
    copyFileSync(join(src, f), join(dest, f));
  }
  chmodSync(join(skillDir, "scripts", "setup-project-memory.sh"), 0o755);
  log.info("memory-org: command installed, script marked executable");
}
```

- [ ] **Step 6: Verify catalog discovery**

Run: `node -e "import('./lib/skills.mjs').then(m => console.log(m.discoverSkills().map(s => s.name)))"`
Expected: array includes `memory-org`.

- [ ] **Step 7: Commit**

```bash
git add skills/memory-org
git commit -m "feat: add memory-org skill"
```

---

## Task 7: `debug-decisions` skill — port the toolkit

This task ports existing files from the author's machine, then generalizes them. Copy first, then
apply the edits; a verification grep at the end catches leftover personal strings.

**Files:**
- Create dir `skills/debug-decisions/` with `commands/`, `.bin/`, `.schema/`, `hooks/`.

- [ ] **Step 1: Copy source files into the skill**

```bash
mkdir -p skills/debug-decisions/{commands,.bin,.schema,hooks}
cp ~/.claude/commands/decision*.md       skills/debug-decisions/commands/
cp -R ~/.claude/debug-decisions/.bin/.   skills/debug-decisions/.bin/
cp ~/.claude/debug-decisions/.schema/decision-template.md skills/debug-decisions/.schema/
cp ~/.claude/debug-decisions/.schema/INDEX-skeleton.md    skills/debug-decisions/.schema/
cp ~/.claude/debug-decisions/.config.json skills/debug-decisions/.config.json
cp ~/.claude/hooks/decisions-stop-prompt.js skills/debug-decisions/hooks/
```

- [ ] **Step 2: Path-rewrite the commands**

In every `skills/debug-decisions/commands/decision*.md`, replace the storage-and-code base paths:

- `~/.claude/debug-decisions/.bin/` → `~/.claude/skills/debug-decisions/.bin/`
- `~/.claude/debug-decisions/.schema/` → `~/.claude/skills/debug-decisions/.schema/`
- Decision **data** paths stay: `~/.claude/debug-decisions/<slug>/` (data dir, unchanged).
- Remove the personal spec reference line `Spec: ~/.claude/docs/superpowers/specs/...`; replace with
  `See ~/.claude/skills/debug-decisions/SKILL.md`.
- Replace any `Output to user (Italian, brief)` instruction with `Output to user (brief)`.

Verify per file with Read; the `allowed-tools` frontmatter `Bash(~/.claude/debug-decisions/.bin/*:*)`
must become `Bash(~/.claude/skills/debug-decisions/.bin/*:*)`.

- [ ] **Step 3: Translate the schema templates to English**

Edit `skills/debug-decisions/.schema/decision-template.md`: translate the Italian section guidance
(e.g. `<Decisione in 1 riga, imperativa>` → `<Decision, one imperative line>`,
`scartata: <motivo, 1 riga>` → `dropped: <reason, one line>`, `Aree:` → `Areas:`,
`Dipendenze a valle:` → `Downstream dependencies:`, `Rischi:` → `Risks:`). Keep the YAML
frontmatter keys and structure identical. `INDEX-skeleton.md` is already English — leave as is.

- [ ] **Step 4: Generalize `.config.json` keywords to English**

Replace the Italian keyword list with English stems:

```json
{
  "stop_prompt": true,
  "min_turns": 5,
  "min_files_edited": 3,
  "keywords": ["choose", "decid", "approach", "alternativ", "trade-off"]
}
```

- [ ] **Step 5: Generalize the shell scripts**

In `skills/debug-decisions/.bin/*.sh`, remove Italian-only stopwords that are not also needed, OR
keep the bilingual stopword list (it is harmless). The only required change: ensure no script
hardcodes `/Users/<user>/...` — they use `$HOME`/relative resolution already; grep to confirm
(Step 8). Translate any Italian comments to English.

- [ ] **Step 6: Generalize the Stop hook**

Read `skills/debug-decisions/hooks/decisions-stop-prompt.js`. Replace any hardcoded
`/Users/<user>/.claude/...` path with `path.join(os.homedir(), ".claude", ...)`. Point the config
read at `~/.claude/skills/debug-decisions/.config.json`, and decision data at
`~/.claude/debug-decisions/<slug>/`. Translate Italian reminder text to English. The hook must still
never write files.

- [ ] **Step 7: Write `SKILL.md`** (generalized from the toolkit README)

```markdown
---
name: debug-decisions
description: Per-project tracking of architectural decisions made during Claude sessions. Registers decisions as versioned Markdown with revert plans, an INDEX, and an optional session-end reminder hook. Use when making or reviewing an architectural/approach decision, or when asked to record/list/revert a decision.
---

# debug-decisions

Track architectural / approach decisions per project, separate from git history.

## Commands

- `/decision <description>` — register a decision (flags: `--critical`, `--global`, `--tags a,b`).
- `/decision-list` — list decisions for the current project (`--critical` to filter).
- `/decision-show <id>` — view one decision in full.
- `/decision-revert <id>` — assisted revert with explicit confirmation at every step.
- `/decision-supersede <old-id> <description>` — supersede an old decision with a new one.

## Layout

- Code (scripts, schema, hook) lives in `~/.claude/skills/debug-decisions/`.
- Decision **data** lives in `~/.claude/debug-decisions/<slug>/` — one dir per project
  (slug = cwd with `/` → `-`), with an `INDEX.md` and one file per decision. `_global/` holds
  cross-project decisions.

## What counts as a decision

Only architectural / approach choices (e.g. "use file-per-decision instead of an append-only log").
Not file edits (git covers), destructive commands, or sub-agent spawns.

## Critical decisions

Tag `--critical` when irreversible, multi-team, security-relevant, or high blast radius. They allow
extended prose and get a `⚠` prefix in the INDEX.

## Stop hook

A `Stop` hook injects a retrospective reminder at session end if signals suggest an unregistered
decision. It never writes files. Disable via `.config.json`: `{ "stop_prompt": false }`.
```

- [ ] **Step 8: Write `setup.mjs`** — install commands + register the Stop hook

```js
import { join } from "node:path";
import {
  mkdirSync, copyFileSync, readFileSync, writeFileSync,
  existsSync, readdirSync,
} from "node:fs";

export default async function setup({ skillDir, claudeDir, log }) {
  // 1. Install slash commands.
  const cmdSrc = join(skillDir, "commands");
  const cmdDest = join(claudeDir, "commands");
  mkdirSync(cmdDest, { recursive: true });
  for (const f of readdirSync(cmdSrc).filter((n) => n.endsWith(".md"))) {
    copyFileSync(join(cmdSrc, f), join(cmdDest, f));
  }

  // 2. Register the Stop hook in settings.json (idempotent, with backup).
  const settingsPath = join(claudeDir, "settings.json");
  const hookCmd = `node "${join(skillDir, "hooks", "decisions-stop-prompt.js")}"`;
  const settings = existsSync(settingsPath)
    ? JSON.parse(readFileSync(settingsPath, "utf8"))
    : {};

  settings.hooks ??= {};
  settings.hooks.Stop ??= [];
  const already = settings.hooks.Stop.some((g) =>
    (g.hooks ?? []).some((h) => h.command === hookCmd));

  if (!already) {
    if (existsSync(settingsPath)) {
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      copyFileSync(settingsPath, `${settingsPath}.bak.${ts}`);
    }
    settings.hooks.Stop.push({
      hooks: [{
        type: "command",
        command: hookCmd,
        timeout: 10,
        statusMessage: "Checking for unregistered architectural decisions...",
      }],
    });
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    log.info("debug-decisions: Stop hook registered");
  } else {
    log.info("debug-decisions: Stop hook already present");
  }
  log.info("debug-decisions: commands installed");
}
```

> The hook-merge logic mirrors `lib/settings.mjs` deliberately: `setup.mjs` runs from the installed
> `~/.claude/skills/` location where `lib/` is not reachable, so it must be self-contained.
> `lib/settings.mjs` carries the unit tests that prove this logic correct.

- [ ] **Step 9: Port and run the shell-script tests**

```bash
cp -R ~/.claude/debug-decisions/.bin/tests skills/debug-decisions/.bin/tests 2>/dev/null || true
```

If `.bin/tests` exists, read it, fix any hardcoded paths to point at
`skills/debug-decisions/.bin/`, then run it. Expected: PASS. If the original has no test runner,
add a minimal one asserting `decision-id.sh "Use X instead of Y"` produces
`YYYY-MM-DD-HHMM-use-x-instead-y` (date-prefixed, stopwords dropped).

- [ ] **Step 10: Generalization verification grep**

```bash
grep -rn "marcello\|/Users/\|Italian\|caveman\|camunda\|scegli\|Decisione\|motivo" skills/debug-decisions/ || echo "CLEAN"
```

Expected: `CLEAN` (no personal/employer/Italian leftovers). Fix any hit before committing.

- [ ] **Step 11: Verify catalog discovery**

Run: `node -e "import('./lib/skills.mjs').then(m => console.log(m.discoverSkills().map(s => s.name)))"`
Expected: array includes `debug-decisions`.

- [ ] **Step 12: Commit**

```bash
git add skills/debug-decisions
git commit -m "feat: add debug-decisions skill"
```

---

## Task 8: Regenerate the catalog and run the full suite

**Files:**
- Modify: `README.md` (generated)

- [ ] **Step 1: Regenerate the README table**

Run: `npm run docs`
Expected: the "Available skills" table now lists `debug-decisions`, `memory-org`,
`spec-versioning`, and `sync-skills`.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — settings, commands, setup test files all green.

- [ ] **Step 3: Final verification grep across new skills**

```bash
grep -rn "marcello\|/Users/\|caveman\|camunda" skills/memory-org skills/spec-versioning skills/debug-decisions || echo "CLEAN"
```

Expected: `CLEAN`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: regenerate skills catalog"
```

---

## Self-Review notes (done while writing)

- **Spec coverage:** installer extension → Tasks 1-4; memory-org → Task 6; debug-decisions → Task 7;
  spec-versioning → Task 5; catalog/docs → Task 8; generalization checklist → Task 7 Steps 2-6,10 +
  Task 8 Step 3; testing → Tasks 1-3 + Task 7 Step 9.
- **setup.mjs reachability:** resolved — every `setup.mjs` is self-contained (inlined copy/merge),
  because at install time the skill lives under `~/.claude/skills/` where repo `lib/` is absent.
  `lib/settings.mjs` and `lib/commands.mjs` exist to carry the unit tests for that logic.
- **Data vs code paths:** decision data stays at `~/.claude/debug-decisions/<slug>/`; code moves to
  `~/.claude/skills/debug-decisions/` (Task 7 Steps 2, 6, 8).

---

## Addendum: Uninstaller (added after initial scope)

Symmetric teardown for installed skills.

- **U1 — lib helpers (TDD):** `settings.removeHook(settings, event, command)` (removes matching
  hooks, prunes empty groups/event, idempotent); `commands.removeCommands(destDir, names)` (deletes
  listed `.md`, reports `{removed, missing}`); `setup.loadTeardown(skillDir)` (loads `teardown.mjs`
  default export, sharing a `loadSkillModule` helper with `loadSetup`). Tests appended to
  `test/settings.test.mjs`, `test/commands.test.mjs`, `test/setup.test.mjs`.
- **U2 — per-skill `teardown.mjs`:** self-contained (no repo `lib/` import). `spec-versioning` and
  `memory-org` remove their installed commands; `debug-decisions` also de-registers the Stop hook
  from `settings.json` (backup first) and preserves decision data, printing where it lives.
- **U3 — `bin/uninstall.mjs`:** wizard mirroring `install.mjs` — `discoverSkills(TARGET_DIR)`,
  multiselect, run `teardown.mjs` on confirm, then `rmSync` the skill dir. Added `npm run uninstall`
  script + `claude-skills-uninstall` bin + README "Uninstall" section. Integration test
  `test/teardown.integration.test.mjs` runs the real `debug-decisions` teardown end-to-end.

Result: `npm test` → 30 pass.
```

