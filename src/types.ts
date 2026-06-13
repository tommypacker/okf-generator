export interface CliOptions {
  repo: string;
  out?: string;
  okf?: string;
  check: boolean;
  force: boolean;
  llm?: LlmOptions;
}

export interface LlmOptions {
  enabled: boolean;
  provider: "openai-compatible";
  mode: "quick" | "explore";
  apiKey?: string;
  baseUrl: string;
  model: string;
  maxFiles: number;
  maxBytesPerFile: number;
  maxPackageCalls: number;
  maxPackageFiles: number;
  maxFilesPerRollupChunk: number;
  cacheDir?: string;
  cache: boolean;
}

export type ProgressReporter = (message: string) => void;

export type GenerateWriteMode = "create" | "update" | "reset";

export type PackageScope = "primary" | "workspaces" | "all";

export interface ScanOptions {
  packageScope: PackageScope;
}

export interface RepoInfo {
  root: string;
  name: string;
  description?: string;
  summary: string;
  license?: string;
  remoteUrl?: string;
  defaultBranch?: string;
  packageJson?: PackageJsonInfo;
  packageManagers: string[];
  languages: LanguageSummary[];
  docs: RepoFile[];
  configs: RepoFile[];
  ci: RepoFile[];
  tests: RepoFile[];
  sourceDirectories: RepoDirectory[];
  packages: PackageInfo[];
  scripts: ScriptInfo[];
  bins: BinInfo[];
  hasContributing: boolean;
  hasSecurity: boolean;
  hasChangelog: boolean;
  scannedAt: string;
}

export interface PackageJsonInfo {
  path: string;
  name?: string;
  description?: string;
  version?: string;
  license?: string;
  type?: string;
  workspaces: string[];
  scripts: Record<string, string>;
  bin: Record<string, string>;
  dependencyNames: string[];
}

export interface PackageInfo {
  name: string;
  path: string;
  summary: string;
  description?: string;
  manifestType: ManifestType;
  manifestPath: string;
  scripts: ScriptInfo[];
  bins: BinInfo[];
  readme?: RepoFile;
  entrypoints: RepoFile[];
  dependencyNames: string[];
}

export type ManifestType =
  | "package.json"
  | "pyproject.toml"
  | "Cargo.toml"
  | "go.mod";

export interface ScriptInfo {
  name: string;
  command: string;
  packagePath: string;
}

export interface BinInfo {
  name: string;
  target: string;
  packagePath: string;
}

export interface RepoFile {
  path: string;
  kind: string;
}

export interface RepoDirectory {
  path: string;
  kind: string;
}

export interface LanguageSummary {
  language: string;
  files: number;
}

export interface OkfFile {
  path: string;
  content: string;
}

export interface RepoEnrichment {
  provider: string;
  mode: "quick" | "explore";
  model: string;
  generatedAt: string;
  overview?: EnrichedOverview;
  packages: EnrichedPackage[];
  workflows?: EnrichedWorkflows;
  documentation?: EnrichedSection;
}

export interface EnrichedOverview {
  summary: string;
  purpose: string[];
  architecture: string[];
  importantFiles: string[];
  citations: string[];
}

export interface EnrichedPackage {
  packagePath: string;
  summary: string;
  responsibilities: string[];
  implementation: string[];
  publicInterfaces: string[];
  workflows: string[];
  importantFiles: string[];
  risksOrUnknowns: string[];
  citations: string[];
}

export interface EnrichedWorkflows {
  development?: EnrichedSection;
  testing?: EnrichedSection;
  release?: EnrichedSection;
}

export interface EnrichedSection {
  summary: string;
  bullets: string[];
  citations: string[];
}

export interface DiffResult {
  added: string[];
  removed: string[];
  changed: string[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}
