#!/usr/bin/env node
import path from "node:path";
import { loadRepoOkfConfig, writeDefaultConfig, type RepoOkfConfig } from "./config.js";
import { diffOkf, writeGeneratedBundle } from "./diff.js";
import { llmOptionsFromEnv } from "./enrichment.js";
import { normalizePath } from "./fs-utils.js";
import { packageSlug } from "./okf.js";
import { displayPath, scanRepo, titleForPackage } from "./scanner.js";
import { validateOkf } from "./validator.js";
import type { GenerateWriteMode, LlmOptions, PackageInfo, PackageScope, ProgressReporter, RepoInfo, ScanOptions } from "./types.js";

interface ParsedArgs {
  command?: string;
  flags: Map<string, string | boolean>;
  positionals: string[];
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const command = parsed.command;

  if (!command || parsed.flags.has("help") || parsed.flags.has("h")) {
    printHelp();
    return;
  }

  rejectRemovedFlags(parsed);

  if (command === "init") {
    const repo = resolveFlag(parsed, "repo", ".");
    const force = booleanFlag(parsed, "force");
    const progress = createProgressReporter(parsed);
    progress?.(`Writing default config for repository: ${repo}`);
    const target = await writeDefaultConfig(repo, force);
    progress?.("Config initialization complete.");
    console.log(`Wrote ${target}`);
    return;
  }

  if (command === "generate") {
    const repo = resolveFlag(parsed, "repo", ".");
    const config = await loadRepoOkfConfig(repo);
    const out = resolveOutputPath(parsed, repo, config);
    const writeMode = resolveGenerateWriteMode(parsed);
    const llmOptions = resolveLlmOptions(parsed, repo, config);
    const scanOptions = resolveScanOptions(parsed, config);
    const progress = createProgressReporter(parsed);
    progress?.(`Starting generation. Output: ${out}`);
    progress?.(`Write mode: ${writeMode}.`);
    progress?.(`Package scope: ${scanOptions.packageScope}.`);
    if (llmOptions?.enabled) {
      progress?.(`Mode: ${llmOptions.mode}. LLM enrichment enabled with model ${llmOptions.model}.`);
    } else {
      progress?.("Mode: scan. LLM enrichment disabled; using deterministic repository scan only.");
    }
    const count = await writeGeneratedBundle(repo, out, writeMode, llmOptions, progress, scanOptions);
    console.log(`Generated ${count} OKF files at ${out}`);
    return;
  }

  if (command === "diff") {
    const repo = resolveFlag(parsed, "repo", ".");
    const config = await loadRepoOkfConfig(repo);
    const okf = resolveOkfPath(parsed, repo, config);
    const llmOptions = resolveLlmOptions(parsed, repo, config);
    const scanOptions = resolveScanOptions(parsed, config);
    const progress = createProgressReporter(parsed);
    progress?.(`Starting diff. Existing OKF: ${okf}`);
    progress?.(`Package scope: ${scanOptions.packageScope}.`);
    if (llmOptions?.enabled) {
      progress?.(`Mode: ${llmOptions.mode}. LLM enrichment enabled with model ${llmOptions.model}.`);
    } else {
      progress?.("Mode: scan. LLM enrichment disabled; comparing deterministic generated output.");
    }
    const result = await diffOkf(repo, okf, llmOptions, progress, scanOptions);
    printDiff(result);
    if (booleanFlag(parsed, "check") && (result.added.length || result.removed.length || result.changed.length)) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "explain") {
    const repo = resolveFlag(parsed, "repo", ".");
    const target = parsed.positionals[0];
    if (!target) {
      throw new Error("Missing package name or path. Usage: repo-okf explain <package-or-path> [--repo <path>].");
    }

    const config = await loadRepoOkfConfig(repo);
    const scanOptions = resolveScanOptions(parsed, config);
    const out = resolveOutputPath(parsed, repo, config);
    const progress = createProgressReporter(parsed);
    progress?.(`Scanning repository for package explanation: ${repo}`);
    const repoInfo = await scanRepo(repo, scanOptions);
    const pkg = findPackage(repoInfo, target);
    if (!pkg) {
      throw new Error(`No detected package matched "${target}". Try --package-scope workspaces or --package-scope all.`);
    }

    printPackageExplanation(repoInfo, pkg, scanOptions, out);
    return;
  }

