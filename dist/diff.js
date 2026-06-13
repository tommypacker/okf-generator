import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureCleanDir, exists, listFiles, writeFiles } from "./fs-utils.js";
import { enrichRepo } from "./enrichment.js";
import { generateOkfFiles } from "./okf.js";
import { scanRepo } from "./scanner.js";
const TOOL_VERSION = "0.1.0";
export async function diffOkf(repoPath, okfPath, llmOptions, progress, scanOptions) {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repo-okf-"));
    const generatedPath = path.join(tempRoot, "generated");
    try {
        progress?.(`Scanning repository: ${repoPath}`);
        const repo = await scanRepo(repoPath, scanOptions);
        progress?.(repoSummary(repo));
        const enrichment = llmOptions?.enabled ? await enrichRepo(repo, llmOptions, progress) : undefined;
        progress?.("Rendering generated OKF bundle for comparison.");
        const files = renderGeneratedBundle(repo, enrichment, llmOptions, scanOptions);
        await writeFiles(generatedPath, files);
        progress?.(`Comparing existing OKF at ${okfPath} with ${files.length} generated files.`);
        const result = await compareDirectories(okfPath, generatedPath);
        progress?.(`Diff complete: ${result.added.length} added, ${result.changed.length} changed, ${result.removed.length} removed.`);
        return result;
    }
    finally {
        await fs.rm(tempRoot, { recursive: true, force: true });
    }
}
export async function compareDirectories(existingPath, generatedPath) {
    const existingFiles = (await exists(existingPath)) ? await listFiles(existingPath) : [];
    const generatedFiles = await listFiles(generatedPath);
    const existingSet = new Set(existingFiles);
    const generatedSet = new Set(generatedFiles);
    const added = generatedFiles.filter((file) => !existingSet.has(file));
    const removed = existingFiles.filter((file) => !generatedSet.has(file));
    const changed = [];
    for (const file of generatedFiles) {
        if (!existingSet.has(file)) {
            continue;
        }
        const [existing, generated] = await Promise.all([
            fs.readFile(path.join(existingPath, file), "utf8"),
            fs.readFile(path.join(generatedPath, file), "utf8"),
        ]);
        if (existing !== generated) {
            changed.push(file);
        }
    }
    return { added, removed, changed };
}
export async function writeGeneratedBundle(repoPath, outPath, writeMode, llmOptions, progress, scanOptions) {
    if ((await exists(outPath)) && writeMode === "create") {
        const existingFiles = await listFiles(outPath);
        if (existingFiles.length > 0) {
            throw new Error(`Output directory is not empty: ${outPath}. Re-run with --update to preserve extra files or --reset to replace it.`);
        }
    }
    progress?.(`Scanning repository: ${repoPath}`);
    const repo = await scanRepo(repoPath, scanOptions);
    progress?.(repoSummary(repo));
    const enrichment = llmOptions?.enabled ? await enrichRepo(repo, llmOptions, progress) : undefined;
    progress?.("Rendering OKF files.");
    const files = renderGeneratedBundle(repo, enrichment, llmOptions, scanOptions);
    if (writeMode === "reset") {
        progress?.(`Resetting output directory ${outPath}.`);
        await ensureCleanDir(outPath);
    }
    progress?.(`Writing ${files.length} OKF files to ${outPath}${writeMode === "update" ? " and preserving extra files" : ""}.`);
    await writeFiles(outPath, files);
    progress?.("Generation complete.");
    return files.length;
}
function renderGeneratedBundle(repo, enrichment, llmOptions, scanOptions) {
    return [
        ...generateOkfFiles(repo, enrichment),
        {
            path: ".repo-okf.json",
            content: `${JSON.stringify(generationManifest(repo, llmOptions, scanOptions), null, 2)}\n`,
        },
    ].sort((a, b) => a.path.localeCompare(b.path));
}
function generationManifest(repo, llmOptions, scanOptions) {
    return {
        tool: "repo-okf",
        toolVersion: TOOL_VERSION,
        generatedAt: repo.scannedAt,
        repository: {
            name: repo.name,
            root: repo.root,
            remoteUrl: repo.remoteUrl,
            defaultBranch: repo.defaultBranch,
        },
        generation: {
            mode: llmOptions?.enabled ? llmOptions.mode : "scan",
            provider: llmOptions?.enabled ? llmOptions.provider : undefined,
            model: llmOptions?.enabled ? llmOptions.model : undefined,
            packageScope: scanOptions?.packageScope ?? "primary",
        },
        counts: {
            packages: repo.packages.length,
            docs: repo.docs.length,
            configs: repo.configs.length,
            ci: repo.ci.length,
            tests: repo.tests.length,
            languages: repo.languages.length,
        },
        files: generateOkfFiles(repo).map((file) => file.path),
    };
}
function repoSummary(repo) {
    const languages = repo.languages.slice(0, 5).map((item) => `${item.language} ${item.files}`).join(", ") || "none";
    return [
        `Detected repo "${repo.name}":`,
        `${repo.packages.length} package(s),`,
        `${repo.docs.length} doc file(s),`,
        `${repo.tests.length} test file(s),`,
        `${repo.configs.length} config file(s),`,
        `${repo.ci.length} CI file(s),`,
        `languages: ${languages}.`,
    ].join(" ");
}
//# sourceMappingURL=diff.js.map