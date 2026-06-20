# Add first-class vector export and sample adapters for common RAG stacks

## Problem

`chunks.jsonl` and `agent-map.json` already contain the structured evidence downstream embedding pipelines need, but AgentDocs stops one step short of making that integration explicit. A focused export layer would make RAG integrations obvious while preserving the PRD boundary that AgentDocs is not a full RAG platform.

## Proposed change

Add a stable export format for embedding-oriented chunk data, plus examples for common ingestion targets.

## Scope

- Add `agentdocs export --format embeddings` or `agentdocs export --format chunks-jsonl`.
- Define a stable schema containing:
  - chunk ID;
  - page ID;
  - source URL or repo path;
  - heading path;
  - facets;
  - related task-pack IDs;
  - content hash;
  - text.
- Include sample adapters for LangChain, LlamaIndex, pgvector, and LanceDB.
- Add tests proving the export is deterministic across repeated builds.
- Document that AgentDocs exports evidence-linked context but does not host, embed, or retrieve vectors itself.

## Acceptance criteria

- `agentdocs export --format <embedding-format>` writes a schema-valid export.
- Repeated exports from the same build are byte-stable.
- Docs include copyable ingestion examples for at least two common stacks, with the rest sketched or linked.
- No mandatory embedding provider, model, API key, or hosted dependency is introduced.

## Notes

Keep the implementation local-first and deterministic. This should be an integration boundary, not a new retrieval platform.
