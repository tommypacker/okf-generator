---
type: CLI Tool
title: okfgen
description: Generate Open Knowledge Format bundles for software repositories.
resource: git@github.com:tommypacker/okf-generator.git
tags: [open-source, repository, cli-tool]
timestamp: 2026-06-13T20:40:58.107Z
---

# Summary

okfgen is a TypeScript CLI that scans a software repository and generates an Open Knowledge Format (OKF) bundle, with optional LLM-based enrichment for richer summaries. It supports commands for init, generate, diff, explain, and validate. The tool detects packages, scripts, CI workflows, docs, configs, and tests, producing a structured markdown bundle describing the repository's architecture and interfaces.

# Enrichment

| Field | Value |
| --- | --- |
| Mode | explore |
| Provider | openai-compatible |
| Model | `deepseek-v4-flash` |
| Package summaries | 1 |

# Purpose

* Generate Open Knowledge Format bundles for software repositories
* Provide CLI commands for init, generate, diff, explain, and validate OKF bundles
* Optionally enrich generated output with LLM summaries using OpenAI-compatible APIs

# Architecture Notes

* TypeScript CLI with ES modules, compiled via tsc, run via node
* File scanning (scanner.ts), OKF generation (okf.ts), diffing (diff.ts), enrichment (enrichment.ts), config (config.ts), validation (validator.ts), and utilities (fs-utils.ts)

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

# Evidence

* `README.md`
* `package.json`
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
* `.github/workflows/ci.yml`

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
