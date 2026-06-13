import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import { exists, listFiles, normalizePath, readJson, titleFromPath } from "./fs-utils.js";
const execFileAsync = promisify(execFile);
const DEFAULT_SCAN_OPTIONS = {
    packageScope: "primary",
};
const COMMON_PACKAGE_ROOTS = new Set(["apps", "packages", "crates", "cmd", "services", "libs"]);
const EXCLUDED_PACKAGE_SEGMENTS = new Set([
    "example",
    "examples",
    "demo",
    "demos",
    "fixture",
    "fixtures",
    "test",
    "tests",
    "__tests__",
    "e2e",
    "docs",
    "doc",
    "website",
    "storybook",
    "generated",
    "vendor",
    "vendors",
    "third_party",
    "third-party",
]);
const LANGUAGE_BY_EXT = {
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".py": "Python",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".kt": "Kotlin",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cs": "C#",
    ".cpp": "C++",
    ".cc": "C++",
    ".c": "C",
    ".h": "C/C++",
    ".swift": "Swift",
    ".md": "Markdown",
};
export async function scanRepo(rootInput, options = {}) {
    const scanOptions = { ...DEFAULT_SCAN_OPTIONS, ...options };
    const root = path.resolve(rootInput);
    if (!(await exists(root))) {
        throw new Error(`Repository path does not exist: ${root}`);
    }
    const allFiles = await listFiles(root);
    const packageJson = await readPackageJson(root, "package.json");
    const remoteUrl = await gitOutput(root, ["config", "--get", "remote.origin.url"]);
    const defaultBranch = await gitOutput(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
    const docs = detectDocs(allFiles);
    const configs = detectConfigs(allFiles);
    const ci = allFiles
        .filter((file) => file.startsWith(".github/workflows/") || file.startsWith(".gitlab-ci") || file === "Jenkinsfile")
        .map((file) => ({ path: file, kind: "CI Workflow" }));
    const tests = detectTests(allFiles);
    const packages = await detectPackages(root, allFiles, packageJson, scanOptions);
    const scripts = packages.flatMap((pkg) => pkg.scripts);
    const bins = packages.flatMap((pkg) => pkg.bins);
    const packageManagers = detectPackageManagers(allFiles);
    const sourceDirectories = detectSourceDirectories(allFiles);
    const languages = summarizeLanguages(allFiles);
    const name = packageJson?.name || path.basename(root);
    const description = packageJson?.description || (await readReadmeDescription(root, docs));
    const license = packageJson?.license || (allFiles.includes("LICENSE") ? "See LICENSE" : undefined);
    const summary = buildRepoSummary({
        name,
        description,
        packageManagers,
        languages,
        packages,
        bins,
        docs,
        tests,
        ci,
    });
    const scannedAt = await latestFileTimestamp(root, allFiles);
    return {
        root,
        name,
        description,
        summary,
        license,
        remoteUrl,
        defaultBranch,
        packageJson,
        packageManagers,
        languages,
        docs,
        configs,
        ci,
        tests,
        sourceDirectories,
        packages,
        scripts,
        bins,
        hasContributing: allFiles.some((file) => /^CONTRIBUTING(\.|$)/i.test(file)),
        hasSecurity: allFiles.some((file) => /^SECURITY(\.|$)/i.test(file)),
        hasChangelog: allFiles.some((file) => /(^|\/)(CHANGELOG|CHANGES|RELEASES)(\.|$)/i.test(file)),
        scannedAt,
    };
}
async function readPackageJson(root, relPath) {
    const raw = await readJson(path.join(root, relPath));
    if (!raw) {
        return undefined;
    }
    const bin = {};
    if (typeof raw.bin === "string" && raw.name) {
        bin[raw.name] = raw.bin;
    }
    else if (raw.bin && typeof raw.bin === "object") {
        Object.assign(bin, raw.bin);
    }
    const workspaces = Array.isArray(raw.workspaces)
        ? raw.workspaces
        : raw.workspaces?.packages ?? [];
    return {
        path: relPath,
        name: raw.name,
        description: raw.description,
        version: raw.version,
        license: raw.license,
        type: raw.type,
        workspaces,
        scripts: raw.scripts ?? {},
        bin,
        dependencyNames: packageDependencyNames(raw),
    };
}
async function detectPackages(root, allFiles, rootPackageJson, options = DEFAULT_SCAN_OPTIONS) {
    const manifestFiles = allFiles
        .filter((file) => ["package.json", "pyproject.toml", "Cargo.toml", "go.mod"].includes(path.basename(file)))
        .filter((file) => shouldIncludePackageManifest(file, rootPackageJson, options));
    const packages = [];
    for (const manifestPath of manifestFiles) {
        const packagePath = normalizePath(path.dirname(manifestPath));
        const normalizedPackagePath = packagePath === "." ? "." : packagePath;
        const manifestType = path.basename(manifestPath);
        if (manifestType === "package.json") {
            const parsed = normalizedPackagePath === "."
                ? rootPackageJson
                : await readPackageJson(root, manifestPath);
            if (!parsed) {
                continue;
            }
            const name = parsed.name || (normalizedPackagePath === "." ? path.basename(root) : path.basename(normalizedPackagePath));
            const scripts = Object.entries(parsed.scripts).map(([scriptName, command]) => ({
                name: scriptName,
                command,
                packagePath: normalizedPackagePath,
            }));
            const bins = Object.entries(parsed.bin).map(([binName, target]) => ({
                name: binName,
                target,
                packagePath: normalizedPackagePath,
            }));
            const details = await buildPackageScanDetails(root, allFiles, {
                name,
                path: normalizedPackagePath,
                description: parsed.description,
                manifestType,
                manifestPath,
                scripts,
                bins,
                dependencyNames: parsed.dependencyNames,
            });
            packages.push({
                name,
                path: normalizedPackagePath,
                summary: details.summary,
                description: parsed.description,
                manifestType,
                manifestPath,
                scripts,
                bins,
                readme: details.readme,
                entrypoints: details.entrypoints,
                dependencyNames: parsed.dependencyNames,
            });
            continue;
        }
        const name = await inferPackageName(root, manifestPath, normalizedPackagePath, manifestType);
        const details = await buildPackageScanDetails(root, allFiles, {
            name,
            path: normalizedPackagePath,
            manifestType,
            manifestPath,
            scripts: [],
            bins: [],
            dependencyNames: [],
        });
        packages.push({
            name,
            path: normalizedPackagePath,
            summary: details.summary,
            manifestType,
            manifestPath,
            scripts: [],
            bins: [],
            readme: details.readme,
            entrypoints: details.entrypoints,
            dependencyNames: [],
        });
    }
    return dedupePackages(packages);
}
function shouldIncludePackageManifest(manifestPath, rootPackageJson, options) {
    if (options.packageScope === "all") {
        return true;
    }
    const packagePath = normalizePath(path.dirname(manifestPath));
    const normalizedPackagePath = packagePath === "." ? "." : packagePath;
    if (normalizedPackagePath === ".") {
        return true;
    }
    if (hasExcludedPackageSegment(normalizedPackagePath)) {
        return false;
    }
    if (options.packageScope === "primary" && rootPackageJson?.workspaces.some((pattern) => isExactWorkspaceMatch(normalizedPackagePath, pattern))) {
        return true;
    }
    if (options.packageScope === "workspaces" && rootPackageJson?.workspaces.some((pattern) => matchesWorkspacePattern(normalizedPackagePath, pattern))) {
        return true;
    }
    const segments = normalizedPackagePath.split("/");
    return segments.length === 2 && COMMON_PACKAGE_ROOTS.has(segments[0] ?? "");
}
function hasExcludedPackageSegment(packagePath) {
    return packagePath.split("/").some((segment) => EXCLUDED_PACKAGE_SEGMENTS.has(segment.toLowerCase()));
}
function matchesWorkspacePattern(packagePath, pattern) {
    const normalizedPattern = normalizePath(pattern).replace(/\/+$/, "");
    if (!normalizedPattern || normalizedPattern === ".") {
        return packagePath === ".";
    }
    if (normalizedPattern.endsWith("/*")) {
        const prefix = normalizedPattern.slice(0, -2);
        const remainder = packagePath.slice(prefix.length + 1);
        return packagePath.startsWith(`${prefix}/`) && remainder.length > 0 && !remainder.includes("/");
    }
    if (normalizedPattern.endsWith("/**")) {
        const prefix = normalizedPattern.slice(0, -3);
        return packagePath === prefix || packagePath.startsWith(`${prefix}/`);
    }
    return packagePath === normalizedPattern;
}
function isExactWorkspaceMatch(packagePath, pattern) {
    const normalizedPattern = normalizePath(pattern).replace(/\/+$/, "");
    return normalizedPattern === packagePath;
}
async function buildPackageScanDetails(root, allFiles, pkg) {
    const readme = findPackageReadme(allFiles, pkg.path);
    const readmeSummary = readme ? await readMarkdownSummary(path.join(root, readme.path)) : undefined;
    const entrypoints = findPackageEntrypoints(allFiles, pkg);
    const summary = buildPackageSummary(pkg, readmeSummary, entrypoints);
    return { summary, readme, entrypoints };
}
function findPackageReadme(allFiles, packagePath) {
    const prefix = packagePath === "." ? "" : `${packagePath}/`;
    const candidates = [`${prefix}README.md`, `${prefix}README`, `${prefix}readme.md`];
    const found = candidates.find((candidate) => allFiles.includes(candidate));
    return found ? { path: found, kind: "Package README" } : undefined;
}
function findPackageEntrypoints(allFiles, pkg) {
    const prefix = pkg.path === "." ? "" : `${pkg.path}/`;
    const explicitBins = pkg.bins.map((bin) => normalizePath(path.posix.normalize(`${prefix}${bin.target}`).replace(/^\.\//, "")));
    const conventional = [
        `${prefix}src/index.ts`,
        `${prefix}src/index.tsx`,
        `${prefix}src/index.js`,
        `${prefix}src/main.ts`,
        `${prefix}src/main.js`,
        `${prefix}src/server.ts`,
        `${prefix}src/server.js`,
        `${prefix}src/cli.ts`,
        `${prefix}src/cli.js`,
        `${prefix}index.ts`,
        `${prefix}index.js`,
        `${prefix}main.go`,
        `${prefix}src/lib.rs`,
    ];
    return uniqueStrings([...explicitBins, ...conventional])
        .filter((file) => allFiles.includes(file))
        .slice(0, 6)
        .map((file) => ({ path: file, kind: "Entrypoint" }));
}
function buildPackageSummary(pkg, readmeSummary, entrypoints) {
    if (pkg.description) {
        return ensureSentence(pkg.description);
    }
    if (readmeSummary) {
        if (!isGenericReadmeSummary(readmeSummary)) {
            return ensureSentence(readmeSummary);
        }
    }
    const sentences = [];
    const location = pkg.path === "." ? "the repository root" : `\`${pkg.path}\``;
    sentences.push(`\`${pkg.name}\` is a ${pkg.manifestType} package under ${location}.`);
    const categories = summarizeScriptCategories(pkg.scripts);
    if (categories.length) {
        sentences.push(`It declares ${joinHumanList(categories)} workflow${categories.length === 1 ? "" : "s"} through ${code(pkg.manifestPath)}.`);
    }
    if (pkg.bins.length) {
        sentences.push(`It exposes ${pkg.bins.length === 1 ? "the CLI command" : "CLI commands"} ${joinHumanList(pkg.bins.map((bin) => code(bin.name)))}.`);
    }
    else if (entrypoints.length) {
        sentences.push(`Likely entrypoint${entrypoints.length === 1 ? "" : "s"} include ${joinHumanList(entrypoints.map((entrypoint) => code(entrypoint.path)))}.`);
    }
    if (pkg.dependencyNames.length) {
        sentences.push(`Its manifest declares ${pkg.dependencyNames.length} direct dependenc${pkg.dependencyNames.length === 1 ? "y" : "ies"}.`);
    }
    if (sentences.length === 1) {
        sentences.push(`The package is represented by ${code(pkg.manifestPath)}.`);
    }
    return sentences.map(ensureSentence).join(" ");
}
function buildRepoSummary(input) {
    const sentences = [];
    const languageSummary = input.languages.slice(0, 3).map((language) => language.language);
    const packageManagerSummary = input.packageManagers.length ? ` using ${joinHumanList(input.packageManagers)}` : "";
    const languagePhrase = languageSummary.length ? `${joinHumanList(languageSummary)} repository` : "software repository";
    sentences.push(input.description || `\`${input.name}\` is a ${languagePhrase}${packageManagerSummary}.`);
    const detected = [];
    if (input.packages.length)
        detected.push(`${input.packages.length} package${input.packages.length === 1 ? "" : "s"}`);
    if (input.bins.length)
        detected.push(`${input.bins.length} CLI entr${input.bins.length === 1 ? "y" : "ies"}`);
    if (input.docs.length)
        detected.push(`${input.docs.length} documentation file${input.docs.length === 1 ? "" : "s"}`);
    if (input.tests.length)
        detected.push(`${input.tests.length} test file${input.tests.length === 1 ? "" : "s"}`);
    if (input.ci.length)
        detected.push(`${input.ci.length} CI workflow${input.ci.length === 1 ? "" : "s"}`);
    if (detected.length) {
        sentences.push(`The scan detected ${joinHumanList(detected)}.`);
    }
    if (input.packageManagers.length && input.description) {
        sentences.push(`Package manager hints: ${joinHumanList(input.packageManagers)}.`);
    }
    return sentences.map(ensureSentence).join(" ");
}
async function inferPackageName(root, manifestPath, packagePath, manifestType) {
    if (manifestType === "go.mod") {
        const raw = await readText(path.join(root, manifestPath));
        const match = raw.match(/^module\s+(.+)$/m);
        if (match) {
            return match[1].trim();
        }
    }
    if (manifestType === "Cargo.toml" || manifestType === "pyproject.toml") {
        const raw = await readText(path.join(root, manifestPath));
        const match = raw.match(/^name\s*=\s*["']([^"']+)["']/m);
        if (match) {
            return match[1].trim();
        }
    }
    return packagePath === "." ? path.basename(root) : path.basename(packagePath);
}
function dedupePackages(packages) {
    const seen = new Set();
    return packages.filter((pkg) => {
        const key = `${pkg.path}:${pkg.manifestType}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
function detectDocs(files) {
    return files
        .filter((file) => /^README(\.|$)/i.test(file) ||
        /^CONTRIBUTING(\.|$)/i.test(file) ||
        /^SECURITY(\.|$)/i.test(file) ||
        /^CODE_OF_CONDUCT(\.|$)/i.test(file) ||
        /^CHANGELOG(\.|$)/i.test(file) ||
        file.startsWith("docs/") ||
        file.startsWith("website/docs/"))
        .map((file) => ({ path: file, kind: "Documentation" }));
}
function detectConfigs(files) {
    return files
        .filter((file) => /^(\.eslintrc|eslint\.config\.)/.test(file) ||
        /^(\.prettierrc|prettier\.config\.)/.test(file) ||
        /^tsconfig.*\.json$/.test(file) ||
        file === "package.json" ||
        file === "pyproject.toml" ||
        file === "Cargo.toml" ||
        file === "go.mod" ||
        file === "Dockerfile" ||
        file === "docker-compose.yml" ||
        file === "compose.yml")
        .map((file) => ({ path: file, kind: "Configuration" }));
}
function detectTests(files) {
    return files
        .filter((file) => file.includes("__tests__/") ||
        file.includes("/test/") ||
        file.includes("/tests/") ||
        /\.(test|spec)\.[cm]?[jt]sx?$/.test(file) ||
        /_test\.go$/.test(file) ||
        /test_.*\.py$/.test(path.basename(file)))
        .map((file) => ({ path: file, kind: "Test File" }));
}
function detectPackageManagers(files) {
    const managers = [];
    if (files.includes("package-lock.json"))
        managers.push("npm");
    if (files.includes("pnpm-lock.yaml"))
        managers.push("pnpm");
    if (files.includes("yarn.lock"))
        managers.push("Yarn");
    if (files.includes("bun.lockb") || files.includes("bun.lock"))
        managers.push("Bun");
    if (files.includes("uv.lock"))
        managers.push("uv");
    if (files.includes("poetry.lock"))
        managers.push("Poetry");
    if (files.includes("Cargo.lock"))
        managers.push("Cargo");
    if (files.includes("go.sum"))
        managers.push("Go modules");
    return managers;
}
function detectSourceDirectories(files) {
    const candidates = ["src", "lib", "app", "apps", "packages", "crates", "cmd", "internal", "pkg"];
    return candidates
        .filter((dir) => files.some((file) => file.startsWith(`${dir}/`)))
        .map((dir) => ({ path: dir, kind: "Source Directory" }));
}
function summarizeLanguages(files) {
    const counts = new Map();
    for (const file of files) {
        const language = LANGUAGE_BY_EXT[path.extname(file)];
        if (!language) {
            continue;
        }
        counts.set(language, (counts.get(language) ?? 0) + 1);
    }
    return [...counts.entries()]
        .map(([language, fileCount]) => ({ language, files: fileCount }))
        .sort((a, b) => b.files - a.files || a.language.localeCompare(b.language));
}
async function readReadmeDescription(root, docs) {
    const readme = docs.find((doc) => /^README(\.|$)/i.test(doc.path));
    if (!readme) {
        return undefined;
    }
    const raw = await readText(path.join(root, readme.path));
    const lines = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && !line.startsWith("[!") && !line.startsWith("<"));
    return lines[0]?.slice(0, 180);
}
async function readMarkdownSummary(filePath) {
    const raw = await readText(filePath);
    const paragraph = raw
        .split(/\r?\n\r?\n/)
        .map((block) => block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line &&
        !line.startsWith("#") &&
        !line.startsWith("[!") &&
        !line.startsWith("<") &&
        !line.startsWith("```") &&
        !line.startsWith("|"))
        .join(" "))
        .find((block) => block.length > 20);
    return paragraph?.slice(0, 260);
}
async function readText(filePath) {
    try {
        return await fs.readFile(filePath, "utf8");
    }
    catch {
        return "";
    }
}
async function latestFileTimestamp(root, files) {
    let latest = 0;
    for (const file of files) {
        try {
            const stat = await fs.stat(path.join(root, file));
            latest = Math.max(latest, stat.mtimeMs);
        }
        catch {
            continue;
        }
    }
    return new Date(latest || Date.now()).toISOString();
}
async function gitOutput(root, args) {
    try {
        const result = await execFileAsync("git", args, { cwd: root });
        const value = result.stdout.trim();
        return value || undefined;
    }
    catch {
        return undefined;
    }
}
export function scriptCategory(script) {
    const name = script.name.toLowerCase();
    if (name.includes("typecheck") || name.includes("type-check") || name === "types")
        return "typecheck";
    if (name.includes("test"))
        return "test";
    if (name.includes("build"))
        return "build";
    if (name.includes("lint"))
        return "lint";
    if (name.includes("dev") || name.includes("start"))
        return "development";
    if (name.includes("release") || name.includes("publish"))
        return "release";
    return "other";
}
function summarizeScriptCategories(scripts) {
    const labels = new Map([
        ["development", "development"],
        ["build", "build"],
        ["typecheck", "typecheck"],
        ["test", "test"],
        ["lint", "lint"],
        ["release", "release"],
    ]);
    return uniqueStrings(scripts
        .map((script) => labels.get(scriptCategory(script)))
        .filter((category) => Boolean(category)));
}
function isGenericReadmeSummary(value) {
    const normalized = value.toLowerCase();
    return [
        "everything you need to build a solid project",
        "powered by solid-start",
        "this template should help get you started",
        "create vite",
        "next.js project",
        "vite template",
    ].some((phrase) => normalized.includes(phrase));
}
function ensureSentence(value) {
    const trimmed = value.trim();
    if (!trimmed) {
        return trimmed;
    }
    return /[.!?;:]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
function joinHumanList(values) {
    if (values.length <= 1) {
        return values[0] ?? "";
    }
    if (values.length === 2) {
        return `${values[0]} and ${values[1]}`;
    }
    return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}
function uniqueStrings(values) {
    return [...new Set(values)];
}
function packageDependencyNames(raw) {
    return uniqueStrings([
        ...Object.keys(raw.dependencies ?? {}),
        ...Object.keys(raw.devDependencies ?? {}),
        ...Object.keys(raw.peerDependencies ?? {}),
        ...Object.keys(raw.optionalDependencies ?? {}),
    ]).sort((a, b) => a.localeCompare(b));
}
function code(value) {
    return `\`${value.replace(/`/g, "\\`")}\``;
}
export function displayPath(value) {
    return value === "." ? "repository root" : value;
}
export function titleForPackage(pkg) {
    return pkg.name || titleFromPath(pkg.path);
}
//# sourceMappingURL=scanner.js.map