import path from "node:path";
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import { listFiles } from "./fs-utils.js";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_MAX_FILES_QUICK = 48;
const DEFAULT_MAX_FILES_EXPLORE = 160;
const DEFAULT_MAX_BYTES_PER_FILE = 7000;
const DEFAULT_MAX_PACKAGE_CALLS = 12;
const DEFAULT_MAX_PACKAGE_FILES = 40;
const DEFAULT_MAX_FILES_PER_ROLLUP_CHUNK = 40;
const TEXT_EXTENSIONS = new Set([
    ".c",
    ".cc",
    ".cfg",
    ".conf",
    ".cpp",
    ".cs",
    ".css",
    ".go",
    ".h",
    ".html",
    ".java",
    ".js",
    ".json",
    ".jsx",
    ".kt",
    ".md",
    ".mjs",
    ".py",
    ".rb",
    ".rs",
    ".sh",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml",
]);
const IMPORTANT_FILENAMES = new Set([
    "README",
    "README.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "CHANGELOG.md",
    "package.json",
    "pyproject.toml",
    "Cargo.toml",
    "go.mod",
    "Makefile",
    "Dockerfile",
]);
const PACKAGE_CONFIG_FILENAMES = new Set([
    "tsconfig.json",
    "vite.config.ts",
    "vite.config.js",
    "wrangler.json",
    "wrangler.jsonc",
    "sst.config.ts",
    "drizzle.config.ts",
    "tailwind.config.ts",
]);
export function llmOptionsFromEnv(overrides = {}) {
    return {
        enabled: overrides.enabled ?? false,
        provider: "openai-compatible",
        mode: overrides.mode ?? llmModeFromEnv(),
        apiKey: overrides.apiKey ?? process.env.REPO_OKF_LLM_API_KEY ?? process.env.OPENAI_API_KEY,
        baseUrl: trimTrailingSlash(overrides.baseUrl ?? process.env.REPO_OKF_LLM_BASE_URL ?? process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL),
        model: overrides.model ?? process.env.REPO_OKF_LLM_MODEL ?? DEFAULT_MODEL,
        maxFiles: overrides.maxFiles ?? numberFromEnv("REPO_OKF_LLM_MAX_FILES", defaultMaxFiles(overrides.mode ?? llmModeFromEnv())),
        maxBytesPerFile: overrides.maxBytesPerFile ?? numberFromEnv("REPO_OKF_LLM_MAX_BYTES_PER_FILE", DEFAULT_MAX_BYTES_PER_FILE),
        maxPackageCalls: overrides.maxPackageCalls ?? numberFromEnv("REPO_OKF_LLM_MAX_PACKAGE_CALLS", DEFAULT_MAX_PACKAGE_CALLS),
        maxPackageFiles: overrides.maxPackageFiles ?? numberFromEnv("REPO_OKF_LLM_MAX_PACKAGE_FILES", DEFAULT_MAX_PACKAGE_FILES),
        maxFilesPerRollupChunk: overrides.maxFilesPerRollupChunk ?? numberFromEnv("REPO_OKF_LLM_MAX_FILES_PER_ROLLUP_CHUNK", DEFAULT_MAX_FILES_PER_ROLLUP_CHUNK),
        cache: overrides.cache ?? process.env.REPO_OKF_LLM_CACHE !== "false",
        cacheDir: overrides.cacheDir ?? process.env.REPO_OKF_LLM_CACHE_DIR,
    };
}
export async function enrichRepo(repo, options, progress) {
    if (!options.apiKey) {
        throw new Error("LLM enrichment requires REPO_OKF_LLM_API_KEY or OPENAI_API_KEY.");
    }
    if (options.mode === "explore") {
        return enrichRepoExplore(repo, options, progress);
    }
    return enrichRepoQuick(repo, options, progress);
}
async function enrichRepoQuick(repo, options, progress) {
    progress?.(`Collecting LLM evidence: up to ${options.maxFiles} files, ${options.maxBytesPerFile} bytes per file.`);
    const evidence = await collectEvidence(repo, options);
    progress?.(`Collected ${evidence.length} evidence file(s): ${evidence.map((item) => item.path).slice(0, 8).join(", ")}${evidence.length > 8 ? ", ..." : ""}`);
    progress?.(`Calling LLM enrichment model ${options.model} at ${options.baseUrl}.`);
    const response = await callOpenAiCompatible(buildPrompt(repo, evidence), options);
    progress?.("Received LLM response; parsing enrichment JSON.");
    const enrichment = normalizeEnrichment(response, options);
    assertUsableEnrichment(enrichment);
    progress?.(`LLM enrichment parsed: ${enrichment.packages.length} package summary item(s).`);
    return enrichment;
}
async function enrichRepoExplore(repo, options, progress) {
    progress?.(`LLM exploration mode enabled: up to ${options.maxPackageCalls} package-level call(s), ${options.maxPackageFiles} files per package, chunked repository summaries, then a final rollup.`);
    const allFiles = await listFiles(repo.root);
    const packagesToExplore = repo.packages.slice(0, options.maxPackageCalls);
    const packageSummaries = [];
    for (const pkg of packagesToExplore) {
        const evidence = await collectPackageEvidence(repo, pkg, allFiles, options);
        if (evidence.length === 0) {
            progress?.(`Skipping package ${pkg.name}: no text evidence selected.`);
            continue;
        }
        progress?.(`Exploring package ${pkg.name} (${pkg.path}) with ${evidence.length} evidence file(s).`);
        const response = await callOpenAiCompatible(buildPackagePrompt(repo, pkg, evidence), options);
        const packageSummary = normalizePackageResponse(response, pkg.path);
        if (packageSummary.summary || packageSummary.responsibilities.length) {
            packageSummaries.push(packageSummary);
        }
    }
    progress?.(`Collected ${packageSummaries.length} package-level summary item(s).`);
    progress?.(`Collecting repository rollup evidence: up to ${options.maxFiles} files, ${options.maxBytesPerFile} bytes per file.`);
    const repoEvidence = await collectEvidence(repo, options);
    const rollupChunks = chunkEvidence(repoEvidence, options.maxFilesPerRollupChunk);
    progress?.(`Summarizing repository evidence in ${rollupChunks.length} chunk(s), up to ${options.maxFilesPerRollupChunk} files each.`);
    const chunkSummaries = [];
    for (let index = 0; index < rollupChunks.length; index += 1) {
        const chunk = rollupChunks[index] ?? [];
        progress?.(`Calling repository chunk ${index + 1}/${rollupChunks.length} with ${chunk.length} evidence file(s).`);
        const chunkResponse = await callOpenAiCompatible(buildPrompt(repo, chunk, packageSummaries), options);
        chunkSummaries.push(normalizeEnrichment(chunkResponse, options));
    }
    progress?.(`Calling final repository rollup model ${options.model} with ${chunkSummaries.length} chunk summary item(s).`);
    const response = await callOpenAiCompatible(buildFinalRollupPrompt(repo, packageSummaries, chunkSummaries), options);
    const enrichment = normalizeEnrichment(response, options);
    enrichment.packages = mergePackageSummaries(packageSummaries, enrichment.packages);
    assertUsableEnrichment(enrichment);
    progress?.(`LLM exploration parsed: ${enrichment.packages.length} package summary item(s).`);
    return enrichment;
}
function chunkEvidence(evidence, chunkSize) {
    const size = Math.max(1, chunkSize);
    const chunks = [];
    for (let index = 0; index < evidence.length; index += size) {
        chunks.push(evidence.slice(index, index + size));
    }
    return chunks.length ? chunks : [[]];
}
async function collectEvidence(repo, options) {
    const allFiles = await listFiles(repo.root);
    const candidates = rankEvidenceFiles(repo, allFiles).slice(0, options.maxFiles);
    const evidence = [];
    for (const relPath of candidates) {
        const fullPath = path.join(repo.root, relPath);
        const content = await readBoundedText(fullPath, options.maxBytesPerFile);
        if (!content.trim()) {
            continue;
        }
        evidence.push({ path: relPath, content });
    }
    return evidence;
}
async function collectPackageEvidence(repo, pkg, allFiles, options) {
    const prefix = pkg.path === "." ? "" : `${pkg.path}/`;
    const packageFiles = allFiles.filter((file) => pkg.path === "." ? !isNestedPackageFile(repo, file) : file.startsWith(prefix));
    const selected = new Set();
    selected.add(pkg.manifestPath);
    if (pkg.readme)
        selected.add(pkg.readme.path);
    pkg.entrypoints.forEach((entrypoint) => selected.add(entrypoint.path));
    packageFiles
        .filter((file) => isPackageConfig(file, prefix))
        .slice(0, 4)
        .forEach((file) => selected.add(file));
    packageFiles
        .filter(isTestFile)
        .slice(0, 4)
        .forEach((file) => selected.add(file));
    const ranked = rankEvidenceFiles(repo, packageFiles);
    const candidates = uniqueStrings([...selected, ...ranked]).slice(0, options.maxPackageFiles);
    const evidence = [];
    const tree = buildPackageTreeEvidence(pkg, packageFiles);
    if (tree) {
        evidence.push({ path: `${pkg.path === "." ? "." : pkg.path}/__file_tree__.txt`, content: tree });
    }
    for (const relPath of candidates) {
        const fullPath = path.join(repo.root, relPath);
        const content = await readBoundedText(fullPath, options.maxBytesPerFile);
        if (!content.trim()) {
            continue;
        }
        evidence.push({ path: relPath, content });
    }
    return evidence;
}
function isPackageConfig(file, prefix) {
    if (!file.startsWith(prefix)) {
        return false;
    }
    const remainder = file.slice(prefix.length);
    return !remainder.includes("/") && PACKAGE_CONFIG_FILENAMES.has(path.basename(file));
}
function isTestFile(file) {
    return file.includes("__tests__/") ||
        file.includes("/test/") ||
        file.includes("/tests/") ||
        /\.(test|spec)\.[cm]?[jt]sx?$/.test(file) ||
        /_test\.go$/.test(file) ||
        /test_.*\.py$/.test(path.basename(file));
}
function buildPackageTreeEvidence(pkg, packageFiles) {
    const prefix = pkg.path === "." ? "" : `${pkg.path}/`;
    const treeFiles = packageFiles
        .filter(isTextLike)
        .map((file) => prefix && file.startsWith(prefix) ? file.slice(prefix.length) : file)
        .filter((file) => file && !file.startsWith("node_modules/") && !file.startsWith("dist/") && !file.startsWith("build/"))
        .sort()
        .slice(0, 80);
    if (!treeFiles.length) {
        return "";
    }
    return [
        `Package: ${pkg.name}`,
        `Path: ${pkg.path}`,
        "Text file tree sample:",
        ...treeFiles.map((file) => `- ${file}`),
    ].join("\n");
}
function isNestedPackageFile(repo, file) {
    return repo.packages.some((pkg) => pkg.path !== "." && file.startsWith(`${pkg.path}/`));
}
function rankEvidenceFiles(repo, allFiles) {
    const scores = new Map();
    for (const file of allFiles) {
        if (!isTextLike(file)) {
            continue;
        }
        let score = 0;
        const basename = path.basename(file);
        if (IMPORTANT_FILENAMES.has(basename))
            score += 100;
        if (/^README(\.|$)/i.test(file))
            score += 120;
        if (file.startsWith("docs/"))
            score += 60;
        if (file.startsWith(".github/workflows/"))
            score += 45;
        if (repo.packages.some((pkg) => pkg.manifestPath === file))
            score += 90;
        if (repo.bins.some((bin) => normalizeBinTarget(bin.packagePath, bin.target) === file))
            score += 80;
        if (/(^|\/)(index|main|cli|server|app)\.[cm]?[jt]sx?$/.test(file))
            score += 55;
        if (/(^|\/)(main|lib)\.(py|go|rs)$/.test(file))
            score += 55;
        if (file.includes("/test/") || file.includes("/tests/") || /\.(test|spec)\.[cm]?[jt]sx?$/.test(file))
            score += 20;
        if (file.length > 120)
            score -= 10;
        if (score > 0) {
            scores.set(file, score);
        }
    }
    for (const pkg of repo.packages) {
        const packagePrefix = pkg.path === "." ? "" : `${pkg.path}/`;
        const entrypoints = allFiles.filter((file) => file.startsWith(packagePrefix) &&
            /(^|\/)(index|main|cli|server|app|lib)\.(ts|tsx|js|jsx|mjs|py|go|rs)$/.test(file) &&
            isTextLike(file));
        for (const entrypoint of entrypoints.slice(0, 3)) {
            scores.set(entrypoint, (scores.get(entrypoint) ?? 0) + 50);
        }
    }
    return [...scores.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([file]) => file);
}
async function readBoundedText(filePath, maxBytes) {
    const handle = await fs.open(filePath, "r");
    try {
        const buffer = Buffer.alloc(maxBytes);
        const result = await handle.read(buffer, 0, maxBytes, 0);
        return buffer.subarray(0, result.bytesRead).toString("utf8").replace(/\0/g, "");
    }
    finally {
        await handle.close();
    }
}
async function callOpenAiCompatible(userPrompt, options) {
    const cachePath = llmCachePath(userPrompt, options);
    if (cachePath) {
        const cached = await readLlmCache(cachePath);
        if (cached !== undefined) {
            return cached;
        }
    }
    const response = await fetch(`${options.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
            "authorization": `Bearer ${options.apiKey}`,
            "content-type": "application/json",
        },
        body: JSON.stringify({
            model: options.model,
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: [
                        "You summarize software repositories into Open Knowledge Format enrichment JSON.",
                        "Use only the supplied evidence files. Do not infer facts that are not supported by evidence.",
                        "Every non-empty summary must cite source paths from the evidence.",
                        "Return strict JSON only.",
                    ].join(" "),
                },
                {
                    role: "user",
                    content: userPrompt,
                },
            ],
        }),
    });
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`LLM request failed with ${response.status}: ${body.slice(0, 500)}`);
    }
    const raw = await response.json();
    const content = raw.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error("LLM response did not include message content.");
    }
    const parsed = JSON.parse(content);
    if (cachePath) {
        await writeLlmCache(cachePath, parsed);
    }
    return parsed;
}
function llmCachePath(userPrompt, options) {
    if (!options.cache || !options.cacheDir) {
        return undefined;
    }
    const key = createHash("sha256")
        .update(JSON.stringify({
        provider: options.provider,
        baseUrl: options.baseUrl,
        model: options.model,
        prompt: userPrompt,
    }))
        .digest("hex");
    return path.join(options.cacheDir, `${key}.json`);
}
async function readLlmCache(cachePath) {
    try {
        return JSON.parse(await fs.readFile(cachePath, "utf8"));
    }
    catch {
        return undefined;
    }
}
async function writeLlmCache(cachePath, value) {
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, `${JSON.stringify(value)}\n`, "utf8");
}
function buildPrompt(repo, evidence, packageSummaries = []) {
    const repoFacts = {
        name: repo.name,
        description: repo.description,
        packageManagers: repo.packageManagers,
        languages: repo.languages,
        packages: repo.packages.map((pkg) => ({
            name: pkg.name,
            path: pkg.path,
            manifestType: pkg.manifestType,
            manifestPath: pkg.manifestPath,
            scripts: pkg.scripts.map((script) => script.name),
            bins: pkg.bins.map((bin) => bin.name),
            dependencies: pkg.dependencyNames,
        })),
        docs: repo.docs.map((doc) => doc.path),
        tests: repo.tests.slice(0, 40).map((test) => test.path),
        ci: repo.ci.map((ci) => ci.path),
    };
    return [
        "Create a concise repo understanding object for OKF generation.",
        "Schema:",
        JSON.stringify({
            overview: {
                summary: "2-4 sentence repository summary",
                purpose: ["short supported purpose bullet"],
                architecture: ["short supported architecture bullet"],
                importantFiles: ["path"],
                citations: ["path"],
            },
            packages: [{
                    packagePath: ".",
                    summary: "1-3 sentence package summary",
                    responsibilities: ["short supported responsibility"],
                    publicInterfaces: ["supported public interface or entrypoint"],
                    workflows: ["supported package workflow"],
                    importantFiles: ["path"],
                    risksOrUnknowns: ["important caveat or unknown"],
                    citations: ["path"],
                }],
            workflows: {
                development: { summary: "short summary", bullets: ["supported bullet"], citations: ["path"] },
                testing: { summary: "short summary", bullets: ["supported bullet"], citations: ["path"] },
                release: { summary: "short summary", bullets: ["supported bullet"], citations: ["path"] },
            },
            documentation: { summary: "short summary", bullets: ["supported bullet"], citations: ["path"] },
        }),
        "Rules:",
        "- Keep bullets factual and specific.",
        "- Cite only paths present in evidence.",
        "- If evidence is missing for a section, use empty strings/arrays.",
        "- Do not mention that you are an AI.",
        "",
        "Repository facts:",
        JSON.stringify(repoFacts, null, 2),
        packageSummaries.length ? "Prior package summaries from exploration:" : "",
        packageSummaries.length ? JSON.stringify(packageSummaries, null, 2) : "",
        "",
        "Evidence files:",
        evidence.map((item) => [
            `--- FILE: ${item.path} ---`,
            item.content,
        ].join("\n")).join("\n\n"),
    ].join("\n");
}
function buildFinalRollupPrompt(repo, packageSummaries, chunkSummaries) {
    return [
        "Create the final concise repo understanding object for OKF generation.",
        "Use only the supplied package summaries and repository chunk summaries.",
        "Return the same strict JSON schema as before.",
        "Schema:",
        JSON.stringify({
            overview: {
                summary: "2-4 sentence repository summary",
                purpose: ["short supported purpose bullet"],
                architecture: ["short supported architecture bullet"],
                importantFiles: ["path"],
                citations: ["path"],
            },
            packages: [{
                    packagePath: ".",
                    summary: "1-3 sentence package summary",
                    responsibilities: ["short supported responsibility"],
                    publicInterfaces: ["supported public interface or entrypoint"],
                    workflows: ["supported package workflow"],
                    importantFiles: ["path"],
                    risksOrUnknowns: ["important caveat or unknown"],
                    citations: ["path"],
                }],
            workflows: {
                development: { summary: "short summary", bullets: ["supported bullet"], citations: ["path"] },
                testing: { summary: "short summary", bullets: ["supported bullet"], citations: ["path"] },
                release: { summary: "short summary", bullets: ["supported bullet"], citations: ["path"] },
            },
            documentation: { summary: "short summary", bullets: ["supported bullet"], citations: ["path"] },
        }),
        "Rules:",
        "- Keep bullets factual and specific.",
        "- Prefer concrete source paths already present in package or chunk citations.",
        "- If evidence is missing for a section, use empty strings/arrays.",
        "- Do not mention that you are an AI.",
        "",
        "Repository facts:",
        JSON.stringify({
            name: repo.name,
            description: repo.description,
            packageManagers: repo.packageManagers,
            languages: repo.languages,
            packages: repo.packages.map((pkg) => ({
                name: pkg.name,
                path: pkg.path,
                manifestType: pkg.manifestType,
                manifestPath: pkg.manifestPath,
                dependencies: pkg.dependencyNames,
            })),
        }, null, 2),
        "",
        "Package summaries:",
        JSON.stringify(packageSummaries, null, 2),
        "",
        "Repository chunk summaries:",
        JSON.stringify(chunkSummaries.map((summary, index) => ({
            chunk: index + 1,
            overview: summary.overview,
            workflows: summary.workflows,
            documentation: summary.documentation,
            packages: summary.packages,
        })), null, 2),
    ].join("\n");
}
function buildPackagePrompt(repo, pkg, evidence) {
    return [
        "Create a concise package understanding object for OKF generation.",
        "Schema:",
        JSON.stringify({
            packagePath: pkg.path,
            summary: "1-3 sentence package summary",
            responsibilities: ["short supported responsibility"],
            publicInterfaces: ["supported public interface or entrypoint"],
            workflows: ["supported package workflow"],
            importantFiles: ["path"],
            risksOrUnknowns: ["important caveat or unknown"],
            citations: ["path"],
        }),
        "Rules:",
        "- Use only the supplied evidence files.",
        "- Keep bullets factual and specific.",
        "- Cite only paths present in evidence.",
        "- Use the __file_tree__.txt evidence to understand package shape, but cite concrete files when possible.",
        "- Identify public interfaces such as CLIs, exported modules, servers, APIs, or UI/app entrypoints.",
        "- Identify workflows from scripts, configs, tests, and deployment files.",
        "- Use risksOrUnknowns for important ambiguity, missing docs, generated/scaffold code, or unclear ownership.",
        "- If evidence is missing, use empty strings/arrays.",
        "- Return strict JSON only.",
        "",
        "Repository:",
        JSON.stringify({ name: repo.name, description: repo.description }, null, 2),
        "",
        "Package facts:",
        JSON.stringify({
            name: pkg.name,
            path: pkg.path,
            manifestType: pkg.manifestType,
            manifestPath: pkg.manifestPath,
            scripts: pkg.scripts.map((script) => ({ name: script.name, command: script.command })),
            bins: pkg.bins.map((bin) => ({ name: bin.name, target: bin.target })),
            dependencies: pkg.dependencyNames,
        }, null, 2),
        "",
        "Evidence files:",
        evidence.map((item) => [
            `--- FILE: ${item.path} ---`,
            item.content,
        ].join("\n")).join("\n\n"),
    ].join("\n");
}
function normalizeEnrichment(raw, options) {
    const value = isRecord(raw) ? raw : {};
    const evidencePaths = new Set();
    collectPaths(value, evidencePaths);
    return {
        provider: options.provider,
        mode: options.mode,
        model: options.model,
        generatedAt: new Date().toISOString(),
        overview: normalizeOverview(value.overview),
        packages: Array.isArray(value.packages) ? value.packages.map(normalizePackage).filter((pkg) => pkg.packagePath) : [],
        workflows: isRecord(value.workflows)
            ? {
                development: normalizeSection(value.workflows.development),
                testing: normalizeSection(value.workflows.testing),
                release: normalizeSection(value.workflows.release),
            }
            : undefined,
        documentation: normalizeSection(value.documentation),
    };
}
function assertUsableEnrichment(enrichment) {
    const hasOverview = Boolean(enrichment.overview?.summary ||
        enrichment.overview?.purpose.length ||
        enrichment.overview?.architecture.length);
    const hasPackages = enrichment.packages.some((pkg) => pkg.summary ||
        pkg.responsibilities.length ||
        pkg.publicInterfaces.length ||
        pkg.workflows.length ||
        pkg.importantFiles.length);
    const hasWorkflows = Boolean(enrichment.workflows?.development?.summary ||
        enrichment.workflows?.testing?.summary ||
        enrichment.workflows?.release?.summary);
    const hasDocumentation = Boolean(enrichment.documentation?.summary || enrichment.documentation?.bullets.length);
    if (!hasOverview && !hasPackages && !hasWorkflows && !hasDocumentation) {
        throw new Error("LLM enrichment returned no usable summaries. Try --mode explore, increase --llm-max-files, or use a stronger model.");
    }
}
function normalizeOverview(value) {
    if (!isRecord(value)) {
        return undefined;
    }
    return {
        summary: stringValue(value.summary),
        purpose: stringArray(value.purpose),
        architecture: stringArray(value.architecture),
        importantFiles: stringArray(value.importantFiles),
        citations: stringArray(value.citations),
    };
}
function normalizePackage(value) {
    const record = isRecord(value) ? value : {};
    return {
        packagePath: stringValue(record.packagePath),
        summary: stringValue(record.summary),
        responsibilities: stringArray(record.responsibilities),
        publicInterfaces: stringArray(record.publicInterfaces),
        workflows: stringArray(record.workflows),
        importantFiles: stringArray(record.importantFiles),
        risksOrUnknowns: stringArray(record.risksOrUnknowns),
        citations: stringArray(record.citations),
    };
}
function normalizePackageResponse(value, fallbackPackagePath) {
    const record = isRecord(value) && isRecord(value.package) ? value.package : value;
    const normalized = normalizePackage(record);
    return {
        ...normalized,
        packagePath: normalized.packagePath || fallbackPackagePath,
    };
}
function mergePackageSummaries(explored, rollup) {
    const merged = new Map();
    for (const item of explored) {
        merged.set(item.packagePath, item);
    }
    for (const item of rollup) {
        const existing = merged.get(item.packagePath);
        if (!existing) {
            merged.set(item.packagePath, item);
            continue;
        }
        merged.set(item.packagePath, {
            packagePath: item.packagePath,
            summary: existing.summary || item.summary,
            responsibilities: uniqueStrings([...existing.responsibilities, ...item.responsibilities]),
            publicInterfaces: uniqueStrings([...existing.publicInterfaces, ...item.publicInterfaces]),
            workflows: uniqueStrings([...existing.workflows, ...item.workflows]),
            importantFiles: uniqueStrings([...existing.importantFiles, ...item.importantFiles]),
            risksOrUnknowns: uniqueStrings([...existing.risksOrUnknowns, ...item.risksOrUnknowns]),
            citations: uniqueStrings([...existing.citations, ...item.citations]),
        });
    }
    return [...merged.values()];
}
function uniqueStrings(values) {
    return [...new Set(values.filter(Boolean))];
}
function normalizeSection(value) {
    if (!isRecord(value)) {
        return undefined;
    }
    return {
        summary: stringValue(value.summary),
        bullets: stringArray(value.bullets),
        citations: stringArray(value.citations),
    };
}
function collectPaths(value, output) {
    if (typeof value === "string" && value.includes("/")) {
        output.add(value);
    }
    else if (Array.isArray(value)) {
        value.forEach((item) => collectPaths(item, output));
    }
    else if (isRecord(value)) {
        Object.values(value).forEach((item) => collectPaths(item, output));
    }
}
function stringValue(value) {
    return typeof value === "string" ? value.trim() : "";
}
function stringArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isTextLike(file) {
    return TEXT_EXTENSIONS.has(path.extname(file)) || IMPORTANT_FILENAMES.has(path.basename(file));
}
function normalizeBinTarget(packagePath, target) {
    const prefix = packagePath === "." ? "" : `${packagePath}/`;
    return path.posix.normalize(`${prefix}${target}`).replace(/^\.\//, "");
}
function numberFromEnv(name, fallback) {
    const value = process.env[name];
    if (!value) {
        return fallback;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function llmModeFromEnv() {
    return process.env.REPO_OKF_MODE === "explore" ? "explore" : "quick";
}
function defaultMaxFiles(mode) {
    return mode === "explore" ? DEFAULT_MAX_FILES_EXPLORE : DEFAULT_MAX_FILES_QUICK;
}
function trimTrailingSlash(value) {
    return value.replace(/\/+$/, "");
}
//# sourceMappingURL=enrichment.js.map