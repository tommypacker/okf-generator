import type { PackageInfo, RepoInfo, ScanOptions, ScriptInfo } from "./types.js";
export declare function scanRepo(rootInput: string, options?: Partial<ScanOptions>): Promise<RepoInfo>;
export declare function scriptCategory(script: ScriptInfo): string;
export declare function displayPath(value: string): string;
export declare function titleForPackage(pkg: PackageInfo): string;
