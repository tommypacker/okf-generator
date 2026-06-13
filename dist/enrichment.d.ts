import type { LlmOptions, ProgressReporter, RepoEnrichment, RepoInfo } from "./types.js";
export declare function llmOptionsFromEnv(overrides?: Partial<LlmOptions>): LlmOptions;
export declare function enrichRepo(repo: RepoInfo, options: LlmOptions, progress?: ProgressReporter): Promise<RepoEnrichment>;
