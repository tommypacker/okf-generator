import path from "node:path";
import { promises as fs } from "node:fs";
import { listFiles } from "./fs-utils.js";
const RESERVED_FILES = new Set(["index.md", "log.md"]);
export async function validateOkf(okfPath) {
    const files = (await listFiles(okfPath)).filter((file) => file.endsWith(".md"));
    const issues = [];
    for (const file of files) {
        const basename = path.basename(file);
        const raw = await fs.readFile(path.join(okfPath, file), "utf8");
        if (basename === "index.md") {
            validateIndex(file, raw, issues);
            continue;
        }
        if (basename === "log.md") {
            validateLog(file, raw, issues);
            continue;
        }
        validateConcept(file, raw, issues);
    }
    return issues;
}
function validateConcept(file, raw, issues) {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    if (!match) {
        issues.push({ path: file, message: "Concept document is missing YAML frontmatter." });
        return;
    }
    const frontmatter = match[1] ?? "";
    const typeMatch = frontmatter.match(/^type:\s*(.+?)\s*$/m);
    if (!typeMatch || !typeMatch[1]?.trim()) {
        issues.push({ path: file, message: "Concept frontmatter is missing a non-empty type field." });
    }
}
function validateIndex(file, raw, issues) {
    if (raw.startsWith("---")) {
        issues.push({ path: file, message: "index.md should not contain frontmatter in this bundle." });
    }
    if (!/^#\s+.+/m.test(raw)) {
        issues.push({ path: file, message: "index.md should contain at least one heading." });
    }
}
function validateLog(file, raw, issues) {
    if (!/^#\s+.+/m.test(raw)) {
        issues.push({ path: file, message: "log.md should contain a title heading." });
    }
    const dateHeadings = raw.match(/^##\s+(.+)$/gm) ?? [];
    for (const heading of dateHeadings) {
        const value = heading.replace(/^##\s+/, "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            issues.push({ path: file, message: `log.md date heading must use YYYY-MM-DD: ${value}` });
        }
    }
}
export function isReservedMarkdown(filePath) {
    return RESERVED_FILES.has(path.basename(filePath));
}
//# sourceMappingURL=validator.js.map