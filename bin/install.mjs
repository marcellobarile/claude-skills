#!/usr/bin/env node
import { homedir } from "node:os";
import { join, basename } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import {
  intro,
  outro,
  multiselect,
  confirm,
  isCancel,
  cancel,
  log,
} from "@clack/prompts";
import { discoverSkills, copySkill } from "../lib/skills.mjs";
import { loadSetup } from "../lib/setup.mjs";

const TARGET_DIR = join(homedir(), ".claude", "skills");
const CLAUDE_DIR = join(homedir(), ".claude");

function bail() {
  cancel("Installazione annullata.");
  process.exit(0);
}

async function main() {
  intro("claude-skills installer");

  const skills = discoverSkills();
  if (skills.length === 0) {
    outro("Nessuna skill disponibile nel repo.");
    return;
  }

  const selected = await multiselect({
    message: "Quali skill installare?",
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

  mkdirSync(TARGET_DIR, { recursive: true });

  let installed = 0;
  let skipped = 0;
  for (const name of selected) {
    const skill = skills.find((s) => s.name === name);
    const dest = join(TARGET_DIR, basename(skill.name));

    if (existsSync(dest)) {
      const overwrite = await confirm({
        message: `"${skill.name}" esiste già in ${TARGET_DIR}. Sovrascrivere?`,
        initialValue: false,
      });
      if (isCancel(overwrite)) bail();
      if (!overwrite) {
        log.warn(`Saltata: ${skill.name}`);
        skipped++;
        continue;
      }
    }

    copySkill(skill.dir, dest);
    log.success(`Installata: ${skill.name}`);
    installed++;

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
  }

  outro(`Fatto — ${installed} installate, ${skipped} saltate. Target: ${TARGET_DIR}`);
}

main().catch((err) => {
  log.error(err.stack || String(err));
  process.exit(1);
});
