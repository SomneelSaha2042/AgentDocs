# Agent Workflow Layer

AgentDocs now treats the build output as something an agent can return to over
many sessions, not just a one-time bundle to paste into chat. The compiler
still does the same deterministic work, but the workflow layer answers the
questions that come up on an ordinary development day:

- is `.agentdocs/` still fresh;
- which task context should the agent read first;
- which MCP tools should the agent call next;
- is this context mixing versions, frameworks, or deprecated evidence;
- how do I attach the MCP server to Codex, Claude, Cursor, or another client.

The core decision was to keep this layer operational and local. AgentDocs does
not ask an LLM whether context is stale or trustworthy. It records build inputs,
source fingerprints, artifact hashes, and task-pack warnings, then exposes that
state through CLI commands and read-only MCP tools.

## Daily Loop

Build once:

```bash
agentdocs build
agentdocs setup-agent --client codex
agentdocs serve-mcp
```

Start a later session by checking freshness:

```bash
agentdocs status
agentdocs handoff "implement webhook verification"
agentdocs verify-context --task "implement webhook verification"
```

When local docs change:

```bash
agentdocs rebuild --changed
```

During docs editing:

```bash
agentdocs watch
```

`watch` intentionally uses polling over the same status engine instead of adding
a filesystem watcher dependency. That is less magical, easier to test on
Windows and Linux, and good enough for a local docs compiler.

## Freshness Model

AgentDocs writes `.agentdocs/state/build-state.json` after build. The state
contains:

- the config hash;
- configured source fingerprints;
- artifact hashes for build-owned files;
- collection time and expiry for website sources.

Local Markdown and repository sources are compared by content hash of the
configured Markdown/MDX files. Website sources use a TTL, defaulting to 24
hours, because live revalidation would turn a local status check into a network
operation. That tradeoff keeps `agentdocs status` fast and offline while still
making stale crawls visible.

`agentdocs rebuild --changed` recollects stale configured sources and then runs
the normal build pipeline. It does not mutate source documentation and does not
introduce an LLM dependency.

## CI Drift Gate

For maintained projects, the workflow layer should also run before an agent
session starts in CI:

```bash
agentdocs build --check
agentdocs doctor --min-score 75
agentdocs verify-context --task "<goal>"
```

`build --check` is deliberately non-mutating. It reads the last build state,
compares current configured sources and artifact hashes, and fails when the
context is stale, missing, or unknown. The command does not crawl, collect,
prune, rebuild, or write files. That makes it suitable for pull requests: CI
can say "the context layer drifted" without hiding the drift by regenerating it
mid-check.

`doctor` answers a different question: whether the available docs are
agent-ready enough for the configured threshold. `verify-context` narrows the
gate to the actual implementation goal and catches stale, mixed-version,
deprecated, weak-evidence, or missing-task context before an agent writes code.
Keeping these checks separate makes CI output easier to act on: freshness,
readiness, and task safety fail for different reasons and have different fixes.

## Handoff Over Search

`agentdocs search` remains useful, but raw search is not the ideal first move
for an agent. Agents need a compact, task-shaped starting point with warnings
and next actions.

`agentdocs handoff "<goal>"` wraps the existing context bundle with:

- selected task pack;
- top source pages;
- gotchas;
- setup commands;
- freshness status;
- MCP resources to read first;
- recommended MCP tools to call next.

The human output is intentionally redundant across the golden workflow: `try`,
`context`, `handoff`, `verify-context`, and `status` all surface the decision a
coding agent needs next instead of requiring the user to inspect raw artifacts.

`agentdocs context "<goal>"` remains supported for compatibility. `handoff` is
the preferred name for agent workflows because it describes the job better:
carry enough state from the docs compiler into the coding session.

## Verification Before Implementation

`agentdocs verify-context --task "<goal>"` is a guardrail. It reports `pass`,
`warn`, or `fail` when AgentDocs sees:

- stale or unknown freshness;
- mixed exclusive facets such as `version=v3` and `version=v5`;
- deprecated evidence;
- weak or missing task-pack evidence;
- requested facet mismatches;
- missing canonical source pages.

The same check is available to MCP clients as `verify_task_context`. The
intended agent behavior is simple: if verification fails, stop and ask for a
rebuild, a narrower facet, or manual review before writing code.

## MCP Ergonomics

`agentdocs setup-agent` prints small copy-paste snippets instead of trying to
write every client config file for the user. The tradeoff is deliberate:
configuration formats change, and silently editing editor or assistant settings
would be surprising. AgentDocs gives the exact command and prompt, while the
developer stays in control of where it is installed.

The persistent prompt is:

```txt
Use the AgentDocs MCP server before web search. Start at agentdocs://map with browse_docs, follow structural and semantic relations that fit the task, and use read_docs on exact selected refs before implementing.
```

The MCP server is still read-only. New workflow tools expose richer built
artifact behavior, but they do not crawl, execute commands from docs, or read
arbitrary files:

- `list_available_tasks`
- `browse_docs`
- `read_docs`
- `query_docs`
- `read_page`
- `get_task_context`
- `verify_task_context`
- `explain_warning`
- `get_setup_commands`
- `get_version_policy`
- `find_code_examples`

If `serve-mcp --tools` is used, hidden tools are rejected at call time as well
as omitted from `tools/list`.

## Generated Agent Brief

Every build now emits `.agentdocs/agent-brief.md`. It is intentionally short:
project identity, first steps, the persistent prompt, preferred context, task
packs, and version policy. It exists because agents often begin a later session
without remembering which MCP tools or generated files matter.

The brief is not a replacement for task packs or the agent map. It is a stable
entry point that tells the agent how to use the richer artifacts.
