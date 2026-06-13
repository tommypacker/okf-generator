import { slugify } from "./fs-utils.js";
import { displayPath, scriptCategory, titleForPackage } from "./scanner.js";
export function generateOkfFiles(repo, enrichment) {
    const files = [];
    const packageFiles = repo.packages.map((pkg) => file(`packages/${packageSlug(pkg)}.md`, packageConcept(repo, pkg, enrichment)));
    const interfaceFiles = interfaceConceptFiles(repo);
    const workflowFiles = workflowConceptFiles(repo, enrichment);
    const operationFiles = operationConceptFiles(repo);
    const documentationFiles = documentationConceptFiles(repo, enrichment);
    files.push(file("index.md", rootIndex(repo, {
        hasPackages: packageFiles.length > 0,
        hasInterfaces: interfaceFiles.length > 0,
        hasWorkflows: workflowFiles.length > 0,
        hasDocumentation: documentationFiles.length > 0,
        hasOperations: operationFiles.length > 0,
    })));
    files.push(file("repository.md", concept({
        type: "Repository",
        title: repo.name,
        description: repo.description ?? `Open source repository at ${repo.name}.`,
        resource: repo.remoteUrl ?? repo.root,
        tags: ["open-source", "repository"],
        timestamp: repo.scannedAt,
        body: repositoryBody(repo, enrichment),
    })));
    files.push(file("architecture/overview.md", concept({
        type: "Architecture",
        title: "Architecture Overview",
        description: "Detected source areas, languages, and package structure.",
        resource: ".",
        tags: ["architecture"],
        timestamp: repo.scannedAt,
        body: architectureBody(repo, enrichment),
    })));
    if (packageFiles.length) {
        files.push(file("packages/index.md", packagesIndex(repo)));
        files.push(...packageFiles);
    }
    if (interfaceFiles.length) {
        files.push(file("interfaces/index.md", sectionIndex("Interfaces", interfaceFiles.map((item) => item.entry))));
        for (const interfaceFile of interfaceFiles) {
            files.push(interfaceFile.file);
        }
    }
    if (workflowFiles.length) {
        files.push(file("workflows/index.md", sectionIndex("Workflows", workflowFiles.map((item) => item.entry))));
        for (const workflowFile of workflowFiles) {
            files.push(workflowFile.file);
        }
    }
    if (operationFiles.length) {
        files.push(file("operations/index.md", sectionIndex("Operations", operationFiles.map((item) => item.entry))));
        for (const operationFile of operationFiles) {
            files.push(operationFile.file);
        }
    }
    if (documentationFiles.length) {
        files.push(file("docs/index.md", sectionIndex("Documentation", documentationFiles.map((item) => item.entry))));
        for (const documentationFile of documentationFiles) {
            files.push(documentationFile.file);
        }
    }
    return files.sort((a, b) => a.path.localeCompare(b.path));
}
function workflowConceptFiles(repo, enrichment) {
    const developmentScripts = repo.scripts.filter((script) => scriptCategory(script) === "development");
    const testScripts = repo.scripts.filter((script) => scriptCategory(script) === "test");
    const releaseScripts = repo.scripts.filter((script) => scriptCategory(script) === "release");
    const entries = [];
    if (hasSubstantiveDevelopmentWorkflow(repo, developmentScripts)) {
        entries.push({
            entry: ["Local Development", "local-development.md", "Detected local development scripts and package manager hints."],
            file: file("workflows/local-development.md", workflowConcept(repo, "Local Development", "Detected local development scripts and package manager hints.", developmentScripts, ["development"], enrichment?.workflows?.development)),
        });
    }
    if (testScripts.length || repo.tests.length) {
        entries.push({
            entry: ["Testing", "testing.md", "Detected test scripts and test files."],
            file: file("workflows/testing.md", workflowConcept(repo, "Testing", "Detected test scripts and test files.", testScripts, ["testing"], enrichment?.workflows?.testing, testsBody(repo))),
        });
    }
    if (releaseScripts.length || repo.hasChangelog || repo.ci.length) {
        entries.push({
            entry: ["Release", "release.md", "Detected release and publishing hints."],
            file: file("workflows/release.md", workflowConcept(repo, "Release", "Detected release and publishing scripts, changelog, and CI hints.", releaseScripts, ["release"], enrichment?.workflows?.release, releaseBody(repo))),
        });
    }
    return entries;
}
function interfaceConceptFiles(repo) {
    if (repo.bins.length <= 1) {
        return [];
    }
    return [{
            entry: ["Command Line Interfaces", "cli.md", "CLI entrypoints declared by package manifests."],
            file: file("interfaces/cli.md", concept({
                type: "Interface",
                title: "Command Line Interfaces",
                description: "CLI entrypoints declared by repository package manifests.",
                resource: ".",
                tags: ["cli", "interface"],
                timestamp: repo.scannedAt,
                body: cliBody(repo),
            })),
        }];
}
function operationConceptFiles(repo) {
    const entries = [];
    const substantiveConfigs = repo.configs.filter((config) => isSubstantiveConfig(config.path));
    if (substantiveConfigs.length) {
        entries.push({
            entry: ["Configuration", "configuration.md", "Detected configuration files."],
            file: file("operations/configuration.md", listConcept(repo, "Configuration Inventory", "Detected repository configuration files.", ["configuration"], substantiveConfigs)),
        });
    }
    if (repo.ci.length) {
        entries.push({
            entry: ["CI Workflows", "ci.md", "Detected continuous integration workflow files."],
            file: file("operations/ci.md", listConcept(repo, "CI Workflows", "Detected continuous integration workflow files.", ["ci", "automation"], repo.ci)),
        });
    }
    if (repo.tests.length) {
        entries.push({
            entry: ["Test Suite", "test-suite.md", "Detected test files and test commands."],
            file: file("operations/test-suite.md", listConcept(repo, "Test Suite", "Detected test files in the repository.", ["testing"], repo.tests)),
        });
    }
    return entries;
}
function documentationConceptFiles(repo, enrichment) {
    const substantiveDocs = repo.docs.filter((doc) => isSubstantiveDoc(doc.path));
    if (!substantiveDocs.length) {
        return [];
    }
    return [{
            entry: ["Documentation Inventory", "documentation.md", `${substantiveDocs.length} documentation file${substantiveDocs.length === 1 ? "" : "s"} detected.`],
            file: file("docs/documentation.md", listConcept(repo, "Documentation Inventory", "Detected repository documentation files.", ["documentation"], substantiveDocs, enrichment?.documentation)),
        }];
}
function hasSubstantiveDevelopmentWorkflow(repo, developmentScripts) {
    if (developmentScripts.length === 0) {
        return false;
    }
    const packageCount = new Set(developmentScripts.map((script) => script.packagePath)).size;
    if (packageCount > 1 || developmentScripts.length >= 3) {
        return true;
    }
    return repo.packages.length > 1;
}
function isSubstantiveConfig(filePath) {
    if (filePath === "package.json" ||
        filePath === "pyproject.toml" ||
        filePath === "Cargo.toml" ||
        filePath === "go.mod" ||
        /^tsconfig.*\.json$/.test(filePath)) {
        return false;
    }
    return true;
}
function isSubstantiveDoc(filePath) {
    return !/^README(\.|$)/i.test(filePath);
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
function rootIndex(repo, options) {
    const entries = [
        ["Repository", "repository.md", repo.description ?? "Top-level repository concept."],
        ["Architecture", "architecture/overview.md", "High-level source structure and detected languages."],
    ];
    if (options.hasPackages) {
        entries.push(["Packages", "packages/", "Detected package and manifest concepts."]);
    }
    if (options.hasInterfaces) {
        entries.push(["Interfaces", "interfaces/", "Detected command line and public interfaces."]);
    }
    if (options.hasWorkflows) {
        entries.push(["Workflows", "workflows/", "Detected repository workflows."]);
    }
    if (options.hasDocumentation) {
        entries.push(["Documentation", "docs/", "Detected project documentation."]);
    }
    if (options.hasOperations) {
        entries.push(["Operations", "operations/", "Detected operational inventories."]);
    }
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
    ].join("\n"), enrichmentSummary(enrichment), enrichedBullets("Purpose", enrichment?.overview?.purpose), enrichedBullets("Architecture Notes", enrichment?.overview?.architecture), enrichedBullets("Important Files", enrichment?.overview?.importantFiles?.map(code)), enrichedCitations(enrichment?.overview?.citations), [
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
        ].join("\n"), enrichedBullets("Responsibilities", packageEnrichment?.responsibilities), enrichedBullets("Implementation Notes", packageEnrichment?.implementation), enrichedBullets("Public Interfaces", packageEnrichment?.publicInterfaces), enrichedBullets("Workflows", packageEnrichment?.workflows), enrichedBullets("Important Files", packageEnrichment?.importantFiles?.map(code)), enrichedBullets("Risks And Unknowns", packageEnrichment?.risksOrUnknowns), enrichedCitations(packageEnrichment?.citations), [
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
function workflowConcept(repo, title, description, scripts, tags, enrichmentSection, extraBody) {
    const scriptTable = scripts.length
        ? table([["Script", "Command", "Package"], ...scripts.map((script) => [
                code(script.name),
                code(script.command),
                packageLinkByPath(repo, script.packagePath),
            ])])
        : "No matching package scripts were detected.";
    return concept({
        type: "Workflow",
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
function listConcept(repo, title, description, tags, entries, enrichmentSection) {
    return concept({
        type: "Inventory",
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