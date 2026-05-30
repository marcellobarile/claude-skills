import { mkdirSync, copyFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/**
 * Copy every .md command file from srcDir into destDir.
 * Returns { installed: string[], skipped: string[] }.
 */
export function installCommands(srcDir, destDir, { overwrite = true } = {}) {
  mkdirSync(destDir, { recursive: true });
  const files = readdirSync(srcDir).filter((f) => f.endsWith(".md"));
  const result = { installed: [], skipped: [] };
  for (const f of files) {
    const dest = join(destDir, f);
    if (existsSync(dest) && !overwrite) {
      result.skipped.push(f);
      continue;
    }
    copyFileSync(join(srcDir, f), dest);
    result.installed.push(f);
  }
  return result;
}

/**
 * Remove the named .md command files from destDir.
 * Returns { removed: string[], missing: string[] }. Idempotent.
 */
export function removeCommands(destDir, names) {
  const result = { removed: [], missing: [] };
  for (const f of names) {
    const target = join(destDir, f);
    if (existsSync(target)) {
      rmSync(target);
      result.removed.push(f);
    } else {
      result.missing.push(f);
    }
  }
  return result;
}
