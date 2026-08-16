# Search And MCP

<div class="doc-illustration-pair">
  <img src="/brand/feature-search.png" alt="AgentDocs mascot inspecting and filtering documentation with a magnifying glass" />
  <img src="/brand/feature-mcp-tools.png" alt="AgentDocs mascot connecting verified documentation to local tools" />
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
Use the AgentDocs MCP server before web search. Start at agentdocs://map with browse_docs, follow the structural and semantic relations that fit the task, and use read_docs on exact selected refs before implementing.
```

For multi-session work:

```bash
agentdocs status
agentdocs handoff "implement webhook verification"
agentdocs verify-context --task "implement webhook verification"
agentdocs rebuild --changed
```

The server reads only validated built artifacts. It cannot crawl, execute code,
or provide arbitrary filesystem access. Tool allowlists configured with
`serve-mcp --tools browse_docs,read_docs` are enforced when tools are listed and
when clients call tools directly.

`browse_docs` hydrates the compiled `documentation-map.json` artifact and starts
at `agentdocs://map`. Agents can also read the complete map through the
`agentdocs://documentation-map.json` resource. Output directories created before
this artifact was introduced remain compatible: the server derives the same map
from `agent-map.json` in memory, while rejecting a present map that does not
validate or match its source graph.
