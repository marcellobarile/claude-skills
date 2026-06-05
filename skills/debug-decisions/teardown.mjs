import { join } from "node:path";
import { homedir } from "node:os";
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

  // 3. De-register per-script Bash permissions from settings.json (idempotent).
  if (existsSync(settingsPath)) {
    const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
    const binBase = skillDir.replace(homedir(), "~") + "/.bin";
    const binPerms = new Set([
      `Bash(${binBase}/slug.sh)`,
      `Bash(${binBase}/git-sha.sh)`,
      `Bash(${binBase}/ensure-project-dir.sh:*)`,
      `Bash(${binBase}/decision-id.sh:*)`,
      `Bash(${binBase}/index-append.sh:*)`,
      `Bash(${binBase}/index-update-status.sh:*)`,
      `Bash(${binBase}/setup-project-decisions.sh:*)`,
      "Bash(git rev-parse:*)",
    ]);
    const allow = settings.permissions?.allow;
    if (allow) {
      const pruned = allow.filter((p) => !binPerms.has(p));
      if (pruned.length !== allow.length) {
        settings.permissions.allow = pruned;
        writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
        log.info("debug-decisions: permissions removed");
      }
    }
  }

  // 4. Recorded decision data is preserved on purpose — never deleted here.
  log.info(
    "debug-decisions: decision data left intact at ~/.claude/debug-decisions/ (remove manually if you want it gone)",
  );
}
