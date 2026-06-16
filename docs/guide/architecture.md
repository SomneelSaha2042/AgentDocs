# Architecture, Determinism, And Security

<img class="doc-illustration" src="/brand/feature-local-first-safe.png" alt="Local-first and safe documentation processing" />

AgentDocs is a compiler and auditor for agent-readable documentation:

```txt
source collection
  -> normalization and stable chunks
  -> entity and relationship graph
  -> evidence-backed task packs
  -> static artifacts and offline index
  -> build state, handoff, verification, and read-only MCP
```

## Determinism

- Stable IDs derive from source identity and content.
- Generated collections use deterministic ordering.
- JSON and JSONL artifacts validate against explicit schemas.
- Repeated fixture builds are checked by artifact hashes.
- Core behavior does not require an LLM.
- Workflow freshness uses source hashes, website TTLs, config hashes, and
  build-owned artifact hashes.

## Workflow Decisions

The workflow layer is intentionally separate from collection and generation.
`agentdocs handoff` and MCP `get_task_context` summarize built artifacts; they
do not recrawl or rewrite docs. `agentdocs status` compares current inputs to
`.agentdocs/state/build-state.json`, and `agentdocs rebuild --changed` then
uses the normal deterministic build path.

Website freshness is TTL-based rather than live network validation. That means
status checks remain local and fast, at the cost of not knowing whether a remote
site changed five minutes after a crawl. AgentDocs chooses explicit recrawls
over surprising background network work.

`setup-agent` prints MCP snippets instead of editing Codex, Claude, Cursor, or
other client configuration files. The tradeoff favors transparency and
portability over automation that could mutate a developer's tools unexpectedly.

## Security Model

- Documentation, HTML, code blocks, and commands are untrusted input.
- AgentDocs never executes commands found in docs.
- Website collection stays same-origin by default.
- MCP resources are allowlisted and protected against path traversal.
- Generated files are written beside source docs, never over them.
- MCP workflow tools read built artifacts only; they do not crawl, execute
  commands, or provide arbitrary filesystem reads.
