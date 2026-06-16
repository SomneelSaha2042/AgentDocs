# CLI Commands

| Command | Purpose |
| --- | --- |
| `agentdocs try <url-or-path> --goal <goal>` | Build, audit, and find context in one command |
| `agentdocs context <goal>` | Produce a compact agent context bundle from built artifacts |
| `agentdocs handoff <goal>` | Produce an agent-native task handoff with freshness and MCP guidance |
| `agentdocs setup-agent` | Print MCP setup snippets for common coding-agent clients |
| `agentdocs status` | Check whether generated artifacts are fresh |
| `agentdocs rebuild --changed` | Recollect stale configured sources and rebuild artifacts |
| `agentdocs watch` | Poll status and rebuild when configured sources become stale |
| `agentdocs verify-context --task <goal>` | Check task context for staleness, conflicts, weak evidence, and mismatches |
| `agentdocs init` | Create starter configuration |
| `agentdocs ingest <path>` | Collect local Markdown and MDX |
| `agentdocs crawl <url>` | Collect same-origin website documentation |
| `agentdocs build` | Generate artifacts and search index |
| `agentdocs doctor` | Audit agent readiness |
| `agentdocs search <query>` | Search built artifacts offline |
| `agentdocs inspect entities` | Inspect extracted entities |
| `agentdocs inspect links` | Inspect extracted relationships |
| `agentdocs inspect task-pack <id>` | Explain why a task pack was generated |
| `agentdocs serve-mcp` | Start the read-only MCP server |

Global options include `--config`, `--out`, `--cwd`, `--json`, `--quiet`, and
`--verbose`.

```bash
agentdocs --help
agentdocs try ./docs --goal "implement authentication"
agentdocs handoff "implement authentication"
agentdocs setup-agent --client codex
agentdocs status
agentdocs build --help
```

`agentdocs export`, `build --clean`, and additional inspect targets are planned.

Task-pack inspection reads the validated `agent-map.json` and reports the
pack's confidence, required pages, source evidence, steps, and related
entities:

```bash
agentdocs inspect task-pack quickstart
agentdocs --json inspect task-pack authentication
```

`try` accepts `--include`, `--exclude`, `--max-pages`, and `--sitemap` for
scoped website trials. Direct `crawl` and `try` infer a guide scope unless
explicit include patterns are supplied.

`ingest --strict` disables tolerant MDX fallback. `search --facet key=value`
is repeatable and applies hard context filters:

```bash
agentdocs ingest ./docs --strict
agentdocs search "migration" --facet version=v5
agentdocs search "route handler" --facet framework=nextjs --facet router=app
```

Search JSON includes evidence-linked facets and deterministic
`context_conflict` warnings when unfiltered top results mix exclusive context.

`handoff` is the recommended multi-session command. `context` remains supported
for the earlier compact bundle shape. `status`, `rebuild --changed`, and `watch`
use deterministic source fingerprints for local/repo sources and a website TTL
for crawled sources.
