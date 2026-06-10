# Search And MCP

## Offline Search

After a build, search does not require network access:

```bash
agentdocs search "webhook signature verification"
agentdocs search "API key" --limit 5 --json
```

Node.js runtimes with `node:sqlite` and FTS5 use the SQLite backend. Other
supported runtimes build a deterministic lexical fallback at the same
`index.sqlite` path.

## MCP Server

```bash
agentdocs serve-mcp
```

Configure an MCP client to launch `agentdocs serve-mcp` from the target project
directory. The server exposes read-only tools for search, pages, task packs,
start context, code examples, and related pages.

The server reads only validated built artifacts. It cannot crawl, execute code,
or provide arbitrary filesystem access.
