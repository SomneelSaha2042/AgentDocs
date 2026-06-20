# Source Coverage Phase 1 Implementation Note

Date: June 20, 2026.

## What changed

- Added deterministic source coverage metrics for local and repo ingestion.
- Counted supported `.md` and `.mdx` files plus unsupported docs-like `.rst`,
  likely Sphinx/reST `.txt`, `.adoc`, and `.asciidoc` files.
- Added compiled, degraded, skipped, failed, supported, unsupported, format
  breakdown, coverage ratio, severity, and missing-metric reason fields.
- Surfaced aggregate coverage in `ingest --json`, `build --json`,
  `manifest.json`, doctor/readiness checks, and dogfood summaries.
- Added fixtures for mostly reST, Django-style `.txt` reST, AsciiDoc with one
  README, and fully supported Markdown/MDX.

## Testing insight addressed

The June 19 candidate expansion showed false confidence when AgentDocs compiled
a tiny Markdown slice of a larger Sphinx/reST or AsciiDoc corpus. Phase 1 now
classifies that as an `unsupported_format` coverage gap instead of allowing the
compiled page count and readiness score to stand alone.

## Commands run

```bash
corepack pnpm typecheck
corepack pnpm --filter @agentdocs/doctor test -- readiness.test.ts
corepack pnpm --filter @somneelsaha/agentdocs test -- ingest.test.ts build.test.ts
```

The focused Vitest commands required an unsandboxed rerun on Windows because
the sandbox returned `EPERM` while opening the local Vitest executable.

## Known limitations

- reST and AsciiDoc are counted but not parsed.
- `.txt` reST detection is deterministic and conservative, based on docs-like
  paths and common Sphinx/reST syntax.
- Large-repo budgets, progress output, resumability, and parser expansion are
  still future phases.

## Follow-up work

- Add scope, locale, and content-type facets for retrieval quality.
- Add large-repo controls for `maxFiles`, `maxBytes`, `maxPages`, and
  `maxElapsedMs`.
- Add Sphinx/reST and AsciiDoc/Antora ingestion after coverage metrics are
  established.
