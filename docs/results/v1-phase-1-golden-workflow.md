# V1 Phase 1 Golden Workflow

Date: 2026-06-30

This note records the Phase 1 golden workflow proof run. The target is the
checked-in `fixtures/basic-docs` corpus and the built CLI bundle.

## Commands

```bash
node packages/cli/dist/agentdocs.js --out .agentdocs-phase1-proof2 try fixtures/basic-docs --goal "create a client"
node packages/cli/dist/agentdocs.js --out .agentdocs-phase1-proof2 handoff "create a client"
node packages/cli/dist/agentdocs.js --out .agentdocs-phase1-proof2 setup-agent --client codex
node packages/cli/dist/agentdocs.js --out .agentdocs-phase1-proof2 verify-context --task "create a client"
node packages/cli/dist/agentdocs.js --out .agentdocs-phase1-proof2 status
```

## Observed Output

`try` built the fixture and reported:

```txt
Pages: 3
Chunks: 7
Task packs: 3
Readiness: 97/100
Selected task pack: configuration (medium confidence)
Warnings: No context warnings.
Next command: agentdocs --out .agentdocs-phase1-proof2 serve-mcp
```

`handoff "create a client"` reported:

```txt
Freshness: FRESH
Selected task pack: configuration (medium confidence)
Read first: configuration task pack plus cited source pages
Gotchas: deprecated v1 client and client-side API key warning
MCP command: agentdocs --out .agentdocs-phase1-proof2 serve-mcp
Warnings: No context warnings.
```

`setup-agent --client codex` printed a Codex TOML snippet with:

```txt
args = ["--out", ".agentdocs-phase1-proof2", "serve-mcp"]
```

`verify-context --task "create a client"` reported:

```txt
Context verification: WARN
Freshness: FRESH
Issue: WARNING deprecated_evidence: The v1 client is deprecated.
```

`status` reported:

```txt
AgentDocs status: FRESH
No rebuild required.
```

## Implementation Summary

- MCP `serve-mcp --tools` allowlists are enforced at `tools/call` time, not
  only when listing tools.
- Disallowed MCP calls return a structured `TOOL_NOT_ALLOWED` tool error and do
  not reach the underlying artifact service.
- Human CLI output for the golden workflow now surfaces selected task packs,
  read-first context, warnings, freshness, and the configured MCP launch
  command.
- JSON output shapes were not changed.

## Verification

Focused checks run during implementation:

```bash
corepack pnpm --filter @agentdocs/mcp-server test
corepack pnpm --filter @somneelsaha/agentdocs test -- src/workflow.test.ts src/try.test.ts src/context.test.ts
corepack pnpm build
```

Full Phase 1 gates passed after the implementation:

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm regression:fixtures
corepack pnpm docs:build
corepack pnpm pack:verify
corepack pnpm smoke:bundle
```

## Remaining Limitations

- The routing decision for `create a client` selects the generic
  `configuration` task pack. That is acceptable for Phase 1 because this phase
  improves workflow clarity rather than context-selection internals.
- CLI/MCP context selection parity remains Phase 2 work.
