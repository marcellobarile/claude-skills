// test/settings.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSettings, hookExists, addHook, removeHook, writeSettings } from "../lib/settings.mjs";

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

test("removeHook deletes the matching hook and prunes the empty event", () => {
  const added = addHook({}, "Stop", HOOK);
  const next = removeHook(added, "Stop", HOOK.command);
  assert.equal(next.hooks?.Stop, undefined);
});

test("removeHook keeps other hooks in the same event", () => {
  const other = { type: "command", command: "node /y/other.js" };
  let s = addHook({}, "Stop", HOOK);
  s = addHook(s, "Stop", other);
  const next = removeHook(s, "Stop", HOOK.command);
  assert.equal(next.hooks.Stop.length, 1);
  assert.equal(hookExists(next, "Stop", other.command), true);
  assert.equal(hookExists(next, "Stop", HOOK.command), false);
});

test("removeHook preserves unknown keys and other events", () => {
  const base = { model: "opus", hooks: { PreToolUse: [{ hooks: [] }] } };
  const added = addHook(base, "Stop", HOOK);
  const next = removeHook(added, "Stop", HOOK.command);
  assert.equal(next.model, "opus");
  assert.ok("PreToolUse" in next.hooks);
  assert.equal(next.hooks.Stop, undefined);
});

test("removeHook is a no-op when the command is absent", () => {
  const base = { hooks: { Stop: [{ hooks: [{ type: "command", command: "keep" }] }] } };
  const next = removeHook(base, "Stop", "missing");
  assert.equal(next.hooks.Stop.length, 1);
  assert.equal(hookExists(next, "Stop", "keep"), true);
});
