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

- OpenAPI ingestion is planned. Repository sources reuse local ingestion and
  do not clone remote repositories.
- `build --check` for CI drift detection is planned.
- Broken-link checks do not validate heading fragments.
- The crawler targets public, statically accessible documentation.
- Crawling is guide-scoped by default. Pass repeatable `--include` patterns
  when the inferred product/version scope is too narrow.
- Individual page failures are recorded in `sources/crawl-manifest.json`; a
  crawl succeeds when useful pages were still collected.
