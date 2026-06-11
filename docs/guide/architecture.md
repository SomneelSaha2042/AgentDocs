# Architecture, Determinism, And Security

<img class="doc-illustration" src="/brand/feature-local-first-safe.png" alt="Local-first and safe documentation processing" />

AgentDocs is a compiler and auditor for agent-readable documentation:

```txt
source collection
  -> normalization and stable chunks
  -> entity and relationship graph
  -> evidence-backed task packs
  -> static artifacts and offline index
  -> readiness report and read-only MCP
```

## Determinism

- Stable IDs derive from source identity and content.
- Generated collections use deterministic ordering.
- JSON and JSONL artifacts validate against explicit schemas.
- Repeated fixture builds are checked by artifact hashes.
- Core behavior does not require an LLM.

## Security Model

- Documentation, HTML, code blocks, and commands are untrusted input.
- AgentDocs never executes commands found in docs.
- Website collection stays same-origin by default.
- MCP resources are allowlisted and protected against path traversal.
- Generated files are written beside source docs, never over them.
