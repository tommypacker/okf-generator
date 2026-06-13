---
type: Architecture
title: Architecture Overview
description: "Detected source areas, languages, and package structure."
resource: .
tags: [architecture]
timestamp: 2026-06-13T20:40:58.107Z
---

# LLM Architecture Notes

* TypeScript CLI with ES modules, compiled via tsc, run via node
* File scanning (scanner.ts), OKF generation (okf.ts), diffing (diff.ts), enrichment (enrichment.ts), config (config.ts), validation (validator.ts), and utilities (fs-utils.ts)

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
