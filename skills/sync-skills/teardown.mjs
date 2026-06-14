import { join } from "node:path";
import { rmSync, existsSync } from "node:fs";

export default async function teardown({ claudeDir, log }) {
  const cmd = join(claudeDir, "commands", "sync-skills.md");
  if (existsSync(cmd)) {
    rmSync(cmd);
    log.info("sync-skills: command removed");
  }
}
