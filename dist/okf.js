import { slugify } from "./fs-utils.js";
import { displayPath, scriptCategory, titleForPackage } from "./scanner.js";
export function generateOkfFiles(repo, enrichment) {
    const files = [];
    files.push(file("index.md", rootIndex(repo)));
    files.push(file("repository.md", concept({
        type: "Open Source Repository",
        title: repo.name,
        description: repo.description ?? `Open source repository at ${repo.name}.`,
        resource: repo.remoteUrl ?? repo.root,
        tags: ["open-source", "repository"],
        timestamp: repo.scannedAt,
        body: repositoryBody(repo, enrichment),
    })));
    files.push(file("architecture/index.md", sectionIndex("Architecture", [
        ["Overview", "overview.md", "High-level repository structure and detected source areas."],
    ])));
    files.push(file("architecture/overview.md", concept({
        type: "Architecture Overview",
        title: "Architecture Overview",
        description: "Detected source areas, languages, and package structure.",
        resource: ".",
        tags: ["architecture"],
        timestamp: repo.scannedAt,
        body: architectureBody(repo, enrichment),
    })));
    files.push(file("packages/index.md", packagesIndex(repo)));
    for (const pkg of repo.packages) {
        files.push(file(`packages/${packageSlug(pkg)}.md`, packageConcept(repo, pkg, enrichment)));
    }
    files.push(file("interfaces/index.md", interfacesIndex(repo)));
    if (repo.bins.length > 0) {
        files.push(file("interfaces/cli.md", concept({
            type: "CLI Interface",
            title: "Command Line Interfaces",
            description: "CLI entrypoints declared by repository package manifests.",
            resource: ".",
            tags: ["cli", "interface"],
            timestamp: repo.scannedAt,
            body: cliBody(repo),
        })));
    }
    files.push(file("workflows/index.md", workflowsIndex(repo)));
    files.push(file("workflows/local-development.md", workflowConcept(repo, "Development Workflow", "Local Development", "Detected local development scripts and package manager hints.", repo.scripts.filter((script) => scriptCategory(script) === "development"), ["development"], enrichment?.workflows?.development)));
    files.push(file("workflows/testing.md", workflowConcept(repo, "Test Workflow", "Testing", "Detected test scripts and test files.", repo.scripts.filter((script) => scriptCategory(script) === "test"), ["testing"], enrichment?.workflows?.testing, testsBody(repo))));
    files.push(file("workflows/release.md", workflowConcept(repo, "Release Workflow", "Release", "Detected release and publishing scripts, changelog, and CI hints.", repo.scripts.filter((script) => scriptCategory(script) === "release"), ["release"], enrichment?.workflows?.release, releaseBody(repo))));
    files.push(file("docs/index.md", docsIndex(repo)));
    files.push(file("docs/documentation.md", docsConcept(repo, enrichment)));
    files.push(file("operations/index.md", sectionIndex("Operations", [
        ["Configuration", "configuration.md", "Detected configuration files."],
        ["CI Workflows", "ci.md", "Detected continuous integration workflow files."],
        ["Test Suite", "test-suite.md", "Detected test files and test commands."],
    ])));
    files.push(file("operations/configuration.md", listConcept(repo, "Configuration Inventory", "Configuration Inventory", "Detected repository configuration files.", ["configuration"], repo.configs)));
    files.push(file("operations/ci.md", listConcept(repo, "CI Workflow", "CI Workflows", "Detected continuous integration workflow files.", ["ci", "automation"], repo.ci)));
    files.push(file("operations/test-suite.md", listConcept(repo, "Test Suite", "Test Suite", "Detected test files in the repository.", ["testing"], repo.tests)));
    files.push(file("log.md", logFile(repo)));
    return files.sort((a, b) => a.path.localeCompare(b.path));
}
function concept(input) {
    const frontmatter = [
        "---",
        `type: ${yamlScalar(input.type)}`,
        `title: ${yamlScalar(input.title)}`,
        `description: ${yamlScalar(input.description)}`,
        input.resource ? `resource: ${yamlScalar(input.resource)}` : undefined,
        input.tags?.length ? `tags: [${input.tags.map(yamlScalar).join(", ")}]` : undefined,
        `timestamp: ${yamlScalar(input.timestamp)}`,
        "---",
    ].filter(Boolean).join("\n");
    return `${frontmatter}\n\n${input.body.trim()}\n`;
}
function yamlScalar(value) {
    if (/^[A-Za-z0-9 _./:@-]+$/.test(value)) {
        return value;
    }
    return JSON.stringify(value);
}
function file(filePath, content) {
    return { path: filePath, content };
}
function rootIndex(repo) {
    const entries = [
        ["Repository", "repository.md", repo.description ?? "Top-level repository concept."],
        ["Architecture", "architecture/", "High-level source structure and detected languages."],
        ["Packages", "packages/", "Detected package and manifest concepts."],
        ["Interfaces", "interfaces/", "Detected command line and public interfaces."],
        ["Workflows", "workflows/", "Development, testing, and release workflows."],
        ["Documentation", "docs/", "Detected project documentation."],
        ["Operations", "operations/", "Configuration, CI, and test-suite inventories."],
    ];
    return sectionIndex(repo.name, entries);
}
function sectionIndex(title, entries) {
    return `# ${title}\n\n${entries.map(([label, href, description]) => `* [${label}](${href}) - ${description}`).join("\n")}\n`;
}
function repositoryBody(repo, enrichment) {
    return joinSections([
        "# Summary",
        "",
        enrichment?.overview?.summary || repo.summary,
    ].join("\n"), enrichmentSummary(enrichment), enrichedBullets("Purpose", enrichment?.overview?.purpose), enrichedBullets("Important Files", enrichment?.overview?.importantFiles?.map(code)), enrichedCitations(enrichment?.overview?.citations), [
        "# Detected Metadata",
        "",
        table([
            ["Field", "Value"],
            ["Repository root", code(repo.root)],
            ["Remote", repo.remoteUrl ? link(repo.remoteUrl, repo.remoteUrl) : "Not detected"],
            ["Default branch", repo.defaultBranch ? code(repo.defaultBranch) : "Not detected"],
            ["License", repo.license ?? "Not detected"],
            ["Package managers", repo.packageManagers.length ? repo.packageManagers.join(", ") : "Not detected"],
        ]),
    ].join("\n"), [
        "# Languages",
        "",
        repo.languages.length ? table([
            ["Language", "Files"],
            ...repo.languages.map((lang) => [lang.language, String(lang.files)]),
        ]) : "No source languages were detected.",
    ].join("\n"), [
        "# Navigation",
        "",
        "* [Architecture overview](/architecture/overview.md)",
        "* [Packages](/packages/)",
        "* [Workflows](/workflows/)",
        "* [Documentation](/docs/documentation.md)",
    ].join("\n"));
}
function architectureBody(repo, enrichment) {
    const sourceRows = repo.sourceDirectories.map((dir) => [code(dir.path), dir.kind]);
    const packageRows = repo.packages.map((pkg) => [
        link(titleForPackage(pkg), `/packages/${packageSlug(pkg)}.md`),
        code(displayPath(pkg.path)),
        pkg.manifestType,
    ]);
    return joinSections(enrichedBullets("LLM Architecture Notes", enrichment?.overview?.architecture), [
        "# Source Areas",
        "",
        sourceRows.length ? table([["Path", "Kind"], ...sourceRows]) : "No common source directories were detected.",
    ].join("\n"), [
        "# Packages",
        "",
        packageRows.length ? table([["Package", "Path", "Manifest"], ...packageRows]) : "No package manifests were detected.",
    ].join("\n"), [
        "# Language Mix",
        "",
        repo.languages.length ? table([
            ["Language", "Files"],
            ...repo.languages.map((lang) => [lang.language, String(lang.files)]),
        ]) : "No source languages were detected.",
    ].join("\n"));
}
function packagesIndex(repo) {
    const entries = repo.packages.map((pkg) => [
        titleForPackage(pkg),
        `${packageSlug(pkg)}.md`,
        pkg.description ?? `${pkg.manifestType} package at ${displayPath(pkg.path)}.`,
    ]);
    return sectionIndex("Packages", entries.length ? entries : [["Repository", "../repository.md", "No package manifests were detected."]]);
}
function packageConcept(repo, pkg, enrichment) {
    const packageEnrichment = enrichment?.packages.find((item) => item.packagePath === pkg.path);
    const scripts = pkg.scripts.length
        ? table([["Script", "Command"], ...pkg.scripts.map((script) => [code(script.name), code(script.command)])])
        : "No package scripts were detected.";
    const bins = pkg.bins.length
        ? table([["Command", "Target"], ...pkg.bins.map((bin) => [code(bin.name), code(bin.target)])])
        : "No CLI binaries were declared.";
    return concept({
        type: "Package",
        title: titleForPackage(pkg),
        description: pkg.description ?? `${pkg.manifestType} package at ${displayPath(pkg.path)}.`,
        resource: pkg.path === "." ? "." : `./${pkg.path}`,
        tags: uniqueTags(["package", manifestTag(pkg.manifestType)]),
        timestamp: repo.scannedAt,
        body: joinSections([
            "# Summary",
            "",
            packageEnrichment?.summary || pkg.summary,
        ].join("\n"), enrichedBullets("Responsibilities", packageEnrichment?.responsibilities), enrichedBullets("Public Interfaces", packageEnrichment?.publicInterfaces), enrichedBullets("Workflows", packageEnrichment?.workflows), enrichedBullets("Important Files", packageEnrichment?.importantFiles?.map(code)), enrichedBullets("Risks And Unknowns", packageEnrichment?.risksOrUnknowns), enrichedCitations(packageEnrichment?.citations), [
            "# Manifest",
            "",
            `Detected manifest: ${sourceRef(repo, pkg.manifestPath)}.`,
        ].join("\n"), packageDependenciesSection(repo, pkg), packageReadmeSection(pkg), packageEntrypointsSection(pkg), [
            "# Scripts",
            "",
            scripts,
        ].join("\n"), [
            "# CLI Binaries",
            "",
            bins,
        ].join("\n")),
    });
}
function interfacesIndex(repo) {
    const entries = [];
    if (repo.bins.length > 0) {
        entries.push(["Command Line Interfaces", "cli.md", "CLI entrypoints declared by package manifests."]);
    }
    return sectionIndex("Interfaces", entries.length ? entries : [["Repository", "../repository.md", "No explicit interfaces were detected."]]);
}
function cliBody(repo) {
    return [
        "# Declared Commands",
        "",
        table([
            ["Command", "Target", "Package"],
            ...repo.bins.map((bin) => [
                code(bin.name),
                code(bin.target),
                packageLinkByPath(repo, bin.packagePath),
            ]),
        ]),
        "",
        "# Source",
        "",
        "Commands are detected from `bin` declarations in package manifests.",
    ].join("\n");
}
function workflowsIndex(repo) {
    return sectionIndex("Workflows", [
        ["Local Development", "local-development.md", "Detected local development scripts and package manager hints."],
        ["Testing", "testing.md", "Detected test scripts and test files."],
        ["Release", "release.md", "Detected release and publishing hints."],
    ]);
}
function workflowConcept(repo, type, title, description, scripts, tags, enrichmentSection, extraBody) {
    const scriptTable = scripts.length
        ? table([["Script", "Command", "Package"], ...scripts.map((script) => [
                code(script.name),
                code(script.command),
                packageLinkByPath(repo, script.packagePath),
            ])])
        : "No matching package scripts were detected.";
    return concept({
        type,
        title,
        description,
        resource: ".",
        tags,
        timestamp: repo.scannedAt,
        body: joinSections(enrichedSection("LLM Summary", enrichmentSection), [
            "# Detected Scripts",
            "",
            scriptTable,
        ].join("\n"), [
            "# Package Managers",
            "",
            repo.packageManagers.length ? repo.packageManagers.map((manager) => `* ${manager}`).join("\n") : "No package manager lockfiles were detected.",
        ].join("\n"), extraBody ?? ""),
    });
}
function testsBody(repo) {
    return [
        "# Test Files",
        "",
        repo.tests.length ? fileList(repo.tests.slice(0, 50)) : "No test files were detected.",
    ].join("\n");
}
function releaseBody(repo) {
    const hints = [
        repo.hasChangelog ? "A changelog or release notes file was detected." : undefined,
        repo.ci.length ? "CI workflow files were detected." : undefined,
    ].filter(Boolean);
    return [
        "# Release Hints",
        "",
        hints.length ? hints.map((hint) => `* ${hint}`).join("\n") : "No release-specific files were detected.",
    ].join("\n");
}
function docsIndex(repo) {
    return sectionIndex("Documentation", [
        ["Documentation Inventory", "documentation.md", `${repo.docs.length} documentation files detected.`],
    ]);
}
function docsConcept(repo, enrichment) {
    return listConcept(repo, "Documentation Set", "Documentation Inventory", "Detected repository documentation files.", ["documentation"], repo.docs, enrichment?.documentation);
}
function listConcept(repo, type, title, description, tags, entries, enrichmentSection) {
    return concept({
        type,
        title,
        description,
        resource: ".",
        tags,
        timestamp: repo.scannedAt,
        body: joinSections(enrichedSection("LLM Summary", enrichmentSection), [
            "# Files",
            "",
            entries.length ? fileList(entries) : "No matching files were detected.",
        ].join("\n")),
    });
}
function logFile(repo) {
    const date = repo.scannedAt.slice(0, 10);
    return [
        "# Directory Update Log",
        "",
        `## ${date}`,
        `* **Generation**: Generated OKF bundle for [${repo.name}](/repository.md).`,
        "",
    ].join("\n");
}
function packageReadmeSection(pkg) {
    if (!pkg.readme) {
        return "";
    }
    return [
        "# README",
        "",
        `Package documentation detected at ${code(pkg.readme.path)}.`,
    ].join("\n");
}
function packageEntrypointsSection(pkg) {
    if (!pkg.entrypoints.length) {
        return "";
    }
    return [
        "# Entrypoints",
        "",
        pkg.entrypoints.map((entrypoint) => `* ${code(entrypoint.path)}`).join("\n"),
    ].join("\n");
}
function packageDependenciesSection(repo, pkg) {
    if (!pkg.dependencyNames.length) {
        return "";
    }
    const packagesByName = new Map(repo.packages.map((candidate) => [candidate.name, candidate]));
    const internalRows = pkg.dependencyNames
        .map((dependency) => packagesByName.get(dependency))
        .filter((dependency) => Boolean(dependency))
        .map((dependency) => [
        link(titleForPackage(dependency), `/packages/${packageSlug(dependency)}.md`),
        code(displayPath(dependency.path)),
    ]);
    const externalDependencies = pkg.dependencyNames
        .filter((dependency) => !packagesByName.has(dependency))
        .slice(0, 30);
    return joinSections(internalRows.length
        ? [
            "# Internal Dependencies",
            "",
            table([["Package", "Path"], ...internalRows]),
        ].join("\n")
        : "", externalDependencies.length
        ? [
            "# External Dependencies",
            "",
            externalDependencies.map(code).map((dependency) => `* ${dependency}`).join("\n"),
        ].join("\n")
        : "");
}
function enrichmentSummary(enrichment) {
    if (!enrichment) {
        return "";
    }
    const enrichedPackages = enrichment.packages.filter((pkg) => pkg.summary || pkg.responsibilities.length || pkg.importantFiles.length).length;
    return [
        "# Enrichment",
        "",
        table([
            ["Field", "Value"],
            ["Mode", enrichment.mode],
            ["Provider", enrichment.provider],
            ["Model", code(enrichment.model)],
            ["Package summaries", String(enrichedPackages)],
        ]),
    ].join("\n");
}
function enrichedSection(title, section) {
    if (!section || (!section.summary && !section.bullets.length && !section.citations.length)) {
        return "";
    }
    return [
        `# ${title}`,
        "",
        section.summary,
        enrichedBullets("Notes", section.bullets),
        enrichedCitations(section.citations),
    ].filter(Boolean).join("\n\n");
}
function enrichedBullets(title, bullets) {
    const filtered = bullets?.filter(Boolean) ?? [];
    if (!filtered.length) {
        return "";
    }
    return [
        `# ${title}`,
        "",
        filtered.map((bullet) => `* ${bullet}`).join("\n"),
    ].join("\n");
}
function enrichedCitations(citations) {
    const filtered = citations?.filter(Boolean) ?? [];
    if (!filtered.length) {
        return "";
    }
    return [
        "# Evidence",
        "",
        filtered.map((citation) => `* ${code(citation)}`).join("\n"),
    ].join("\n");
}
function joinSections(...sections) {
    return sections
        .map((section) => section.trim())
        .filter(Boolean)
        .join("\n\n");
}
export function packageSlug(pkg) {
    return slugify(pkg.path === "." ? pkg.name : pkg.path);
}
function manifestTag(type) {
    return type.replace(/\..+$/, "").toLowerCase();
}
function uniqueTags(tags) {
    return [...new Set(tags)];
}
function packageLinkByPath(repo, packagePath) {
    const pkg = repo.packages.find((candidate) => candidate.path === packagePath);
    if (!pkg) {
        return code(displayPath(packagePath));
    }
    return link(titleForPackage(pkg), `/packages/${packageSlug(pkg)}.md`);
}
function fileList(files) {
    return files.map((file) => `* ${sourceRefForFile(file.path)} - ${file.kind}`).join("\n");
}
function sourceRef(repo, filePath) {
    const url = sourceUrl(repo, filePath);
    return url ? `[${code(filePath)}](${url})` : code(filePath);
}
function sourceRefForFile(filePath) {
    return code(filePath);
}
function sourceUrl(repo, filePath) {
    if (!repo.remoteUrl) {
        return undefined;
    }
    const github = normalizeGithubRemote(repo.remoteUrl);
    if (!github) {
        return undefined;
    }
    const branch = repo.defaultBranch && repo.defaultBranch !== "HEAD" ? repo.defaultBranch : "main";
    return `${github}/blob/${encodeURIComponent(branch)}/${filePath.split("/").map(encodeURIComponent).join("/")}`;
}
function normalizeGithubRemote(remote) {
    const httpsMatch = remote.match(/^https:\/\/github\.com\/(.+?)(?:\.git)?$/);
    if (httpsMatch) {
        return `https://github.com/${httpsMatch[1]}`;
    }
    const sshMatch = remote.match(/^git@github\.com:(.+?)(?:\.git)?$/);
    if (sshMatch) {
        return `https://github.com/${sshMatch[1]}`;
    }
    return undefined;
}
function link(label, href) {
    return `[${label}](${href})`;
}
function code(value) {
    return `\`${value.replace(/`/g, "\\`")}\``;
}
function table(rows) {
    if (rows.length === 0) {
        return "";
    }
    const columnCount = rows[0]?.length ?? 0;
    const normalized = rows.map((row) => Array.from({ length: columnCount }, (_, index) => escapeTableCell(row[index] ?? "")));
    const separator = Array.from({ length: columnCount }, () => "---");
    return [normalized[0], separator, ...normalized.slice(1)]
        .map((row) => `| ${row.join(" | ")} |`)
        .join("\n");
}
function escapeTableCell(value) {
    return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
//# sourceMappingURL=okf.js.map