  if (command === "validate") {
    const okf = resolveFlag(parsed, "okf", "okf");
    const progress = createProgressReporter(parsed);
    progress?.(`Validating OKF bundle: ${okf}`);
    const issues = await validateOkf(okf);
    if (issues.length === 0) {
      progress?.("Validation complete: no issues found.");
      console.log(`OKF bundle is valid: ${okf}`);
      return;
    }

    progress?.(`Validation complete: ${issues.length} issue(s) found.`);
    console.error(`Found ${issues.length} validation issue(s):`);
    for (const issue of issues) {
      console.error(`- ${issue.path}: ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function parseArgs(args: string[]): ParsedArgs {
  const flags = new Map<string, string | boolean>();
  let command: string | undefined;
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) {
      continue;
    }

    if (!command && !arg.startsWith("-")) {
      command = arg;
      continue;
    }

    if (command && !arg.startsWith("-")) {
      positionals.push(arg);
      continue;
    }

    if (arg.startsWith("--")) {
      const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
      if (inlineValue !== undefined) {
        flags.set(rawKey, inlineValue);
        continue;
      }

      const next = args[index + 1];
      if (next && !next.startsWith("-")) {
        flags.set(rawKey, next);
        index += 1;
      } else {
        flags.set(rawKey, true);
      }
      continue;
    }

    if (arg.startsWith("-")) {
      flags.set(arg.slice(1), true);
    }
  }

  return { command, flags, positionals };
}

function resolveFlag(parsed: ParsedArgs, name: string, fallback: string): string {
  const value = parsed.flags.get(name);
  if (typeof value === "string") {
    return path.resolve(value);
  }
  return path.resolve(fallback);
}

function resolveOptionalPath(value: string | undefined, basePath: string): string | undefined {
  if (!value) {
    return undefined;
  }
  return path.isAbsolute(value) ? value : path.resolve(basePath, value);
}

function resolveOutputPath(parsed: ParsedArgs, repo: string, config: Partial<RepoOkfConfig>): string {
  const explicit = stringFlag(parsed, "out");
  return resolveOptionalPath(explicit ?? config.output, repo) ?? path.join(repo, "okf");
}

function resolveOkfPath(parsed: ParsedArgs, repo: string, config: Partial<RepoOkfConfig>): string {
  const explicit = stringFlag(parsed, "okf");
  return resolveOptionalPath(explicit ?? config.output, repo) ?? path.join(repo, "okf");
}

function booleanFlag(parsed: ParsedArgs, name: string): boolean {
  return parsed.flags.get(name) === true || parsed.flags.get(name) === "true";
}

function stringFlag(parsed: ParsedArgs, name: string): string | undefined {
  const value = parsed.flags.get(name);
  return typeof value === "string" ? value : undefined;
}

function numberFlag(parsed: ParsedArgs, name: string): number | undefined {
  const value = stringFlag(parsed, name);
  if (!value) {
    return undefined;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : undefined;
}

function resolveLlmOptions(parsed: ParsedArgs, repo: string, config: Partial<RepoOkfConfig>): LlmOptions | undefined {
  const mode = generationModeFlag(parsed, config);
  if (mode === "scan") {
    return undefined;
  }

  return llmOptionsFromEnv({
    enabled: true,
    mode,
    apiKey: stringFlag(parsed, "llm-api-key"),
    baseUrl: stringFlag(parsed, "llm-base-url") ?? config.llm?.baseUrl,
    model: stringFlag(parsed, "llm-model") ?? config.llm?.model,
    maxFiles: numberFlag(parsed, "llm-max-files") ?? config.llm?.maxFiles,
    maxBytesPerFile: numberFlag(parsed, "llm-max-bytes-per-file") ?? config.llm?.maxBytesPerFile,
    maxPackageCalls: numberFlag(parsed, "llm-max-package-calls") ?? config.llm?.maxPackageCalls,
    maxPackageFiles: numberFlag(parsed, "llm-max-package-files") ?? config.llm?.maxPackageFiles,
    maxFilesPerRollupChunk: numberFlag(parsed, "llm-max-files-per-rollup-chunk") ?? config.llm?.maxFilesPerRollupChunk,
    cache: booleanFlag(parsed, "no-cache") ? false : config.cache,
    cacheDir: resolveOptionalPath(stringFlag(parsed, "cache-dir") ?? config.cacheDir ?? ".okf-cache", repo),
  });
}

function generationModeFlag(parsed: ParsedArgs, config: Partial<RepoOkfConfig>): "scan" | LlmOptions["mode"] {
  const mode = stringFlag(parsed, "mode");
  if (mode) {
    if (mode === "scan" || mode === "quick" || mode === "explore") {
      return mode;
    }

    throw new Error(`Invalid --mode value: ${mode}. Expected scan, quick, or explore.`);
  }

  const envMode = process.env.REPO_OKF_MODE;
  if (envMode) {
    if (envMode === "scan" || envMode === "quick" || envMode === "explore") {
      return envMode;
    }

    throw new Error(`Invalid REPO_OKF_MODE value: ${envMode}. Expected scan, quick, or explore.`);
  }

  if (config.mode) {
    if (config.mode === "scan" || config.mode === "quick" || config.mode === "explore") {
      return config.mode;
    }

    throw new Error(`Invalid config mode value: ${config.mode}. Expected scan, quick, or explore.`);
  }

  return "scan";
}

function resolveGenerateWriteMode(parsed: ParsedArgs): GenerateWriteMode {
  const update = booleanFlag(parsed, "update");
  const reset = booleanFlag(parsed, "reset") || booleanFlag(parsed, "force");

  if (update && reset) {
    throw new Error("Choose only one output write option: --update or --reset.");
  }

  if (update) {
    return "update";
  }

  if (reset) {
    return "reset";
  }

  return "create";
}

function resolveScanOptions(parsed: ParsedArgs, config: Partial<RepoOkfConfig> = {}): ScanOptions {
  return {
    packageScope: packageScopeFlag(parsed, config),
  };
}

function packageScopeFlag(parsed: ParsedArgs, config: Partial<RepoOkfConfig>): PackageScope {
  const value = stringFlag(parsed, "package-scope") ?? process.env.REPO_OKF_PACKAGE_SCOPE ?? config.packageScope ?? "primary";
  if (value === "primary" || value === "workspaces" || value === "all") {
    return value;
  }

  throw new Error(`Invalid --package-scope value: ${value}. Expected primary, workspaces, or all.`);
}

function rejectRemovedFlags(parsed: ParsedArgs): void {
  if (parsed.flags.has("llm")) {
    throw new Error("--llm has been removed. Use --mode quick or --mode explore.");
  }

  if (parsed.flags.has("llm-mode")) {
    throw new Error("--llm-mode has been removed. Use --mode scan, --mode quick, or --mode explore.");
  }
}

function createProgressReporter(parsed: ParsedArgs): ProgressReporter | undefined {
  if (booleanFlag(parsed, "quiet")) {
    return undefined;
  }

  return (message: string) => {
    console.error(`[repo-okf] ${message}`);
  };
}

function printDiff(result: { added: string[]; removed: string[]; changed: string[] }): void {
  if (!result.added.length && !result.removed.length && !result.changed.length) {
    console.log("OKF bundle is up to date.");
    return;
  }

  console.log("OKF bundle differs from generated output.");
  printGroup("Added", result.added);
  printGroup("Removed", result.removed);
  printGroup("Changed", result.changed);
}

function printGroup(label: string, files: string[]): void {
  if (!files.length) {
    return;
  }
  console.log(`\n${label}:`);
  for (const file of files) {
    console.log(`- ${file}`);
  }
}

function findPackage(repo: RepoInfo, target: string): PackageInfo | undefined {
  const normalizedTarget = normalizePath(target.replace(/^\.\//, "").replace(/\/+$/, "")) || ".";
  return repo.packages.find((pkg) =>
    pkg.name === target ||
    pkg.path === normalizedTarget ||
    pkg.manifestPath === normalizedTarget ||
    packageSlug(pkg) === normalizedTarget.replace(/^packages\//, "").replace(/\.md$/, "") ||
    `packages/${packageSlug(pkg)}.md` === normalizedTarget
  );
}

function printPackageExplanation(
  repo: RepoInfo,
  pkg: PackageInfo,
  scanOptions: ScanOptions,
  outPath: string,
): void {
  const internalNames = new Set(repo.packages.map((candidate) => candidate.name));
  const internalDependencies = pkg.dependencyNames.filter((dependency) => internalNames.has(dependency));
  const outputFile = path.join(outPath, "packages", `${packageSlug(pkg)}.md`);

  console.log(`Package: ${titleForPackage(pkg)}`);
  console.log(`Path: ${displayPath(pkg.path)}`);
  console.log(`Manifest: ${pkg.manifestPath}`);
  console.log(`Output: ${outputFile}`);
  console.log(`Package scope: ${scanOptions.packageScope}`);
  console.log(`Included because: ${packageInclusionReason(repo, pkg, scanOptions)}`);
  console.log("");
  console.log(`Summary: ${pkg.summary}`);

  if (pkg.readme) {
    console.log(`README: ${pkg.readme.path}`);
  }

  if (pkg.entrypoints.length) {
    console.log("");
    console.log("Entrypoints:");
    for (const entrypoint of pkg.entrypoints) {
      console.log(`- ${entrypoint.path}`);
    }
  }

  if (pkg.scripts.length) {
    console.log("");
    console.log("Scripts:");
    for (const script of pkg.scripts.slice(0, 20)) {
      console.log(`- ${script.name}: ${script.command}`);
    }
  }

  if (internalDependencies.length) {
    console.log("");
    console.log("Internal dependencies:");
    for (const dependency of internalDependencies) {
      console.log(`- ${dependency}`);
    }
  }

  if (pkg.dependencyNames.length) {
    console.log("");
    console.log(`Direct dependencies: ${pkg.dependencyNames.length}`);
  }
}

function packageInclusionReason(repo: RepoInfo, pkg: PackageInfo, scanOptions: ScanOptions): string {
  if (pkg.path === ".") {
    return "root manifest";
  }

  if (scanOptions.packageScope === "all") {
    return "--package-scope all includes every detected package manifest";
  }

  if (repo.packageJson?.workspaces.some((pattern) => pattern === pkg.path)) {
    return "exact root workspace entry";
  }

  if (scanOptions.packageScope === "workspaces" && repo.packageJson?.workspaces.length) {
    return "matched root workspace pattern";
  }

  const segments = pkg.path.split("/");
  if (segments.length === 2) {
    return "direct package under a common monorepo directory";
  }

  return "matched scanner package rules";
}

function printHelp(): void {
  console.log(`repo-okf

Usage:
  repo-okf init [--repo <path>] [--force] [--quiet]
  repo-okf generate [--repo <path>] [--out <path>] [--update|--reset] [--mode <scan|quick|explore>] [--package-scope <primary|workspaces|all>] [--quiet]
  repo-okf diff [--repo <path>] [--okf <path>] [--check] [--mode <scan|quick|explore>] [--package-scope <primary|workspaces|all>] [--quiet]
  repo-okf explain <package-or-path> [--repo <path>] [--package-scope <primary|workspaces|all>] [--quiet]
  repo-okf validate [--okf <path>] [--quiet]

Commands:
  init       Write a default repo-okf.config.json.
  generate   Generate an OKF bundle for a repository.
  diff       Regenerate to a temporary directory and compare with an OKF bundle.
  explain    Explain why a detected package is included and where its OKF file is written.
  validate   Validate basic OKF v0.1 conformance.

Common options:
  --repo <path>                 Repository to inspect. Defaults to the current directory.
  --quiet                       Hide progress messages. Final command output is still printed.
  repo-okf.config.json          Optional repo config. CLI flags override config values.

init options:
  --force                       Replace an existing repo-okf.config.json.

generate options:
  --out <path>                  Output directory for generated OKF files. Defaults to <repo>/okf.
  --update                      Overwrite generated OKF files while preserving extra files in the output directory.
  --reset                       Delete and recreate the output directory before writing generated OKF files.
  --force                       Alias for --reset.
  --mode <scan|quick|explore>   Generation mode. Defaults to scan.
  --package-scope <scope>       Package detection scope: primary, workspaces, or all. Defaults to primary.

diff options:
  --okf <path>                  Existing OKF directory to compare. Defaults to <repo>/okf.
  --check                       Exit with code 1 when generated OKF differs.
  --mode <scan|quick|explore>   Generation mode to use before comparing. Defaults to scan.
  --package-scope <scope>       Package detection scope: primary, workspaces, or all. Defaults to primary.

explain options:
  <package-or-path>             Package name, package path, manifest path, or generated package md path.
  --out <path>                  OKF output directory used when printing the generated package file path.
  --package-scope <scope>       Package detection scope used before explaining the match.

validate options:
  --okf <path>                  OKF directory to validate. Defaults to ./okf.

LLM enrichment:
  scan                          Offline repository scan only.
  quick                         One LLM rollup call over selected evidence files.
  explore                       Package-level LLM calls plus a repository rollup.
  --llm-model <model>           Model name. Defaults to REPO_OKF_LLM_MODEL or gpt-4o-mini.
  --llm-base-url <url>          API base URL. Defaults to OPENAI_BASE_URL or https://api.openai.com/v1.
  --llm-api-key <key>           API key. Defaults to REPO_OKF_LLM_API_KEY or OPENAI_API_KEY.
  --llm-max-files <count>       Evidence file limit.
  --llm-max-bytes-per-file <n>  Per-file evidence byte limit.
  --llm-max-package-calls <n>   Package-level call limit for explore mode.
  --llm-max-package-files <n>   Per-package evidence file limit for explore mode.
  --llm-max-files-per-rollup-chunk <n>
                                Repository evidence files per explore rollup chunk.
  --cache-dir <path>            Directory for cached LLM JSON responses. Defaults to <repo>/.okf-cache.
  --no-cache                    Disable cached LLM responses for this run.

Environment:
  REPO_OKF_MODE                 Default mode: scan, quick, or explore.
  REPO_OKF_PACKAGE_SCOPE        Default package scope: primary, workspaces, or all.
  REPO_OKF_LLM_API_KEY          API key for quick/explore mode.
  OPENAI_API_KEY                Fallback API key for quick/explore mode.
  REPO_OKF_LLM_MODEL            Default LLM model.
  REPO_OKF_LLM_BASE_URL         Default OpenAI-compatible API base URL.
  OPENAI_BASE_URL               Fallback OpenAI-compatible API base URL.
  REPO_OKF_LLM_CACHE            Set to false to disable LLM response caching.
  REPO_OKF_LLM_CACHE_DIR        Default directory for cached LLM JSON responses.
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`repo-okf: ${message}`);
  process.exitCode = 1;
});
