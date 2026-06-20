# Generated Artifacts

| Artifact | Purpose |
| --- | --- |
| `llms.txt` | Concise navigation and project rules |
| `AGENTS.md` | Setup, concepts, tasks, mistakes, and source links |
| `agent-brief.md` | Persistent first-read brief for coding agents |
| `manifest.json` | Build metadata and artifact inventory |
| `agent-map.json` | Pages, chunks, entities, edges, and task packs |
| `chunks.jsonl` | Stable source-linked chunks |
| `index.sqlite` | SQLite/FTS5 or deterministic lexical search |
| `state/build-state.json` | Source fingerprints, artifact hashes, and freshness inputs |
| `task-packs/*.md` | Evidence-backed task instructions |
| `reports/agent-readiness.md` | Human-readable readiness findings |
| `reports/agent-readiness.json` | Machine-readable readiness findings |

Generated JSON and JSONL must pass repository schemas before a build succeeds.
Task packs are emitted only when the source provides sufficient task evidence.
New build artifacts use schema `0.2.0`. Readers accept `0.1.0` agent maps,
manifests, and readiness reports and upgrade missing context facets in memory.

`manifest.json` includes `sourceCoverage` when local or repo ingest manifests
are available. The coverage object counts supported `.md` and `.mdx` files,
unsupported docs-like `.rst`, likely reST `.txt`, `.adoc`, and `.asciidoc`
files, compiled files, degraded files, skipped files, failed files, and the
coverage ratio for the intended source scope. Older ingest manifests that did
not capture this metric are labeled `historical_metric_not_captured`.

`build-state.json` uses schema `1` and is local operational state. It is used by
`agentdocs status`, `agentdocs rebuild --changed`, `agentdocs watch`, handoff
freshness warnings, and MCP context verification.

## Operational State Versus Publishable Context

AgentDocs keeps two kinds of generated files in the same output directory:

- publishable context, such as `llms.txt`, generated `AGENTS.md`,
  `agent-brief.md`, `agent-map.json`, `chunks.jsonl`, task packs, and readiness
  reports;
- local operational state, such as source snapshots, crawl manifests, the search
  index, and `state/build-state.json`.

This distinction drives export behavior. `agentdocs export --format static`
copies the complete built output for archival or local tooling. `agentdocs
export --format llms` copies only the publishable agent-facing subset so teams
can review and ship context without publishing raw crawl snapshots or local
index state.

`build-state.json` is intentionally not a source of product truth. It records
what the last build observed so `agentdocs build --check` can compare current
inputs and generated artifacts without rewriting them. If it is missing or
invalid, check mode reports unknown freshness and asks for a normal build.
