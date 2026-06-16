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

`build-state.json` uses schema `1` and is local operational state. It is used by
`agentdocs status`, `agentdocs rebuild --changed`, `agentdocs watch`, handoff
freshness warnings, and MCP context verification.
