# v1 Product Proof Runs

Date: 2026-07-07

## Summary

This proof reuses the existing local dogfood strategy and adds same-goal CLI/MCP context captures. It covers local markdown, MDX, prepared website crawls, reST/Sphinx, AsciiDoc/Antora, and mixed large docs. OpenAPI remains deferred and is not counted as supported ingestion.

## Target Results

| Target | Size | Source shape | Pages | Chunks | Task packs | Doctor | Coverage | Repeat build | Routing | Median MCP tokens |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | ---: |
| Basic fixture docs | tiny | local markdown + MDX fixture | 3 | 7 | 4 | 99 | 100% none | stable | 3/3 | 797 |
| Hardening fixture | small | mixed markdown + MDX hardening corpus | 14 | 15 | 4 | 69 | 100% none | stable | 2/3 | 516 |
| AgentDocs docs | medium | repo docs markdown | 35 | 254 | 11 | 94 | 100% none | stable | 3/3 | 717 |
| Fastify local docs | medium | prepared local repo markdown | 43 | 801 | 6 | 96 | 100% none | stable | 3/3 | 817 |
| Hono prepared website crawl | medium | prepared website crawl | 85 | 778 | 11 | 98 | 100% none | stable | 3/3 | 748 |
| Supabase local MDX docs | large | large MDX local repo | 737 | 6277 | 11 | 79 | 94% warn | stable | 3/3 | 873 |
| TanStack Query docs | large | large multi-framework local docs | 411 | 2598 | 10 | 79 | 83% warn | stable | 3/3 | 861 |
| Next.js prepared website crawl | large | prepared website crawl | 100 | 822 | 11 | 93 | Unknown | stable | 3/3 | 817 |
| Django Sphinx docs | very large | Sphinx/reST local docs | 671 | 7422 | 10 | 69 | 100% none | stable | 3/3 | 764 |
| Spring Framework AsciiDoc docs | very large | AsciiDoc/Antora local docs | 460 | 3566 | 9 | 79 | 98% warn | stable | 3/3 | 894 |
| Airflow mixed reST docs | very large | mixed reST/text local docs | 1533 | 16962 | 11 | 79 | 95% warn | stable | 3/3 | 784 |

## Workflow Context Samples

### Basic fixture docs

Output: `.dogfood/v1-product-proof/basic-docs/project/.agentdocs-proof`
Task packs: `api-usage` (medium), `configuration` (medium), `installation` (medium), `quickstart` (high)

| Goal | Selected pack | Verify | Warnings | MCP citations | Context tokens | Handoff tokens | MCP tokens |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| create a client | `quickstart` | warn | none | 4 | 1905 | 3725 | 797 |
| configure environment variables | `configuration` | warn | none | 4 | 1379 | 2838 | 802 |
| use the API options | `api-usage` | warn | none | 4 | 1239 | 2576 | 796 |

Doctor warnings: `has_auth_candidate`, `has_deprecated_markers`

### Hardening fixture

Output: `.dogfood/v1-product-proof/hardening-fixture/project/.agentdocs-proof`
Task packs: `api-usage` (medium), `installation` (medium), `migration` (low), `quickstart` (medium)

| Goal | Selected pack | Verify | Warnings | MCP citations | Context tokens | Handoff tokens | MCP tokens |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| quickstart | `quickstart` | pass | none | 4 | 607 | 1521 | 516 |
| build an HTTP route with request validation | `api-usage` | fail | context_conflict: framework=angular,react,svelte,vue | 4 | 1177 | 2523 | 516 |
| configure Supabase auth and RLS | fallback (unexpected) | fail | none | 4 | 1595 | 3025 | 572 |

Doctor warnings: `has_sitemap_or_nav`, `has_normalization_quality`, `has_installation_evidence`, `has_auth_candidate`, `has_security_warnings`, `has_env_var_examples`

### AgentDocs docs

Output: `.dogfood/v1-product-proof/agentdocs-self/project/.agentdocs-proof`
Task packs: `api-usage` (high), `authentication` (medium), `configuration` (high), `deployment` (medium), `errors` (medium), `installation` (high), `migration` (medium), `pagination` (medium), `quickstart` (high), `testing` (medium), `webhooks` (high)

