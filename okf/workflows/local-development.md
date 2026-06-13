---
type: Development Workflow
title: Local Development
description: Detected local development scripts and package manager hints.
resource: .
tags: [development]
timestamp: 2026-06-13T19:10:57.764Z
---

# LLM Summary

Development involves building and running the CLI for local testing.

# Notes

* Run `npm run dev` to start the development environment.

# Evidence

* `./README.md`

# Detected Scripts

| Script | Command | Package |
| --- | --- | --- |
| `dev` | `node --loader ts-node/esm src/cli.ts` | [okfgen](/packages/okfgen.md) |
| `start` | `node dist/cli.js` | [okfgen](/packages/okfgen.md) |

# Package Managers

* npm
