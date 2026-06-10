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

- OpenAPI and repository source ingestion are planned.
- Export and `build --clean` are not implemented.
- Removed configured sources are not pruned from an existing output directory.
- Broken-link checks do not validate heading fragments.
- The crawler targets public, statically accessible documentation.
