import { join } from "node:path";
import { homedir } from "node:os";
import {
  mkdirSync, copyFileSync, readFileSync, writeFileSync,
  existsSync, readdirSync,
} from "node:fs";

export default async function setup({ skillDir, claudeDir, log }) {
  // 1. Install slash commands.
  const cmdSrc = join(skillDir, "commands");
  const cmdDest = join(claudeDir, "commands");
  mkdirSync(cmdDest, { recursive: true });
  for (const f of readdirSync(cmdSrc).filter((n) => n.endsWith(".md"))) {
    copyFileSync(join(cmdSrc, f), join(cmdDest, f));
  }

  // 2. Register the Stop hook in settings.json (idempotent, with backup).
  const settingsPath = join(claudeDir, "settings.json");
  const hookCmd = `node "${join(skillDir, "hooks", "decisions-stop-prompt.js")}"`;
  const settings = existsSync(settingsPath)
    ? JSON.parse(readFileSync(settingsPath, "utf8"))
    : {};

  settings.hooks ??= {};
  settings.hooks.Stop ??= [];
  const already = settings.hooks.Stop.some((g) =>
    (g.hooks ?? []).some((h) => h.command === hookCmd));

  if (!already) {
    if (existsSync(settingsPath)) {
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      copyFileSync(settingsPath, `${settingsPath}.bak.${ts}`);
    }
    settings.hooks.Stop.push({
      hooks: [{
        type: "command",
        command: hookCmd,
        timeout: 10,
        statusMessage: "Checking for unregistered architectural decisions...",
      }],
    });
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    log.info("debug-decisions: Stop hook registered");
  } else {
    log.info("debug-decisions: Stop hook already present");
  }
  // 3. Register per-script Bash permissions in settings.json (idempotent).
  // Wildcard in command path is not supported by the permission matcher — list explicitly.
  const binBase = skillDir.replace(homedir(), "~") + "/.bin";
  const binPerms = [
    `Bash(${binBase}/slug.sh)`,
    `Bash(${binBase}/git-sha.sh)`,
    `Bash(${binBase}/ensure-project-dir.sh:*)`,
    `Bash(${binBase}/decision-id.sh:*)`,
    `Bash(${binBase}/index-append.sh:*)`,
    `Bash(${binBase}/index-update-status.sh:*)`,
    `Bash(${binBase}/setup-project-decisions.sh:*)`,
  ];
  settings.permissions ??= {};
  settings.permissions.allow ??= [];
  const missing = binPerms.filter((p) => !settings.permissions.allow.includes(p));
  if (missing.length > 0) {
    settings.permissions.allow.push(...missing);
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    log.info(`debug-decisions: permissions registered — ${missing.join(", ")}`);
  } else {
    log.info("debug-decisions: permissions already present");
  }

  log.info("debug-decisions: commands installed");
}
