import type { ValidationIssue } from "./types.js";
export declare function validateOkf(okfPath: string): Promise<ValidationIssue[]>;
export declare function isReservedMarkdown(filePath: string): boolean;
