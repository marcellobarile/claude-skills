import { join } from "node:path";
import { mkdirSync, copyFileSync, readdirSync } from "node:fs";

export default async function setup({ skillDir, claudeDir, log }) {
  const src = join(skillDir, "commands");
  const dest = join(claudeDir, "commands");
  mkdirSync(dest, { recursive: true });
  for (const f of readdirSync(src).filter((n) => n.endsWith(".md"))) {
    copyFileSync(join(src, f), join(dest, f));
  }
  log.info("spec-versioning: commands installed");
}
