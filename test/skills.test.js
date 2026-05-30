import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverSkills, copySkill } from "../lib/skills.mjs";
import { renderTable, injectTable } from "../scripts/gen-readme.mjs";

function tmpRoot() {
  return mkdtempSync(join(tmpdir(), "claude-skills-test-"));
}

function writeSkill(root, name, frontmatter, body = "body") {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), `${frontmatter}\n\n${body}`);
  return dir;
}

test("discoverSkills returns metadata for valid skills, sorted by name", () => {
  const root = tmpRoot();
  writeSkill(root, "beta", "---\nname: beta\ndescription: B desc\n---");
  writeSkill(root, "alpha", "---\nname: alpha\ndescription: A desc\n---");

  const skills = discoverSkills(root);
  assert.equal(skills.length, 2);
  assert.deepEqual(skills.map((s) => s.name), ["alpha", "beta"]);
  assert.equal(skills[0].description, "A desc");
  rmSync(root, { recursive: true, force: true });
});

test("discoverSkills falls back to dir name when frontmatter name is missing", () => {
  const root = tmpRoot();
  writeSkill(root, "no-name", "---\ndescription: only desc\n---");
  const skills = discoverSkills(root);
  assert.equal(skills.length, 1);
  assert.equal(skills[0].name, "no-name");
  assert.equal(skills[0].description, "only desc");
  rmSync(root, { recursive: true, force: true });
});

test("discoverSkills skips malformed frontmatter without throwing", () => {
  const root = tmpRoot();
  writeSkill(root, "good", "---\nname: good\ndescription: ok\n---");
  writeSkill(root, "bad", "---\nname: [unterminated\n---");
  const skills = discoverSkills(root);
  assert.deepEqual(skills.map((s) => s.name), ["good"]);
  rmSync(root, { recursive: true, force: true });
});

test("discoverSkills returns [] for missing or empty dir", () => {
  assert.deepEqual(discoverSkills(join(tmpdir(), "does-not-exist-xyz")), []);
  const empty = tmpRoot();
  assert.deepEqual(discoverSkills(empty), []);
  rmSync(empty, { recursive: true, force: true });
});

test("copySkill copies nested files recursively and overwrites", () => {
  const root = tmpRoot();
  const src = join(root, "src");
  mkdirSync(join(src, "references"), { recursive: true });
  writeFileSync(join(src, "SKILL.md"), "main");
  writeFileSync(join(src, "references", "extra.md"), "extra");

  const dest = join(root, "dest", "my-skill");
  copySkill(src, dest);
  assert.equal(readFileSync(join(dest, "SKILL.md"), "utf8"), "main");
  assert.equal(readFileSync(join(dest, "references", "extra.md"), "utf8"), "extra");

  writeFileSync(join(src, "SKILL.md"), "updated");
  copySkill(src, dest);
  assert.equal(readFileSync(join(dest, "SKILL.md"), "utf8"), "updated");
  assert.ok(existsSync(join(dest, "references", "extra.md")));
  rmSync(root, { recursive: true, force: true });
});

test("renderTable renders rows and escapes pipes", () => {
  const table = renderTable([{ name: "x", description: "a | b" }]);
  assert.match(table, /\| `x` \| a \\\| b \|/);
});

test("renderTable shows placeholder for empty catalog", () => {
  assert.match(renderTable([]), /Nessuna skill ancora/);
});

test("injectTable replaces only between markers, keeping surrounding text", () => {
  const readme = "Top\n<!-- SKILLS:START -->\nOLD\n<!-- SKILLS:END -->\nBottom";
  const out = injectTable(readme, "NEW");
  assert.match(out, /^Top/);
  assert.match(out, /Bottom$/);
  assert.match(out, /NEW/);
  assert.doesNotMatch(out, /OLD/);
});

test("injectTable throws when markers are missing", () => {
  assert.throws(() => injectTable("no markers here", "X"), /markers/);
});
