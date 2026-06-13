---
type: Package
title: okfgen
description: Generate Open Knowledge Format bundles for software repositories.
resource: .
tags: [package]
timestamp: 2026-06-13T20:40:58.107Z
---

# Summary

A CLI tool that scans a software repository and generates an Open Knowledge Format (OKF) bundle, with optional LLM-based enrichment for richer summaries. It supports generation, diffing, validation, and explanation of the OKF bundle against the repository state.

# Responsibilities

* Scan repository files, packages, scripts, and CI workflows
* Generate OKF markdown files for repository structure, packages, interfaces, and workflows
* Provide CLI commands for init, generate, diff, explain, and validate
* Optionally enrich output with LLM-generated summaries using OpenAI-compatible APIs
* Support configurable package scopes and write modes

# Implementation Notes

* src/cli.ts: Parses command-line arguments and dispatches to init, generate, diff, explain, or validate commands, handling flags and progress reporting.
* src/scanner.ts: Detects packages, docs, configs, tests, CI files, languages, and source directories from file tree, returning a RepoInfo struct.
* src/okf.ts: Generates all OKF markdown files (repository overview, architecture, packages, interfaces, workflows, operations, docs) with YAML frontmatter.
* src/diff.ts: Compares generated OKF bundle against an existing one, reporting added/removed/changed files, and writes the generated bundle to disk.
* src/enrichment.ts: Handles LLM enrichment by collecting evidence files, calling OpenAI-compatible chat endpoints, and parsing structured enrichment JSON for overviews and packages.
* src/config.ts: Loads and writes okfgen.config.json, supports overrides from CLI flags and environment variables.
* src/validator.ts: Validates OKF markdown files for required frontmatter, reserved file conventions, and date formatting in log files.
* src/fs-utils.ts: Provides utilities for file existence checks, JSON reading, recursive file listing, directory cleaning, and file writing.
* src/cli.ts: Parses CLI arguments and dispatches to init, generate, diff, explain, or validate commands; handles flags, progress reporting, and exit codes.

# Public Interfaces

* CLI: okfgen init, okfgen generate, okfgen diff, okfgen explain, okfgen validate
* Exported modules: writeDefaultConfig, diffOkf, enrichRepo, generateOkfFiles, scanRepo, validateOkf, and TypeScript types from src/types.ts

# Workflows

* npm run build (tsc compilation)
* npm run dev (ts-node src/cli.ts)
* npm start (node dist/cli.js)
* CI: npm ci → npm run build → validate OKF → smoke test scan-mode generation

# Important Files

* `src/cli.ts`
* `src/scanner.ts`
* `src/okf.ts`
* `src/diff.ts`
* `src/enrichment.ts`
* `src/config.ts`
* `src/validator.ts`
* `src/fs-utils.ts`
* `src/types.ts`
* `src/index.ts`
* `package.json`
* `tsconfig.json`
* `.github/workflows/ci.yml`

# Risks And Unknowns

* LLM enrichment requires an API key and incurs costs; offline scan mode is the default and deterministic.
* Package detection scope (primary/workspaces/all) may include or exclude packages; users must configure via flag or config file.
* Write modes (create, update, reset) affect output directory behavior; reset deletes existing content.

# Evidence

* `src/cli.ts`
* `src/scanner.ts`
* `src/okf.ts`
* `src/diff.ts`
* `src/enrichment.ts`
* `src/config.ts`
* `src/validator.ts`
* `src/fs-utils.ts`
* `src/types.ts`
* `src/index.ts`
* `package.json`
* `.github/workflows/ci.yml`

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
