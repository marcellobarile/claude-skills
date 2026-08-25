// test/teardown.integration.test.mjs
// Runs the actual copilot-adversarial-review teardown.mjs against throwaway dirs
// to prove the self-contained command removal works end-to-end.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import teardown from "../skills/copilot-adversarial-review/teardown.mjs";

const noopLog = { info() {}, success() {}, warn() {}, error() {} };

test("copilot-adversarial-review teardown removes its commands, keeps the rest", async () => {
  const root = mkdtempSync(join(tmpdir(), "teardown-"));
  const skillDir = join(root, "skill");
  const claudeDir = join(root, "claude");
  mkdirSync(join(skillDir, "commands"), { recursive: true });
  mkdirSync(join(claudeDir, "commands"), { recursive: true });

  // Skill ships one command.
  writeFileSync(join(skillDir, "commands", "copilot-adversarial-review.md"), "x");

  // Installed state: that command plus an unrelated one.
  writeFileSync(join(claudeDir, "commands", "copilot-adversarial-review.md"), "x");
  writeFileSync(join(claudeDir, "commands", "other.md"), "keep");

  await teardown({ skillDir, claudeDir, log: noopLog });

  assert.ok(!existsSync(join(claudeDir, "commands", "copilot-adversarial-review.md")));
  assert.ok(existsSync(join(claudeDir, "commands", "other.md")));
});

test("copilot-adversarial-review teardown is a no-op when nothing is installed", async () => {
  const root = mkdtempSync(join(tmpdir(), "teardown-"));
  const skillDir = join(root, "skill");
  const claudeDir = join(root, "claude");
  mkdirSync(join(skillDir, "commands"), { recursive: true });
  mkdirSync(join(claudeDir, "commands"), { recursive: true });
  writeFileSync(join(skillDir, "commands", "copilot-adversarial-review.md"), "x");

  await teardown({ skillDir, claudeDir, log: noopLog });

  assert.ok(!existsSync(join(claudeDir, "commands", "copilot-adversarial-review.md")));
});
