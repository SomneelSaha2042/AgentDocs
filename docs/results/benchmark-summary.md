# Benchmark Summary

This page is the short version of the dogfood evidence. Detailed target
findings, history, metrics definitions, and methodology remain available for
audit, but adopters should not have to reconstruct the conclusion from every
page.

## What Has Been Proven

AgentDocs has deterministic evidence for these claims:

- It compiles varied Markdown and MDX documentation corpora into local
  artifacts.
- Repeated builds can produce stable generated-artifact hashes.
- It detects and reports mixed-version, mixed-framework, router, locale, and
  source-coverage risks.
- It generates task-shaped handoffs and read-only MCP context from built
  artifacts.
- It can measure exact task-pack routing separately from readiness score.

## What Has Not Been Proven Yet

These are product goals, not proven benchmark claims:

- Coding agents complete more third-party implementation tasks successfully.
- Agents produce fewer incorrect implementations than with web search,
  repository search, `llms.txt`, or generic RAG.
- Engineers spend less time reviewing agent output.
- AgentDocs reduces token use, web requests, or task completion time.

`agent_task_passed` remains `unknown` until a task is actually completed using
only generated AgentDocs context.

## Current Adoption Scorecard

| Signal | Current status |
| --- | --- |
| Pipeline determinism | Strong on documented prepared targets. |
| Source coverage honesty | Implemented for local/repo Markdown and MDX sources; prepared crawl artifacts may retain historical coverage gaps. |
| Context-risk detection | Strong for explicit facets and mixed-context warnings. |
| Exact task-pack routing | Improving; Phase 5 fixed Fastify schema validation, TanStack React invalidation, and Next.js App Router route handlers. |
| Agent implementation outcomes | Mostly not evaluated; self-dogfood is the only recorded passed implementation task. |
| Comparative baseline | Not measured yet. |

## Strongest Case Studies

### Fastify Version Safety

Fastify local docs now route `build Fastify v5 server with JSON schema
validation` to `schema-validation` and `migrate to Fastify v5` to `migration`.
Broad migration retrieval still reports context risks when deprecated or mixed
version evidence appears.

### TanStack React Boundary

TanStack Query local docs now route `implement React mutation invalidation` to
`query-invalidation`, while framework facets keep React-specific context
separate from other framework examples.

### Next.js App Router Routing

The prepared Next.js crawl now routes `build App Router POST route handler` to
`route-handlers`, closing one of the workflow-layer gaps identified before
Phase 5.

## Known Limitations

- Hono quickstart routing still selects related packs instead of `quickstart`
  on both local and prepared-crawl targets.
- OpenAPI ingestion is planned but not implemented.
- reST and AsciiDoc are counted as source coverage gaps, not parsed.
- Prepared crawl artifacts were rebuilt from stored pages unless explicitly
  marked as live recrawls.
- Readiness score is an audit signal, not an agent-success score.

## Evidence Links

- [Real-World Results](./index.md)
- [Full Dogfood Rerun Phase 5](./full-dogfood-rerun-phase-5.md)
- [Findings by Target](./findings.md)
- [Evaluation History](./history.md)
- [Metrics Reference](./metrics-reference.md)
- [Methodology](./methodology.md)
