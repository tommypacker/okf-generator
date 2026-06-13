import { promises as fs } from "node:fs";
import path from "node:path";

const IGNORED_DIRS = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  ".venv",
  "venv",
  "__pycache__",
  "target",
  "vendor",
  ".repo-okf-tmp",
  ".okf-draft",
  "okf",
]);

export async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJson<T>(filePath: string): Promise<T | undefined> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export async function listFiles(root: string): Promise<string[]> {
  const output: string[] = [];

  async function walk(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(current, entry.name);
      const relPath = normalizePath(path.relative(root, fullPath));

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        output.push(relPath);
      }
    }
  }

  await walk(root);
  return output.sort();
}

export async function ensureCleanDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

export async function writeFiles(root: string, files: { path: string; content: string }[]): Promise<void> {
  await fs.mkdir(root, { recursive: true });
  for (const file of files) {
    const target = path.join(root, file.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, "utf8");
  }
}

export function normalizePath(value: string): string {
  return value.split(path.sep).join("/");
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

export function titleFromPath(value: string): string {
  const base = path.basename(value, path.extname(value));
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
