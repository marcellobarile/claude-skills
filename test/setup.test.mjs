// test/setup.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSetup, loadTeardown } from "../lib/setup.mjs";

function skillDir({ setup = false, teardown = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "skill-"));
  if (setup) {
    writeFileSync(join(dir, "setup.mjs"), "export default async () => 'setup';\n");
  }
  if (teardown) {
    writeFileSync(join(dir, "teardown.mjs"), "export default async () => 'teardown';\n");
  }
  return dir;
}

test("loadSetup returns null when no setup.mjs", async () => {
  assert.equal(await loadSetup(skillDir()), null);
});

test("loadSetup returns the default export function", async () => {
  const fn = await loadSetup(skillDir({ setup: true }));
  assert.equal(typeof fn, "function");
  assert.equal(await fn({}), "setup");
});

test("loadTeardown returns null when no teardown.mjs", async () => {
  assert.equal(await loadTeardown(skillDir()), null);
});

test("loadTeardown returns the default export function", async () => {
  const fn = await loadTeardown(skillDir({ teardown: true }));
  assert.equal(typeof fn, "function");
  assert.equal(await fn({}), "teardown");
});
