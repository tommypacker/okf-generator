# repo-okf

`repo-okf` generates an [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) bundle for a software repository.

The first version is a local TypeScript CLI focused on open source repos. It scans common repository files, package manifests, docs, CI workflows, tests, configs, and package directories, then writes a reviewable OKF bundle.

## Install

```bash
npm install
npm run build
```

## Commands

```bash
repo-okf init --repo /path/to/repo
repo-okf generate --repo /path/to/repo --out /path/to/repo/okf
repo-okf generate --repo /path/to/repo --out /path/to/repo/okf --update --mode quick
repo-okf generate --repo /path/to/repo --out /path/to/repo/okf --reset --mode explore
repo-okf generate --repo /path/to/repo --out /path/to/repo/okf --package-scope workspaces
repo-okf generate --repo /path/to/repo --out /path/to/repo/okf --package-scope all
repo-okf diff --repo /path/to/repo --okf /path/to/repo/okf
repo-okf explain <package-or-path> --repo /path/to/repo
repo-okf validate --okf /path/to/repo/okf
```

During local development, run the built CLI with:

```bash
node dist/cli.js generate --repo . --out okf
```

The CLI prints progress messages to stderr by default:

```text
[repo-okf] Starting generation. Output: /path/to/repo/okf
[repo-okf] Scanning repository: /path/to/repo
[repo-okf] Detected repo "example": 2 package(s), 4 doc file(s), ...
[repo-okf] Rendering OKF files.
[repo-okf] Writing 21 OKF files to /path/to/repo/okf.
```

Use `--quiet` to suppress progress output:

```bash
node dist/cli.js generate --repo . --out okf --quiet
```

## Config

`repo-okf init` writes `repo-okf.config.json` into the target repository. `generate`, `diff`, and `explain` automatically read it. CLI flags override config values.

```bash
node dist/cli.js init --repo /path/to/repo
node dist/cli.js generate --repo /path/to/repo --update
```

Config can set defaults for output path, mode, package scope, LLM limits, and cache behavior.

## Output behavior

By default, `generate` writes only when the output directory is empty or missing. Choose one of these options for an existing OKF directory:

- `--update`: overwrite generated OKF files and preserve extra files.
- `--reset`: delete and recreate the output directory before writing.
- `--force`: alias for `--reset`.

```bash
node dist/cli.js generate --repo . --out okf --update
node dist/cli.js generate --repo . --out okf --reset
```

## Package detection

By default, package detection uses `--package-scope primary`. This keeps package concepts focused on:

- the root manifest
- common monorepo roots like `apps/*`, `packages/*`, `crates/*`, `cmd/*`, `services/*`, and `libs/*`
- exact workspace paths declared in the root manifest

It skips noisy paths such as examples, demos, fixtures, tests, docs sites, generated files, and vendor folders.

Package scopes:

- `primary`: root package, direct common monorepo packages, and exact workspace paths.
- `workspaces`: root package, direct common monorepo packages, and all root workspace patterns.
- `all`: every detected package manifest.

```bash
node dist/cli.js generate --repo . --out okf --reset --package-scope primary
node dist/cli.js generate --repo . --out okf --reset --package-scope workspaces
node dist/cli.js generate --repo . --out okf --reset --package-scope all
```

## LLM enrichment

By default, generation runs in `scan` mode, which is offline and deterministic. Use `--mode quick` or `--mode explore` to add richer summaries grounded in bounded repository evidence.

```bash
export OPENAI_API_KEY=...
node dist/cli.js generate --repo /path/to/repo --out /path/to/repo/okf --update --mode quick
```

The LLM adapter uses an OpenAI-compatible chat completions endpoint. You can point it at OpenAI or another compatible provider:

```bash
node dist/cli.js generate \
  --repo /path/to/repo \
  --out /path/to/repo/okf \
  --update \
  --mode quick \
  --llm-model gpt-4o-mini \
  --llm-base-url https://api.openai.com/v1
```

Environment variables:

- `REPO_OKF_LLM_API_KEY` or `OPENAI_API_KEY`
- `REPO_OKF_MODE`
- `REPO_OKF_PACKAGE_SCOPE`
- `REPO_OKF_LLM_MODEL`
- `REPO_OKF_LLM_BASE_URL` or `OPENAI_BASE_URL`
- `REPO_OKF_LLM_MAX_FILES`
- `REPO_OKF_LLM_MAX_FILES_PER_ROLLUP_CHUNK`
- `REPO_OKF_LLM_MAX_BYTES_PER_FILE`
- `REPO_OKF_LLM_MAX_PACKAGE_CALLS`
- `REPO_OKF_LLM_MAX_PACKAGE_FILES`

Modes:

- `scan`: offline repository scan only. This is the default.
- `quick`: one repository rollup call over selected evidence files. This is the cheapest LLM mode and defaults to 48 evidence files.
- `explore`: package-level calls first, repository evidence chunk summaries second, then a final repository rollup. Package calls include manifest, README, entrypoints, nearby configs, tests, and a compact file-tree sample. This defaults to 160 repository evidence files, 40 files per repository rollup chunk, 12 package calls, and 40 evidence files per package.

```bash
node dist/cli.js generate \
  --repo /path/to/repo \
  --out /path/to/repo/okf \
  --update \
  --mode explore \
  --llm-max-package-calls 12 \
  --llm-max-package-files 40 \
  --llm-max-files-per-rollup-chunk 40
```

`diff --mode quick` and `diff --mode explore` use the same enrichment path, so CI should pass the same mode, model, and limits used during generation. For strict deterministic CI, run `diff` in the default `scan` mode.

## Diffing

`repo-okf diff` regenerates the bundle into a temporary directory and compares it against the committed OKF directory. It reports added, removed, and changed files. Use `--check` in CI to exit non-zero when the OKF bundle is stale.

```bash
node dist/cli.js diff --repo . --okf okf --check
```

## Current scope

The generator intentionally starts conservative. It creates concepts for:

- Repository overview
- Architecture overview
- Detected packages and workspaces
- CLI interfaces from package manifests
- Development, testing, and release workflows
- Documentation, configuration, CI, and test-suite concepts
- Directory indexes and an update log

Generated claims are grounded in detected files and manifests rather than inferred behavior.

Each generated bundle also includes `.repo-okf.json`, a machine-readable generation manifest with the tool version, mode, package scope, repository identity, and generated file list.

## Explain

Use `explain` to inspect why a package was included and where its OKF file is written:

```bash
node dist/cli.js explain repo-okf --repo .
node dist/cli.js explain packages/web --repo /path/to/repo --package-scope workspaces
```

The command accepts a package name, package path, manifest path, or generated package markdown path.

## LLM cache

LLM responses are cached by prompt, model, and base URL to avoid paying for identical reruns.

```bash
node dist/cli.js generate --repo . --mode explore --update
node dist/cli.js generate --repo . --mode explore --update --no-cache
node dist/cli.js generate --repo . --mode explore --update --cache-dir .repo-okf-cache
```

The default cache directory is `.okf-cache` under the scanned repository. Set `REPO_OKF_LLM_CACHE=false` to disable caching or `REPO_OKF_LLM_CACHE_DIR` to choose a default cache directory.
