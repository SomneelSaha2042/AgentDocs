# v1 Phase 4: Ingestion Contract Closure

Date: 2026-07-04

## Summary

Phase 4 closes the advertised ingestion contract without adding OpenAPI ingestion to the core product. OpenAPI is deferred to a future opt-in adapter tracked in GitHub issue #18. Current builds reject configured OpenAPI sources and direct OpenAPI file ingestion early so API schemas cannot leak into generic chunks, task packs, or MCP context.

## What Changed

- Supported configured sources are explicitly `local_markdown`, `repo`, and `website`.
- `type: openapi` config entries fail validation with an actionable unsupported-source message.
- Direct ingestion of likely OpenAPI JSON/YAML files fails with the same planned-but-unsupported behavior instead of a generic unsupported-file error. OpenAPI files discovered inside mixed docs directories remain ignored as unsupported non-doc files rather than compiled into context.
- `agentdocs init` no longer includes a commented OpenAPI source block.
- Public docs and architecture now describe OpenAPI as deferred and rejected early in this build.

## Product Proof

Expected behavior for configured OpenAPI sources:

```txt
OpenAPI ingestion is planned but not supported in this build. Use local_markdown, repo, or website sources.
```

Expected behavior for direct OpenAPI file ingestion:

```txt
OpenAPI ingestion is planned but not supported in this build. Use markdown, MDX, reST, AsciiDoc, repo, or website sources.
```

This protects the token-efficiency work from schema dumps, generic endpoint chunks, and false-positive context selection while keeping a future OpenAPI adapter possible.

## Verification

Passed during implementation:

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm regression:fixtures
corepack pnpm docs:build
```

## Remaining Limitations

- OpenAPI operation evidence is not available in v1.
- The future adapter should remain opt-in, local-first, operation-level, and budgeted before it is added to the core pipeline.
