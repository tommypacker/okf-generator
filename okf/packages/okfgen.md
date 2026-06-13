---
type: Package
title: okfgen
description: Generate Open Knowledge Format bundles for software repositories.
resource: .
tags: [package]
timestamp: 2026-06-13T19:56:53.456Z
---

# Summary

okfgen is a CLI tool that generates Open Knowledge Format (OKF) bundles for software repositories by scanning source files, manifests, docs, and CI workflows, with optional LLM enrichment.

# Responsibilities

* Scan repository structure and detect packages, scripts, docs, configs, and CI files
* Generate OKF markdown bundles with repository, architecture, package, workflow, and interface concepts
* Provide CLI commands: init, generate, diff, explain, validate
* Support LLM-based enrichment for richer summaries (quick/explore modes)
* Validate generated OKF bundles for correctness

# Implementation Notes

* src/cli.ts: Main CLI entry point parsing commands (init, generate, diff, explain, validate) and delegating to core functions.
* src/scanner.ts: Scans repository files, detects packages, languages, docs, configs, and CI, returning a RepoInfo structure.
* src/okf.ts: Generates OKF markdown files from RepoInfo and optional enrichment, creating concepts for repository, architecture, packages, workflows, and interfaces.
* src/enrichment.ts: Handles LLM enrichment by collecting evidence, calling OpenAI-compatible API, and parsing responses into RepoEnrichment objects.
* src/diff.ts: Compares generated OKF bundle with an existing one, reporting added/removed/changed files.
* src/validator.ts: Validates OKF markdown files for required frontmatter and structure.
* src/config.ts: Manages okfgen.config.json read/write and default configuration.
* src/fs-utils.ts: Provides file system utilities: listFiles, readJson, writeFiles, ensureCleanDir.

# Public Interfaces

* CLI binary okfgen with commands: init, generate, diff, explain, validate
* Programmatic API exported from src/index.ts: writeDefaultConfig, compareDirectories, diffOkf, writeGeneratedBundle, enrichRepo, generateOkfFiles, scanRepo, validateOkf

# Workflows

* Build: tsc -p tsconfig.json
* Dev: node --loader ts-node/esm src/cli.ts
* Start: node dist/cli.js
* Check: npm run build

# Important Files

* `package.json`
* `src/cli.ts`
* `src/scanner.ts`
* `src/okf.ts`
* `src/enrichment.ts`
* `src/diff.ts`
* `src/validator.ts`
* `src/config.ts`
* `src/fs-utils.ts`
* `src/types.ts`

# Risks And Unknowns

* LLM enrichment requires OKFGEN_LLM_API_KEY or OPENAI_API_KEY and may incur costs depending on usage.
* Cache behavior for LLM responses is implementation-defined and may affect reproducibility.
* Undocumented edge cases in package detection for non-standard monorepo layouts.

# Evidence

* `package.json`
* `src/cli.ts`
* `src/scanner.ts`
* `src/okf.ts`
* `src/enrichment.ts`
* `src/diff.ts`
* `src/validator.ts`
* `src/config.ts`
* `src/fs-utils.ts`
* `src/types.ts`
* `README.md`

# Manifest

Detected manifest: [`package.json`](https://github.com/tommypacker/okf-generator/blob/main/package.json).

# External Dependencies

* `@types/node`
* `ts-node`
* `typescript`

# README

Package documentation detected at `README.md`.

# Entrypoints

* `src/index.ts`
* `src/cli.ts`

# Scripts

| Script | Command |
| --- | --- |
| `build` | `tsc -p tsconfig.json` |
| `dev` | `node --loader ts-node/esm src/cli.ts` |
| `start` | `node dist/cli.js` |
| `check` | `npm run build` |

# CLI Binaries

| Command | Target |
| --- | --- |
| `okfgen` | `./dist/cli.js` |
