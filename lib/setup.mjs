import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Load a named module's default export from a skill dir, or null if absent. */
async function loadSkillModule(skillDir, file) {
  const modPath = join(skillDir, file);
  if (!existsSync(modPath)) return null;
  const mod = await import(pathToFileURL(modPath).href);
  return mod.default ?? null;
}

/**
 * Load a skill's setup.mjs default export, or null if the skill has none.
 * The default export is `async ({ skillDir, claudeDir, log }) => void`.
 */
export async function loadSetup(skillDir) {
  return loadSkillModule(skillDir, "setup.mjs");
}

/**
 * Load a skill's teardown.mjs default export, or null if the skill has none.
 * The default export is `async ({ skillDir, claudeDir, log }) => void`.
 */
export async function loadTeardown(skillDir) {
  return loadSkillModule(skillDir, "teardown.mjs");
}
