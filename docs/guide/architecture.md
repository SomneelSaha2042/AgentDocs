# Architecture, Determinism, And Security

<img class="doc-illustration" src="/brand/feature-local-first-safe.png" alt="AgentDocs mascot protecting local documentation with a lock shield" />

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

`agentdocs build --check` uses the same build-state model but refuses to write
files. That choice is intentional for CI: a gate should report whether committed
or cached context is current, not repair it while the job is evaluating it.
Human output names stale sources, stale or missing artifacts, and next actions;
JSON output uses the same status-report shape as `agentdocs status --json`.

Website freshness is TTL-based rather than live network validation. That means
status checks remain local and fast, at the cost of not knowing whether a remote
site changed five minutes after a crawl. AgentDocs chooses explicit recrawls
over surprising background network work.

Generated-output lifecycle commands stay inside the configured output boundary.
`build --clean` can delete the AgentDocs output directory, but refuses project
roots, filesystem roots, and paths outside the working directory. Normal builds
prune artifacts from sources removed from the current config by reading previous
source manifests, not by scanning or mutating source docs.

Export is split by intent. `export --format static` copies the complete built
context for archival or tooling handoff. `export --format llms` copies only the
publishable agent-facing subset so teams can review and publish context without
shipping raw crawled HTML, normalized source snapshots, or the local search
database.

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
