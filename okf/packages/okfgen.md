---
type: Package
title: okfgen
description: Generate Open Knowledge Format bundles for software repositories.
resource: .
tags: [package]
timestamp: 2026-06-13T19:53:05.066Z
---

# Summary

The `okfgen` package generates Open Knowledge Format (OKF) bundles for software repositories, focusing on scanning and documenting repository structures and workflows.

# Responsibilities

* Generate OKF bundles from repository files.

# Implementation Notes

* The `src/cli.ts` file implements a command-line interface (CLI) that allows users to initialize, generate, diff, explain, and validate OKF bundles.
* The `src/scanner.ts` file scans the repository for relevant files, including package manifests, documentation, and CI workflows, to gather information for the OKF generation.
* The `src/diff.ts` file compares existing OKF bundles with newly generated ones, identifying added, removed, or changed files.
* The `src/enrichment.ts` file provides functionality to enrich the generated OKF bundles using LLM (Large Language Model) capabilities, allowing for more detailed summaries based on repository evidence.
* The `src/okf.ts` file contains the logic for generating the actual OKF files based on the scanned repository data and any enrichment applied.
* The `src/config.ts` file manages the loading and writing of configuration files that dictate how the OKF generation behaves.
* The `src/validator.ts` file validates the generated OKF bundles to ensure they meet the expected format and structure.

# Public Interfaces

* The CLI commands such as `okfgen generate`, `okfgen diff`, and `okfgen validate` serve as the primary public interfaces for interacting with the package.

# Workflows

* The package supports workflows for generating OKF bundles, validating them, and comparing them against existing bundles.

# Important Files

* `src/cli.ts`
* `src/scanner.ts`
* `src/diff.ts`
* `src/enrichment.ts`
* `src/okf.ts`
* `src/config.ts`
* `src/validator.ts`

# Risks And Unknowns

* The LLM enrichment feature requires an API key and may have limitations based on the model and configuration used.

# Evidence

* `src/cli.ts`
* `src/scanner.ts`
* `src/diff.ts`
* `src/enrichment.ts`
* `src/okf.ts`
* `src/config.ts`
* `src/validator.ts`

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
