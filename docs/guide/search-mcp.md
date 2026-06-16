# Search And MCP

<div class="doc-illustration-pair">
  <img src="/brand/feature-search.png" alt="Search indexed documentation" />
  <img src="/brand/feature-mcp-tools.png" alt="Expose read-only MCP tools to coding agents" />
</div>

## Offline Search

After a build, search does not require network access:

```bash
agentdocs search "webhook signature verification"
agentdocs search "API key" --limit 5 --json
agentdocs search "query invalidation" --facet framework=react
agentdocs search "migration" --facet version=v5
```

Node.js runtimes with `node:sqlite` and FTS5 use the SQLite backend. Other
supported runtimes build a deterministic lexical fallback at the same
`index.sqlite` path.

Facet filters are hard boundaries. Without them, search boosts query-named and
configured preferred facets, penalizes conflicting exclusive facets, and emits
`context_conflict` warnings when returned results still mix contexts.

## MCP Server

```bash
agentdocs setup-agent --client codex
agentdocs serve-mcp
```

Configure an MCP client to launch `agentdocs serve-mcp` from the target project
directory. `setup-agent` prints copy-paste snippets for Codex, Claude, Cursor,
or a generic MCP command.

The server exposes read-only tools for search, pages, task packs, task context,
context verification, setup commands, version policy, code examples, and related
pages. Prefer this flow inside an agent:

```txt
Use the AgentDocs MCP server before web search. Prefer get_task_context or verify_task_context for implementation tasks, and stop if AgentDocs reports stale, mixed-version, deprecated, or weak evidence.
```

For multi-session work:

```bash
agentdocs status
agentdocs handoff "implement webhook verification"
agentdocs verify-context --task "implement webhook verification"
agentdocs rebuild --changed
```

The server reads only validated built artifacts. It cannot crawl, execute code,
or provide arbitrary filesystem access.
