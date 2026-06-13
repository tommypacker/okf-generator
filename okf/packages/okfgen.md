---
type: Package
title: okfgen
description: Generate Open Knowledge Format bundles for software repositories.
resource: .
tags: [package]
timestamp: 2026-06-13T19:39:57.551Z
---

# Summary

The `okfgen` package generates Open Knowledge Format (OKF) bundles for software repositories, focusing on scanning and documenting repository structures and workflows.

# Responsibilities

* Generate OKF bundles from repository files.

# Implementation Notes

* The `src/cli.ts` file implements a command-line interface (CLI) that allows users to initialize, generate, diff, explain, and validate OKF bundles.
* The `src/scanner.ts` file scans the repository for relevant files, including package manifests, documentation, and configuration files, to gather information for the OKF generation.
* The `src/diff.ts` file provides functionality to compare existing OKF bundles with newly generated ones, identifying added, removed, or changed files.
* The `src/enrichment.ts` file handles LLM (Large Language Model) enrichment, allowing for enhanced summaries based on repository evidence.
* The `src/okf.ts` file generates the actual OKF files based on the scanned repository data and any enrichment provided.
* The `src/validator.ts` file validates the generated OKF bundles to ensure they conform to expected formats and standards.
* The `src/config.ts` file manages configuration settings for the OKF generation process, including output paths and LLM options.

# Public Interfaces

* The CLI command `okfgen` serves as the main entry point for users to interact with the package.

# Workflows

* The package supports workflows for generating OKF bundles, validating them, and diffing against existing bundles.

# Important Files

* `src/cli.ts`
* `src/scanner.ts`
* `src/diff.ts`
* `src/enrichment.ts`
* `src/okf.ts`
* `src/validator.ts`
* `src/config.ts`

# Risks And Unknowns

* The package relies on LLM enrichment, which requires an API key and may introduce variability in output based on the model used.

# Evidence

* `src/cli.ts`
* `src/scanner.ts`
* `src/diff.ts`
* `src/enrichment.ts`
* `src/okf.ts`
* `src/validator.ts`
* `src/config.ts`

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
