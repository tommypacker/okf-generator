---
type: Workflow
title: Local Development
description: Detected local development scripts and package manager hints.
resource: .
tags: [development]
timestamp: 2026-06-13T19:39:57.551Z
---

# LLM Summary

The development workflow involves initializing and configuring the repository for OKF generation.

# Notes

* Users can run `okfgen init` to set up the configuration for the repository.

# Evidence

* `README.md`

# Detected Scripts

| Script | Command | Package |
| --- | --- | --- |
| `dev` | `node --loader ts-node/esm src/cli.ts` | [okfgen](/packages/okfgen.md) |
| `start` | `node dist/cli.js` | [okfgen](/packages/okfgen.md) |

# Package Managers

* npm
