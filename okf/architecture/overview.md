---
type: Architecture
title: Architecture Overview
description: "Detected source areas, languages, and package structure."
resource: .
tags: [architecture]
timestamp: 2026-06-13T19:56:53.456Z
---

# LLM Architecture Notes

* Modular TypeScript source with separate modules for scanning, OKF generation, enrichment, diffing, and validation
* CLI entrypoint src/cli.ts parses commands and orchestrates workflows
* Scanner (src/scanner.ts) detects packages, languages, docs, configs, CI, and tests
* OKF generator (src/okf.ts) produces markdown concepts for repository, architecture, packages, workflows, interfaces, and operations
* LLM enrichment (src/enrichment.ts) collects evidence and calls OpenAI-compatible API for summaries

# Source Areas

| Path | Kind |
| --- | --- |
| `src` | Source Directory |

# Packages

| Package | Path | Manifest |
| --- | --- | --- |
| [okfgen](/packages/okfgen.md) | `repository root` | package.json |

# Language Mix

| Language | Files |
| --- | --- |
| TypeScript | 10 |
| Markdown | 1 |
