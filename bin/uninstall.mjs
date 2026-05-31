#!/usr/bin/env node
import { homedir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import {
  intro,
  outro,
  multiselect,
  confirm,
  isCancel,
  cancel,
  log,
} from "@clack/prompts";
import { discoverSkills } from "../lib/skills.mjs";
import { loadTeardown } from "../lib/setup.mjs";

const TARGET_DIR = join(homedir(), ".claude", "skills");
const CLAUDE_DIR = join(homedir(), ".claude");

function bail() {
  cancel("Disinstallazione annullata.");
  process.exit(0);
}

async function main() {
  intro("claude-skills uninstaller");

  const skills = discoverSkills(TARGET_DIR);
  if (skills.length === 0) {
    outro(`Nessuna skill installata in ${TARGET_DIR}.`);
    return;
  }

  const selected = await multiselect({
    message: "Quali skill disinstallare?",
    options: skills.map((s) => ({
      value: s.name,
      label: s.name,
      hint: s.description,
    })),
    required: false,
  });
  if (isCancel(selected)) bail();
  if (!selected.length) {
    outro("Nessuna skill selezionata.");
    return;
  }

  let removed = 0;
  for (const name of selected) {
    const skill = skills.find((s) => s.name === name);
    const dest = skill.dir;

    const teardown = await loadTeardown(dest);
    if (teardown) {
      const runIt = await confirm({
        message: `Run teardown for "${skill.name}"? (removes commands/hooks)`,
        initialValue: true,
      });
      if (isCancel(runIt)) bail();
      if (runIt) {
        try {
          await teardown({ skillDir: dest, claudeDir: CLAUDE_DIR, log });
          log.success(`Unwired: ${skill.name}`);
        } catch (err) {
          log.error(`Teardown failed for ${skill.name}: ${err.message}`);
        }
      }
    }

    rmSync(dest, { recursive: true, force: true });
    log.success(`Rimossa: ${skill.name}`);
    removed++;
  }

  outro(`Fatto — ${removed} disinstallate. Target: ${TARGET_DIR}`);
}

main().catch((err) => {
  log.error(err.stack || String(err));
  process.exit(1);
});