| Goal | Selected pack | Verify | Warnings | MCP citations | Context tokens | Handoff tokens | MCP tokens |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| install AgentDocs and run the golden workflow | `installation` | pass | none | 4 | 3869 | 6282 | 683 |
| serve MCP context to Codex | `configuration` | pass | none | 4 | 4013 | 6409 | 717 |
| run doctor and interpret readiness warnings | `errors` | pass | none | 4 | 3963 | 6323 | 791 |

Doctor warnings: `has_headings`, `has_giant_pages`, `has_deprecated_markers`, `has_security_warnings`, `has_env_var_examples`

### Fastify local docs

Output: `.dogfood/fastify/.agentdocs-dogfood`
Task packs: `api-usage` (high), `deployment` (high), `installation` (high), `migration` (medium), `quickstart` (high), `webhooks` (high)

| Goal | Selected pack | Verify | Warnings | MCP citations | Context tokens | Handoff tokens | MCP tokens |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| migrate to Fastify v5 | `migration` | warn | none | 4 | 5063 | 8021 | 883 |
| validate a request body and response schema | `api-usage` | pass | none | 4 | 4889 | 7764 | 776 |
| register a Fastify plugin | `api-usage` | pass | none | 4 | 4647 | 7504 | 817 |

Doctor warnings: `has_link_coverage`, `has_giant_pages`, `has_auth_candidate`, `has_deprecated_markers`

### Hono prepared website crawl

Output: `.dogfood/hono-website/.agentdocs-dogfood`
Task packs: `api-usage` (high), `authentication` (medium), `configuration` (high), `deployment` (medium), `errors` (high), `installation` (high), `migration` (high), `pagination` (medium), `quickstart` (high), `testing` (high), `webhooks` (medium)

| Goal | Selected pack | Verify | Warnings | MCP citations | Context tokens | Handoff tokens | MCP tokens |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| create a Hono app | `quickstart` | pass | none | 4 | 3956 | 6867 | 755 |
| deploy Hono to Cloudflare Workers | `deployment` | pass | none | 4 | 3840 | 6651 | 682 |
| add middleware to a route | `api-usage` | pass | none | 4 | 4170 | 7301 | 748 |

Doctor warnings: `has_link_coverage`, `has_giant_pages`, `has_deprecated_markers`, `has_security_warnings`

### Supabase local MDX docs

Output: `.dogfood/supabase/.agentdocs-dogfood`
Task packs: `api-usage` (high), `authentication` (high), `configuration` (high), `deployment` (medium), `errors` (high), `installation` (high), `migration` (medium), `pagination` (high), `quickstart` (high), `testing` (high), `webhooks` (high)

| Goal | Selected pack | Verify | Warnings | MCP citations | Context tokens | Handoff tokens | MCP tokens |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| implement Supabase auth with row level security | `authentication` | pass | none | 4 | 5739 | 9959 | 873 |
| configure Supabase environment variables | `configuration` | pass | none | 4 | 4532 | 7771 | 801 |
| debug RLS policy errors | `errors` | pass | none | 4 | 4682 | 7997 | 918 |

Doctor warnings: `has_source_coverage`, `has_normalization_quality`, `has_headings`, `has_link_coverage`, `has_giant_pages`, `has_deprecated_markers`

### TanStack Query docs

Output: `.dogfood/tanstack-query/.agentdocs-dogfood`
Task packs: `api-usage` (high), `authentication` (medium), `configuration` (high), `deployment` (high), `errors` (high), `installation` (high), `migration` (high), `pagination` (high), `quickstart` (high), `testing` (high)

| Goal | Selected pack | Verify | Warnings | MCP citations | Context tokens | Handoff tokens | MCP tokens |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| implement a React mutation and invalidate queries | `api-usage` | pass | none | 4 | 4978 | 8662 | 860 |
| implement paginated queries | `pagination` | pass | none | 4 | 5362 | 9486 | 912 |
| test TanStack Query hooks | `testing` | pass | none | 4 | 4445 | 7964 | 861 |

Doctor warnings: `has_source_coverage`, `has_normalization_quality`, `has_link_coverage`, `has_giant_pages`, `has_deprecated_markers`, `has_security_warnings`

### Next.js prepared website crawl

Output: `.dogfood/nextjs-crawl`
Task packs: `api-usage` (high), `authentication` (high), `configuration` (high), `deployment` (high), `errors` (high), `installation` (high), `migration` (high), `pagination` (high), `quickstart` (high), `testing` (high), `webhooks` (high)

