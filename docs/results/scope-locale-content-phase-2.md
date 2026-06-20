# Scope Locale And Content-Type Phase 2 Implementation Note

Date: June 20, 2026.

## What changed

- Added deterministic facet extraction for:
  - `content_type=docs|blog|news|release|reference|tutorial|example`;
  - `locale=en|en-us|es|fr|...`;
  - `source_format=markdown|mdx|html`.
- Kept source `facets` and `context.rules` as the override mechanism for weak
  path/title/frontmatter signals.
- Added `locale` to the default exclusive context keys so mixed-language search
  results can warn like mixed version/framework/router/runtime results.
- Updated search ranking so implementation goals prefer docs, tutorials, and
  reference pages over blog, news, and release pages when implementation
  evidence exists.
- Added a doctor warning, `has_task_search_scope`, for task-query top results
  dominated by blog/news/release content despite docs/tutorial/reference
  evidence.

## Testing insight addressed

The candidate expansion found Airflow-site workflow queries skewing toward
news/release pages and FastAPI quickstart/auth queries surfacing localized or
editor-support material. Phase 2 makes those signals explicit and gives search,
handoff, and doctor deterministic evidence to prefer implementation context.

## Commands run

```bash
corepack pnpm --filter @agentdocs/normalizer test -- markdown.test.ts html.test.ts
corepack pnpm --filter @agentdocs/indexer test -- search.test.ts
corepack pnpm --filter @agentdocs/doctor test -- readiness.test.ts
corepack pnpm typecheck
corepack pnpm test
```

## Known limitations

- Content-type and locale inference is heuristic and deterministic. Projects
  with unusual paths should use `source.facets` or `context.rules`.
- Path-based locale inference is intentionally conservative to avoid treating
  programming-language folders such as `go`, `js`, `ts`, or `py` as human
  locales.
- Phase 2 improves lexical ranking but does not add an LLM classifier or a new
  retrieval engine.
- Language-specific task-pack families remain Phase 5 work.

## Follow-up work

- Add large-repo controls for explicit budgets and progress diagnostics.
- Add parser expansion for Sphinx/reST and AsciiDoc/Antora after coverage
  metrics are stable.
- Re-run Airflow-site and FastAPI candidate queries to update dogfood metrics.
