---
type: Repository
title: okfgen
description: Generate Open Knowledge Format bundles for software repositories.
resource: git@github.com:tommypacker/okf-generator.git
tags: [open-source, repository]
timestamp: 2026-06-13T19:39:57.551Z
---

# Summary

The `okfgen` package generates Open Knowledge Format (OKF) bundles for software repositories, focusing on scanning and documenting repository structures and workflows.

# Enrichment

| Field | Value |
| --- | --- |
| Mode | explore |
| Provider | openai-compatible |
| Model | `gpt-4o-mini` |
| Package summaries | 1 |

# Purpose

* Generate OKF bundles from repository files.

# Architecture Notes

* The package utilizes a CLI for user interaction and various modules for scanning, generating, and validating OKF bundles.

# Important Files

* `src/cli.ts`
* `src/scanner.ts`
* `src/diff.ts`
* `src/enrichment.ts`
* `src/okf.ts`
* `src/validator.ts`
* `src/config.ts`

# Evidence

* `README.md`
* `package.json`

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

# Navigation

* [Architecture overview](/architecture/overview.md)
* [Packages](/packages/)
* [Workflows](/workflows/)
* [Documentation](/docs/documentation.md)
