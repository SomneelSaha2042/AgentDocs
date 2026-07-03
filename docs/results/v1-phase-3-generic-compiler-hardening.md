# V1 Phase 3 Generic Compiler Hardening

Date: 2026-07-03

This note records the Phase 3 proof run. The target is the checked-in
`fixtures/hardening` corpus built through `scripts/regression-fixtures.mjs`.
The implementation goal was generic task-pack generation, not OpenAPI support
or a broader evaluation harness.

## Implementation Summary

- Default task-pack families are generic: `quickstart`, `installation`,
  `authentication`, `configuration`, `webhooks`, `pagination`, `errors`,
  `migration`, `deployment`, `api-usage`, and `testing`.
- Domain-shaped task IDs such as `route-handlers`, `query-invalidation`, and
  `schema-validation` are no longer default families.
- The existing configured `tasks` path still allows explicit project-specific
  task IDs, including those domain-shaped IDs, when source evidence matches
  the configured queries.
- Task-pack Markdown now includes diagnostics for selected evidence signals,
  code/command evidence, weak-evidence reasons, and context conflicts without
  changing the `TaskPack` schema in `agent-map.json`.
- High confidence now requires implementation-shaped prose plus relevant code
  or command evidence.

## Proof Target

Temporary project source config used by the regression script:

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

Observed default build counts from the hardening fixture regression:

```txt
pages: 14
chunks: 15
entities: 7
taskPacks: 4
doctor score: 92/100
source coverage: 14 of 14 supported docs files compiled
```

Default task packs generated:

```txt
api-usage
installation
migration
quickstart
```

The regression script asserts that these IDs are absent from default output:

```txt
route-handlers
query-invalidation
schema-validation
```

It then runs a second build with explicit configured `tasks` for those three
IDs and asserts all three are generated from the same organic source corpus.

## Diagnostics Proof

Generated task-pack Markdown includes a `## Diagnostics` section. The generator
tests assert diagnostics for API implementation evidence, including selected
signals such as `HTTP route or endpoint evidence`, code/command evidence status,
weak-evidence reason, and context-conflict status.

`agentdocs inspect task-pack <id>` now derives and prints code/command evidence,
weak-evidence reason, and context conflicts from the existing task-pack schema.

## Verification

Run during implementation:

```bash
corepack pnpm --filter @agentdocs/generator test
corepack pnpm --filter @agentdocs/generator typecheck
corepack pnpm --filter @agentdocs/shared test
corepack pnpm --filter @somneelsaha/agentdocs test
corepack pnpm regression:fixtures
```

Final phase gate commands also passed:

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm regression:fixtures
corepack pnpm docs:build
```

## Remaining Limitations

- OpenAPI ingestion remains a Phase 4 gap.
- Generic `api-usage` intentionally absorbs route, schema, and mutation/update
  evidence by default; project-specific names require configured tasks.
- The compiler still uses deterministic lexical and structural evidence. It
  does not infer unsupported steps beyond source-backed pages, headings, code,
  commands, facets, and entities.