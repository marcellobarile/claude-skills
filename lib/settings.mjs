import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";

/** Read settings.json, returning {} if absent. Throws on malformed JSON. */
export function readSettings(path) {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Malformed settings.json at ${path}: ${err.message}`);
  }
}

/** True if a hook with the same command is already registered for the event. */
export function hookExists(settings, event, command) {
  const groups = settings.hooks?.[event] ?? [];
  return groups.some((g) => (g.hooks ?? []).some((h) => h.command === command));
}

/** Return a new settings object with the hook added. Idempotent on command. */
export function addHook(settings, event, hookDef) {
  const next = structuredClone(settings);
  next.hooks ??= {};
  next.hooks[event] ??= [];
  if (hookExists(next, event, hookDef.command)) return next;
  next.hooks[event].push({ hooks: [hookDef] });
  return next;
}

/**
 * Return a new settings object with every hook matching the command removed
 * from the event. Drops groups left empty and the event key if it becomes
 * empty. Idempotent (no-op when the command is absent).
 */
export function removeHook(settings, event, command) {
  const next = structuredClone(settings);
  const groups = next.hooks?.[event];
  if (!groups) return next;
  next.hooks[event] = groups
    .map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => h.command !== command) }))
    .filter((g) => g.hooks.length > 0);
  if (next.hooks[event].length === 0) delete next.hooks[event];
  return next;
}

/** Write settings, backing up any existing file to settings.json.bak.<timestamp>. */
export function writeSettings(path, settings) {
  if (existsSync(path)) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    copyFileSync(path, `${path}.bak.${ts}`);
  }
  writeFileSync(path, JSON.stringify(settings, null, 2) + "\n");
}
