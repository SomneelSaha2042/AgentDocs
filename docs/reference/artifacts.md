# Generated Artifacts

| Artifact | Purpose |
| --- | --- |
| `llms.txt` | Concise navigation and project rules |
| `AGENTS.md` | Setup, concepts, tasks, mistakes, and source links |
| `manifest.json` | Build metadata and artifact inventory |
| `agent-map.json` | Pages, chunks, entities, edges, and task packs |
| `chunks.jsonl` | Stable source-linked chunks |
| `index.sqlite` | SQLite/FTS5 or deterministic lexical search |
| `task-packs/*.md` | Evidence-backed task instructions |
| `reports/agent-readiness.md` | Human-readable readiness findings |
| `reports/agent-readiness.json` | Machine-readable readiness findings |

Generated JSON and JSONL must pass repository schemas before a build succeeds.
Task packs are emitted only when the source provides sufficient task evidence.
