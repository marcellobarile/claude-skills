import { join } from "node:path";
import {
  rmSync, existsSync, readdirSync, readFileSync, writeFileSync, copyFileSync,
} from "node:fs";

export default async function teardown({ skillDir, claudeDir, log }) {
  // 1. Remove the slash commands this skill installed.
  const src = join(skillDir, "commands");
  const dest = join(claudeDir, "commands");
  if (existsSync(src)) {
    for (const f of readdirSync(src).filter((n) => n.endsWith(".md"))) {
      const target = join(dest, f);
      if (existsSync(target)) rmSync(target);
    }
  }

  // 2. De-register the Stop hook from settings.json (idempotent, with backup).
  const settingsPath = join(claudeDir, "settings.json");
  const hookCmd = `node "${join(skillDir, "hooks", "decisions-stop-prompt.js")}"`;
  if (existsSync(settingsPath)) {
    const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
    const groups = settings.hooks?.Stop;
    if (groups) {
      const pruned = groups
        .map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => h.command !== hookCmd) }))
        .filter((g) => g.hooks.length > 0);
      if (pruned.length !== groups.length) {
        if (pruned.length === 0) delete settings.hooks.Stop;
        else settings.hooks.Stop = pruned;
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        copyFileSync(settingsPath, `${settingsPath}.bak.${ts}`);
        writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
        log.info("debug-decisions: Stop hook removed");
      }
    }
  }

  // 3. Recorded decision data is preserved on purpose — never deleted here.
  log.info(
    "debug-decisions: decision data left intact at ~/.claude/debug-decisions/ (remove manually if you want it gone)",
  );
}
