# Routing Improvements Phase 4-5

Date: June 20, 2026

This follow-up tightened exact task-pack routing after Phase 3 made routing
measurable. The work stayed deterministic: no LLM calls, no live network
dependency, and no generated task pack unless source text contains matching
evidence.

## What Changed

AgentDocs now has built-in task families for:

- `route-handlers`
- `query-invalidation`
- `schema-validation`

These families cover the concrete gaps found in the workflow-layer rerun:
Next.js App Router route handlers, TanStack React mutation invalidation, and
Fastify v5 schema validation.

## Deterministic Checks

The offline hardening fixture now asserts four expected handoff routes:

| Goal label | Goal text | Expected task pack |
| --- | --- | --- |
| `quickstart` | `quickstart` | `quickstart` |
| `route-handler` | `build App Router POST route handler` | `route-handlers` |
| `query-invalidation` | `implement React mutation invalidation` | `query-invalidation` |
| `schema-validation` | `build Fastify v5 schema route` | `schema-validation` |

The fixture also keeps the existing context-safety checks for version,
framework, and router facets.

## Verification

Run locally:

```bash
pnpm build
pnpm regression:fixtures
pnpm docs:build
```

The regression summary records `routing_expected`, `routing_passed`,
`routing_failed`, and `routing_accuracy` so future real-world rows can show
task-pack routing quality separately from readiness score.

## Known Limits

The follow-up full dogfood rerun confirmed the targeted route families on
Fastify local docs, TanStack Query local docs, and the prepared Next.js crawl.
It also exposed a remaining Hono quickstart precision issue. See
[Full Dogfood Rerun Phase 5](./full-dogfood-rerun-phase-5.md) for the target
metrics.
