import { promises as fs } from "node:fs";
import path from "node:path";
import { exists, readJson } from "./fs-utils.js";
import type { PackageScope } from "./types.js";

export interface RepoOkfConfig {
  output: string;
  mode?: "scan" | "quick" | "explore";
  packageScope?: PackageScope;
  cache?: boolean;
  cacheDir?: string;
  llm?: {
    model?: string;
    baseUrl?: string;
    maxFiles?: number;
    maxBytesPerFile?: number;
    maxPackageCalls?: number;
    maxPackageFiles?: number;
    maxFilesPerRollupChunk?: number;
  };
  include: string[];
  exclude: string[];
}

export async function loadRepoOkfConfig(repoPath: string): Promise<Partial<RepoOkfConfig>> {
  const target = path.join(repoPath, "repo-okf.config.json");
  if (!(await exists(target))) {
    return {};
  }

  const config = await readJson<Partial<RepoOkfConfig>>(target);
  return config ?? {};
}

export async function writeDefaultConfig(repoPath: string, force: boolean): Promise<string> {
  const target = path.join(repoPath, "repo-okf.config.json");
  if ((await exists(target)) && !force) {
    throw new Error(`Config already exists: ${target}. Re-run with --force to replace it.`);
  }

  const config: RepoOkfConfig = {
    output: "okf",
    mode: "scan",
    packageScope: "primary",
    cache: true,
    cacheDir: ".okf-cache",
    llm: {
      model: "gpt-4o-mini",
      maxFiles: 160,
      maxBytesPerFile: 7000,
      maxPackageCalls: 12,
      maxPackageFiles: 40,
      maxFilesPerRollupChunk: 40,
    },
    include: ["README*", "docs/**", "src/**", "packages/**", ".github/workflows/**"],
    exclude: ["node_modules/**", "dist/**", "build/**", "coverage/**"],
  };

  await fs.writeFile(target, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return target;
}
