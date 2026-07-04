# Troubleshooting And Limitations

## No normalized pages found

Run `agentdocs build` with a valid configured local or website source, or
collect a source explicitly:

```bash
agentdocs ingest ./docs
agentdocs build --skip-crawl
```

## Search index not found

```bash
agentdocs build
agentdocs search "your query"
```

## Build check fails in CI

`agentdocs build --check` does not rewrite generated context. It fails when the
current config, configured source fingerprints, or generated artifact hashes no
longer match `state/build-state.json`.

For local or repository sources, refresh and review the generated diff:

```bash
agentdocs rebuild --changed
agentdocs build --check
```

For website sources, the check can also fail when the configured freshness TTL
has expired. Run a normal build or scheduled recrawl in the environment where
network collection is allowed.

## MCP startup fails

MCP validates `agent-map.json` at startup. Run a successful build in the same
working directory before starting the server.

## Stale output after changing sources

`agentdocs build` prunes pages from sources that were removed from the current
config. If you want to discard the entire generated context layer first, run:

```bash
agentdocs build --clean
```

`--clean` only removes the configured AgentDocs output directory and refuses
unsafe targets such as the project root.

## Export destination is not empty

Use a new destination or opt into replacement:

```bash
agentdocs export --format llms --to ./public --force
```

`static` exports the full built output. `llms` exports only the publishable
agent-facing subset.

## Current Beta Limitations

- OpenAPI ingestion is planned as a future opt-in adapter and is rejected early in this build. Repository sources reuse local ingestion and
  do not clone remote repositories.
- Broken-link checks validate generated heading fragments for collected pages.
  Custom HTML or framework-specific manual anchors may still require review.
- The crawler targets public, statically accessible documentation.
- Crawling is guide-scoped by default. Pass repeatable `--include` patterns
  when the inferred product/version scope is too narrow.
- Individual page failures are recorded in `sources/crawl-manifest.json`; a
  crawl succeeds when useful pages were still collected.
