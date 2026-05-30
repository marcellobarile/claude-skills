#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverSkills } from "../lib/skills.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const README = join(__dirname, "..", "README.md");

const START = "<!-- SKILLS:START -->";
const END = "<!-- SKILLS:END -->";

/** Render the skills catalog as a Markdown table. */
export function renderTable(skills) {
  const header = "| Skill | Description |\n| --- | --- |";
  if (skills.length === 0) {
    return `${header}\n| _Nessuna skill ancora._ | |`;
  }
  const rows = skills.map(
    (s) => `| \`${s.name}\` | ${s.description.replace(/\|/g, "\\|")} |`,
  );
  return [header, ...rows].join("\n");
}

/** Replace the content between the SKILLS markers, leaving the rest intact. */
export function injectTable(readme, table) {
  const startIdx = readme.indexOf(START);
  const endIdx = readme.indexOf(END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`README markers ${START} / ${END} not found or out of order`);
  }
  const before = readme.slice(0, startIdx + START.length);
  const after = readme.slice(endIdx);
  return `${before}\n\n${table}\n\n${after}`;
}

function main() {
  const skills = discoverSkills();
  const readme = readFileSync(README, "utf8");
  const updated = injectTable(readme, renderTable(skills));
  writeFileSync(README, updated);
  process.stdout.write(`README aggiornato — ${skills.length} skill.\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
