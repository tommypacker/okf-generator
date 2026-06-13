---
type: Package
title: okfgen
description: Generate Open Knowledge Format bundles for software repositories.
resource: .
tags: [package]
timestamp: 2026-06-13T19:00:57.172Z
---

# Summary

Generate Open Knowledge Format bundles for software repositories.

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
