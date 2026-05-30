import { readdirSync, statSync, readFileSync, mkdirSync, cpSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the repo's skills/ directory. */
export const SKILLS_DIR = join(__dirname, "..", "skills");

/**
 * Scan a skills directory and return metadata for each valid skill.
 * A valid skill is a subdirectory containing a SKILL.md with parseable
 * frontmatter. Malformed skills are skipped with a stderr warning, never thrown.
 * @returns {{name: string, description: string, dir: string}[]}
 */
export function discoverSkills(skillsDir = SKILLS_DIR) {
  if (!existsSync(skillsDir)) return [];

  const entries = readdirSync(skillsDir).filter((entry) => {
    const dir = join(skillsDir, entry);
    return statSync(dir).isDirectory() && existsSync(join(dir, "SKILL.md"));
  });

  const skills = [];
  for (const entry of entries) {
    const dir = join(skillsDir, entry);
    try {
      const { data } = matter(readFileSync(join(dir, "SKILL.md"), "utf8"));
      skills.push({
        name: data.name || entry,
        description: data.description || "",
        dir,
      });
    } catch (err) {
      process.stderr.write(`warning: skipping "${entry}" — invalid SKILL.md (${err.message})\n`);
    }
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Recursively copy a skill directory to a destination, replacing any existing
 * contents. Creates parent directories as needed.
 */
export function copySkill(srcDir, destDir) {
  mkdirSync(dirname(destDir), { recursive: true });
  cpSync(srcDir, destDir, { recursive: true });
}
