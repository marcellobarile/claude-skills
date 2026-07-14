import { join } from "node:path";
import { rmSync, existsSync, readdirSync } from "node:fs";

export default async function teardown({ skillDir, claudeDir, log }) {
  const src = join(skillDir, "commands");
  const dest = join(claudeDir, "commands");
  if (existsSync(src)) {
    for (const f of readdirSync(src).filter((n) => n.endsWith(".md"))) {
      const target = join(dest, f);
      if (existsSync(target)) rmSync(target);
    }
  }
  log.info("copilot-adversarial-review: command removed");
}
