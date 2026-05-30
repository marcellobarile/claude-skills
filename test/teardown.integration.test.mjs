// test/teardown.integration.test.mjs
// Runs the actual debug-decisions teardown.mjs against throwaway dirs to prove
// the self-contained (inlined) command + hook removal works end-to-end.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import teardown from "../skills/debug-decisions/teardown.mjs";

const noopLog = { info() {}, success() {}, warn() {}, error() {} };

test("debug-decisions teardown removes its commands and Stop hook, keeps the rest", async () => {
  const root = mkdtempSync(join(tmpdir(), "teardown-"));
  const skillDir = join(root, "skill");
  const claudeDir = join(root, "claude");
  mkdirSync(join(skillDir, "commands"), { recursive: true });
  mkdirSync(join(skillDir, "hooks"), { recursive: true });
  mkdirSync(join(claudeDir, "commands"), { recursive: true });

  // Skill ships two commands + the hook script.
  writeFileSync(join(skillDir, "commands", "decision.md"), "x");
  writeFileSync(join(skillDir, "commands", "decision-list.md"), "x");
  writeFileSync(join(skillDir, "hooks", "decisions-stop-prompt.js"), "");

  // Installed state: the two commands plus an unrelated one.
  writeFileSync(join(claudeDir, "commands", "decision.md"), "x");
  writeFileSync(join(claudeDir, "commands", "decision-list.md"), "x");
  writeFileSync(join(claudeDir, "commands", "other.md"), "keep");

  // settings.json: our Stop hook plus an unrelated Stop hook to preserve.
  const hookCmd = `node "${join(skillDir, "hooks", "decisions-stop-prompt.js")}"`;
  const other = { type: "command", command: "node /other/hook.js" };
  const settingsPath = join(claudeDir, "settings.json");
  writeFileSync(settingsPath, JSON.stringify({
    model: "opus",
    hooks: { Stop: [{ hooks: [{ type: "command", command: hookCmd }] }, { hooks: [other] }] },
  }, null, 2));

  await teardown({ skillDir, claudeDir, log: noopLog });

  // Commands: ours gone, unrelated kept.
  assert.ok(!existsSync(join(claudeDir, "commands", "decision.md")));
  assert.ok(!existsSync(join(claudeDir, "commands", "decision-list.md")));
  assert.ok(existsSync(join(claudeDir, "commands", "other.md")));

  // Hook: ours removed, unrelated preserved, unknown keys intact.
  const after = JSON.parse(readFileSync(settingsPath, "utf8"));
  assert.equal(after.model, "opus");
  const remaining = after.hooks.Stop.flatMap((g) => g.hooks.map((h) => h.command));
  assert.deepEqual(remaining, [other.command]);

  // A backup was written before mutating settings.json.
  const backups = readdirSync(claudeDir).filter((f) => f.startsWith("settings.json.bak."));
  assert.equal(backups.length, 1);
});
