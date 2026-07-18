# V1 Phase 2 One Context Brain

Date: 2026-07-01

This note records the Phase 2 proof run. The target is the checked-in
`fixtures/hardening` corpus built through a temporary local AgentDocs project.
The implementation goal was CLI/MCP parity for context decisions, not new
compiler heuristics.

## Implementation Summary

- `packages/shared/src/task-context.ts` now exposes one shared context decision
  path through `TaskContextAssembler`.
- The shared decision owns selected task pack, read-first resources, warnings,
  verification issues, citations, confidence, context bundles, handoff bundles,
  and `query_docs` style responses.
- `packages/mcp-server/src/artifacts.ts` remains the built-artifact/search
  adapter and delegates context decisions into `TaskContextAssembler`.
- CLI `context`, `handoff`, and `verify-context` now delegate through
  `ArtifactService` instead of rebuilding task selection, warnings, or
  verification issues locally.
- The title/ID selector was tightened generically so `install package` still
  selects `installation` while specific API terms continue to win over generic
  noisy packs.

## Proof Target

Temporary project source config:

```yaml
sources:
  - type: local_markdown
    path: fixtures/hardening
context:
  preferred:
    version: v5
    framework: react
    router: app
  exclusiveKeys: [version, framework, router, runtime]
normalization:
  mdx: tolerant
doctor:
  minScore: 0
```

Build counts from `manifest.json`:

```txt
pages: 14
chunks: 15
entities: 7
edges: 9
taskPacks: 6
```

## CLI/MCP Parity

| Goal | CLI context | CLI handoff | CLI verify | MCP query_docs | MCP get_task_context | Shared warnings | Approx context size |
| --- | --- | --- | --- | --- | --- | --- | ---: |
| `quickstart` | `quickstart` | `quickstart` | `pass` | `quickstart`, medium | `quickstart` | none | 2,183 chars |
| `build App Router POST route handler` | `route-handlers` | `route-handlers` | `pass` | `route-handlers`, medium | `route-handlers` | none | 2,417 chars |
| `implement React mutation invalidation` | `query-invalidation` | `query-invalidation` | `warn` (`no_canonical_code_examples`) | `query-invalidation`, medium | `query-invalidation` | `No canonical code examples found.` | 2,354 chars |

The selected task pack, warning set, and verification status agree across CLI and MCP surfaces for all
three proof goals. The MCP `query_docs` payload is smaller than the full context
bundle while preserving the same selected task identity and warning reasons.

## Verification

Run during implementation:

```bash
corepack pnpm build
corepack pnpm typecheck
corepack pnpm test
corepack pnpm regression:fixtures
corepack pnpm docs:build
corepack pnpm pack:verify
corepack pnpm smoke:bundle
```

`corepack pnpm build` also ran as part of `regression:fixtures`. One standalone
workspace build attempt timed out without a compiler error; rebuilding the
changed MCP server and CLI packages directly succeeded before the final proof
capture, and the later `regression:fixtures` build passed.

## Remaining Limitations

- Phase 2 consolidates serving-time context decisions; it does not change the
  generator's default task-family design. Phase 3 still needs generic compiler
  hardening.
- OpenAPI ingestion remains a Phase 4 gap.
- Website freshness remains TTL/build-state based by design.
