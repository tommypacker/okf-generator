import type { OkfFile, PackageInfo, RepoEnrichment, RepoInfo } from "./types.js";
export declare function generateOkfFiles(repo: RepoInfo, enrichment?: RepoEnrichment): OkfFile[];
export declare function packageSlug(pkg: PackageInfo): string;
