import type { PackageScope } from "./types.js";
export declare const CONFIG_FILE = "okfgen.config.json";
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
export declare function loadRepoOkfConfig(repoPath: string): Promise<Partial<RepoOkfConfig>>;
export declare function writeDefaultConfig(repoPath: string, force: boolean): Promise<string>;
