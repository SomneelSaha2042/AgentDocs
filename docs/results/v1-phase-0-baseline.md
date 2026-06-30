# V1 Phase 0 Baseline

Date: 2026-06-30

This note records the Phase 0 baseline for the v1 product push. It is a
repeatable local proof run against this repository's documentation, using the
built CLI and an isolated output directory.

## Target And Commands

Target:

```txt
./docs
```

Build and first context sample:

```bash
node packages/cli/dist/agentdocs.js --out .agentdocs-phase0-baseline try ./docs --goal "implement authentication" --json
```

Additional samples:

```bash
node packages/cli/dist/agentdocs.js --out .agentdocs-phase0-baseline --json context "connect MCP to Codex"
node packages/cli/dist/agentdocs.js --out .agentdocs-phase0-baseline --json context "debug stale context"
node packages/cli/dist/agentdocs.js --out .agentdocs-phase0-baseline --json handoff "implement authentication"
node packages/cli/dist/agentdocs.js --out .agentdocs-phase0-baseline --json verify-context --task "implement authentication"
```

## Build Counts

From `.agentdocs-phase0-baseline/manifest.json`:

| Metric | Value |
| --- | ---: |
| Pages | 29 |
| Chunks | 201 |
| Entities | 170 |
| Edges | 360 |
| Task packs | 12 |
| Supported files | 29 |
| Compiled files | 29 |
| Coverage ratio | 1.0 |

Source coverage message:

```txt
29 of 29 supported docs file(s) compiled.
```

Approximate generated artifact size:

```txt
53 files, 2,632,985 bytes (~2,571 KiB)
```

Largest generated files:

| File | Bytes |
| --- | ---: |
| `agent-map.json` | 1,482,367 |
| `index.sqlite` | 466,944 |
| `chunks.jsonl` | 258,959 |
| `reports/agent-readiness.json` | 99,346 |

## Task Packs

Generated task-pack files:

```txt
authentication.md
configuration.md
deployment.md
errors.md
installation.md
migration.md
pagination.md
query-invalidation.md
quickstart.md
route-handlers.md
schema-validation.md
webhooks.md
```

`llms.txt` lists the same 12 task packs. Confidence is high for
authentication, configuration, deployment, installation, pagination,
query-invalidation, route-handlers, schema-validation, and webhooks; medium for
errors, migration, and quickstart.

## Readiness

Doctor score:

```txt
91/100
```

Summary:

```txt
Passing checks: 24
Warnings: 6
Critical issues: 0
```

Warnings:

- `has_config`: no AgentDocs config found.
- `has_headings`: one or more pages contain no headings or frontmatter title.
- `has_giant_pages`: 3 pages exceed 12,000 characters.
- `has_deprecated_markers`: 8 deprecated markers require review.
- `has_security_warnings`: no security or secret-handling warnings found.
- `has_env_var_examples`: no environment variable code examples found.

## Artifact Inspection

`llms.txt` starts with `Domain Docs`, describes 29 source pages, lists start
here pages such as `agents/domain.md`, `agents/issue-tracker.md`,
`guide/agent-workflow.md`, and links to all generated task packs.

Generated `AGENTS.md` includes package evidence for
`@somneelsaha/agentdocs`, installation commands, common tasks, common mistakes,
coding-agent guidelines, and source docs.

The generated readiness report is actionable and includes evidence paths and
recommended next actions for each warning.

## Context Samples

### Goal: implement authentication

Selected task pack:

```txt
authentication
```

Handoff state:

```txt
fresh
```

Top sources:

```txt
guide/quick-start.md
reference/cli.md
guide/agent-workflow.md
```

Verification:

```txt
pass - Context is safe to use for this task.
```

Approximate handoff size:

```txt
19,833 characters (~4,959 tokens)
```

### Goal: connect MCP to Codex

Summary:

```txt
Use 5 complementary source section(s) for "connect MCP to Codex".
```

Read first:

```txt
agentdocs://task-packs/pagination.md
agentdocs://pages/page_9e9f5a4e4d7742e7.md
agentdocs://pages/page_25e4a3dd58648a4f.md
```

Selected task pack:

```txt
pagination
```

Approximate handoff size:

```txt
19,836 characters (~4,959 tokens)
```

Baseline finding: this is a routing weakness. The supporting pages are
workflow/MCP related, but the selected fixed task pack is `pagination`. This
should be preserved as Phase 1/2 evidence for improving shared context
selection without adding package-specific logic.

### Goal: debug stale context

Summary:

```txt
Use 5 complementary source section(s) for "debug stale context".
```

Read first:

```txt
agentdocs://task-packs/errors.md
agentdocs://pages/page_15545adc5fdb5978.md
agentdocs://pages/page_8651e104b684cd38.md
```

Selected task pack:

```txt
errors
```

Approximate handoff size:

```txt
20,446 characters (~5,112 tokens)
```

## Gate Status

Passed after the Phase 0 documentation edits:

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm regression:fixtures
corepack pnpm docs:build
```

The previous `undici` declaration-build failure did not reproduce. The full
workspace build and `regression:fixtures` both completed successfully.

## Remaining Phase 0 Notes

- `ARCHITECTURE.md` has been rewritten to remove stale old-phase claims and to
  document current package responsibilities, pipeline behavior, artifacts, CI
  posture, and known product gaps.
- Phase 0 gate commands passed after the documentation edits.
- The generated `.agentdocs-phase0-baseline` directory is a local proof output,
  not a source artifact intended for publication.