| Goal | Selected pack | Verify | Warnings | MCP citations | Context tokens | Handoff tokens | MCP tokens |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| build an App Router POST route handler | `api-usage` | pass | none | 4 | 5436 | 8698 | 817 |
| deploy a Next.js app | `deployment` | pass | none | 4 | 3216 | 5468 | 767 |
| handle errors in App Router | `errors` | pass | none | 4 | 5248 | 8473 | 934 |

Doctor warnings: `has_config`, `has_link_coverage`, `has_giant_pages`, `has_deprecated_markers`, `has_security_warnings`

### Django Sphinx docs

Output: `.dogfood/candidates/django/.agentdocs`
Task packs: `api-usage` (high), `authentication` (high), `configuration` (high), `deployment` (high), `errors` (high), `installation` (high), `migration` (high), `pagination` (medium), `quickstart` (high), `testing` (high)

| Goal | Selected pack | Verify | Warnings | MCP citations | Context tokens | Handoff tokens | MCP tokens |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| start a Django project | `quickstart` | pass | none | 4 | 3948 | 6501 | 756 |
| configure Django authentication | `authentication` | pass | none | 4 | 4225 | 6988 | 764 |
| deploy Django | `deployment` | pass | none | 4 | 3985 | 6478 | 806 |

Doctor warnings: `has_task_search_scope`, `has_headings`, `has_link_coverage`, `has_giant_pages`, `has_deprecated_markers`

### Spring Framework AsciiDoc docs

Output: `.dogfood/candidates/spring-framework/.agentdocs`
Task packs: `api-usage` (high), `authentication` (high), `configuration` (high), `deployment` (medium), `errors` (high), `migration` (medium), `pagination` (high), `quickstart` (high), `testing` (high)

| Goal | Selected pack | Verify | Warnings | MCP citations | Context tokens | Handoff tokens | MCP tokens |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| create a Spring application | `quickstart` | pass | none | 4 | 4496 | 7243 | 853 |
| configure Spring application properties | `configuration` | pass | none | 4 | 5257 | 8141 | 1026 |
| test a Spring application | `testing` | pass | none | 4 | 5016 | 7860 | 894 |

Doctor warnings: `has_no_include_gaps`, `has_source_coverage`, `has_normalization_quality`, `has_headings`, `has_link_coverage`, `has_giant_pages`, `has_installation_evidence`, `has_deprecated_markers`

### Airflow mixed reST docs

Output: `.dogfood/candidates/airflow/.agentdocs`
Task packs: `api-usage` (high), `authentication` (high), `configuration` (high), `deployment` (medium), `errors` (high), `installation` (high), `migration` (medium), `pagination` (high), `quickstart` (high), `testing` (high), `webhooks` (high)

| Goal | Selected pack | Verify | Warnings | MCP citations | Context tokens | Handoff tokens | MCP tokens |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| create an Airflow DAG | `quickstart` | pass | none | 4 | 4140 | 9322 | 906 |
| deploy Airflow | `deployment` | pass | none | 4 | 4310 | 9371 | 706 |
| debug Airflow task failures | `errors` | pass | none | 4 | 4536 | 9864 | 784 |

Doctor warnings: `has_no_include_gaps`, `has_source_coverage`, `has_normalization_quality`, `has_task_search_scope`, `has_headings`, `has_link_coverage`, `has_giant_pages`, `has_deprecated_markers`

## Findings

- Intent-aware task selection routes 32 of 33 sampled workflows to the expected generic task family; the remaining hardening-fixture auth/RLS goal has no generated authentication pack and falls back explicitly.
- Small fixture targets provide compact context and stable repeat builds, which protects the default CI-safe proof path.
- Prepared website crawls are evaluated from cached local artifacts to avoid live-network drift while still exercising website-shaped source output.
- Large MDX, reST, and AsciiDoc targets expose parser degradation and source-coverage gaps as product signals rather than hidden failures.
- Routing rows are evidence signals, not agent-task success claims. Agent implementation remains `unknown` unless separately run through the active evaluation harness.

## Verification

Proof captures were produced with the following commands. The all-target command may exceed short shell timeouts on very large targets; rerun any missed target with `--only=<target>` and regenerate the final note with `--from-existing`.

```bash
corepack pnpm build
node scripts/v1-product-proof.mjs
node scripts/v1-product-proof.mjs --only=airflow
node scripts/v1-product-proof.mjs --from-existing
```

Phase 5 verification passed with:

```bash
node --check scripts/v1-product-proof.mjs
corepack pnpm docs:build
corepack pnpm regression:fixtures
corepack pnpm check
```
