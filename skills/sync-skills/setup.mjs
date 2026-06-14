import { join } from "node:path";
import { mkdirSync, copyFileSync, readdirSync, chmodSync } from "node:fs";

export default async function setup({ skillDir, claudeDir, log }) {
  const cmdSrc = join(skillDir, "commands");
  const cmdDest = join(claudeDir, "commands");
  mkdirSync(cmdDest, { recursive: true });
  for (const f of readdirSync(cmdSrc).filter((n) => n.endsWith(".md"))) {
    copyFileSync(join(cmdSrc, f), join(cmdDest, f));
  }

  const script = join(skillDir, "scripts", "sync.py");
  chmodSync(script, 0o755);

  log.info("sync-skills: commands installed, sync.py marked executable");
}
