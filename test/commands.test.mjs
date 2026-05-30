// test/commands.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installCommands, removeCommands } from "../lib/commands.mjs";

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

test("removeCommands deletes listed files and reports missing ones", () => {
  const { src, dest } = fixture();
  installCommands(src, dest);
  const res = removeCommands(dest, ["a.md", "ghost.md"]);
  assert.deepEqual(res.removed, ["a.md"]);
  assert.deepEqual(res.missing, ["ghost.md"]);
  assert.ok(!existsSync(join(dest, "a.md")));
  assert.ok(existsSync(join(dest, "b.md")));
});
