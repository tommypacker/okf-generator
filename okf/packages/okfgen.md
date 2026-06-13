---
type: Package
title: okfgen
description: Generate Open Knowledge Format bundles for software repositories.
resource: .
tags: [package]
timestamp: 2026-06-13T19:10:57.764Z
---

# Summary

The `okfgen` package generates Open Knowledge Format bundles for software repositories, focusing on scanning and documenting repository structures and contents.

# Responsibilities

* Generate OKF bundles from software repositories

# Public Interfaces

* okfgen CLI

# Workflows

* npm run build
* npm run dev
* npm run start
* npm run check

# Important Files

* `src/cli.ts`
* `package.json`
* `README.md`

# Risks And Unknowns

* Generated OKF bundles may vary based on repository structure and content.

# Evidence

* `./README.md`
* `./package.json`

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
