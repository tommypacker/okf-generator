import type { DiffResult, GenerateWriteMode, LlmOptions, ProgressReporter, ScanOptions } from "./types.js";
export declare function diffOkf(repoPath: string, okfPath: string, llmOptions?: LlmOptions, progress?: ProgressReporter, scanOptions?: Partial<ScanOptions>): Promise<DiffResult>;
export declare function compareDirectories(existingPath: string, generatedPath: string): Promise<DiffResult>;
export declare function writeGeneratedBundle(repoPath: string, outPath: string, writeMode: GenerateWriteMode, llmOptions?: LlmOptions, progress?: ProgressReporter, scanOptions?: Partial<ScanOptions>): Promise<number>;
