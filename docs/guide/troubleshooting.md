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

## Current Beta Limitations

- OpenAPI ingestion is planned. Repository sources reuse local ingestion and
  do not clone remote repositories.
- Export and `build --clean` are not implemented.
- Removed configured sources are not pruned from an existing output directory.
- Broken-link checks do not validate heading fragments.
- The crawler targets public, statically accessible documentation.
- Crawling is guide-scoped by default. Pass repeatable `--include` patterns
  when the inferred product/version scope is too narrow.
- Individual page failures are recorded in `sources/crawl-manifest.json`; a
  crawl succeeds when useful pages were still collected.
