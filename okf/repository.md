---
type: Repository
title: okfgen
description: Generate Open Knowledge Format bundles for software repositories.
resource: git@github.com:tommypacker/okf-generator.git
tags: [open-source, repository]
timestamp: 2026-06-13T19:56:53.456Z
---

# Summary

okfgen is a TypeScript CLI tool that generates Open Knowledge Format (OKF) bundles for software repositories. It scans repository files, package manifests, docs, CI workflows, and tests, then writes a structured OKF markdown bundle. The tool supports optional LLM enrichment for richer summaries and provides commands for diffing and validating generated bundles.

# Enrichment

| Field | Value |
| --- | --- |
| Mode | explore |
| Provider | openai-compatible |
| Model | `deepseek-v4-flash` |
| Package summaries | 1 |

# Purpose

* Generate Open Knowledge Format documentation bundles for software repositories
* Enable reproducible, deterministic repo documentation with optional LLM enrichment
* Provide CLI commands for init, generate, diff, explain, and validate

# Architecture Notes

* Modular TypeScript source with separate modules for scanning, OKF generation, enrichment, diffing, and validation
* CLI entrypoint src/cli.ts parses commands and orchestrates workflows
* Scanner (src/scanner.ts) detects packages, languages, docs, configs, CI, and tests
* OKF generator (src/okf.ts) produces markdown concepts for repository, architecture, packages, workflows, interfaces, and operations
* LLM enrichment (src/enrichment.ts) collects evidence and calls OpenAI-compatible API for summaries

# Important Files

* `src/cli.ts`
* `src/scanner.ts`
* `src/okf.ts`
* `src/enrichment.ts`
* `src/diff.ts`
* `src/validator.ts`
* `src/config.ts`
* `src/fs-utils.ts`
* `src/types.ts`
* `package.json`
* `README.md`

# Evidence

* `README.md`
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

# Detected Metadata

| Field | Value |
| --- | --- |
| Repository root | `/Users/tommy/Documents/opensource/okf` |
| Remote | [git@github.com:tommypacker/okf-generator.git](git@github.com:tommypacker/okf-generator.git) |
| Default branch | `main` |
| License | Apache-2.0 |
| Package managers | npm |

# Languages

| Language | Files |
| --- | --- |
| TypeScript | 10 |
| Markdown | 1 |
