export declare function exists(filePath: string): Promise<boolean>;
export declare function readJson<T>(filePath: string): Promise<T | undefined>;
export declare function listFiles(root: string): Promise<string[]>;
export declare function ensureCleanDir(dir: string): Promise<void>;
export declare function writeFiles(root: string, files: {
    path: string;
    content: string;
}[]): Promise<void>;
export declare function normalizePath(value: string): string;
export declare function slugify(value: string): string;
export declare function titleFromPath(value: string): string;
