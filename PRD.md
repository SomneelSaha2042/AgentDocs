# PRD: AgentDocs

## 1. Product summary

AgentDocs is a local-first, deterministic open-source tool that makes existing technical documentation usable by coding agents.

It crawls or ingests existing docs, normalizes them into structured markdown, extracts machine-readable structure, builds an agent-facing context layer, and reports issues that cause agents to use a dependency incorrectly.

AgentDocs is not a docs chatbot, not a generic RAG wrapper, and not a hosted documentation platform. It is a compiler and auditor for agent-readable documentation.

## 2. One-line positioning

Make your docs agent-ready without changing docs platforms.

## 3. Product thesis

Most technical docs are written for humans browsing pages. Coding agents need a different interface:

- What is this project or dependency?
- Which version is current?
- Which docs are canonical?
- What should I read first for a specific task?
- Which APIs, imports, commands, environment variables, and examples are safe to use?
- What is deprecated or dangerous?
- What context should be loaded for implementation, debugging, migration, or setup?

AgentDocs turns human-facing docs into an agent-operable context layer.

## 4. Problem statement

Developers increasingly use coding agents to build with unfamiliar libraries, frameworks, APIs, SDKs, and internal platforms. Existing docs often fail agents because they are:

- fragmented across many pages;
- optimized for human navigation rather than task execution;
- mixed with marketing, blog, changelog, or legacy content;
- ambiguous about versions;
- missing canonical implementation paths;
- inconsistent about deprecated APIs;
- too large or noisy to paste into a coding agent;
- difficult to expose through MCP or other agent tool surfaces.

The result is that agents often produce code that looks plausible but uses stale imports, wrong authentication flows, unsafe examples, incomplete setup, or outdated APIs.

## 5. Target users

### 5.1 Developer using a dependency

A developer wants to use a library, framework, SDK, API, or internal platform with Codex or another coding agent. They do not want to manually paste many docs pages.

Primary workflow:

```bash
agentdocs try https://docs.example.com --goal "implement webhook verification"
agentdocs setup-agent
agentdocs serve-mcp
```

Then, inside a coding agent:

```txt
Use the AgentDocs MCP server to implement webhook signature verification with this SDK.
```

### 5.2 Open-source maintainer

A maintainer wants agents to use their project correctly. They want to publish agent-facing artifacts without migrating docs platforms.

Primary workflow:

```bash
agentdocs doctor
agentdocs build
```

They commit:

```txt
llms.txt
AGENTS.md
.agentdocs/agent-map.json
.agentdocs/task-packs/*.md
```

### 5.3 Docs/platform team

A docs or platform team wants to check whether internal docs are usable by AI coding agents. They want repeatable CI checks, readiness scoring, and artifact generation.

This is not the first target persona for v1, but the product should be designed so this path remains possible.

## 6. Jobs to be done

### JTBD 1: Use a dependency with an agent

When I want to build with an unfamiliar dependency, I want a compact, accurate, task-specific context layer so that my coding agent can start implementation without me manually collecting docs.

### JTBD 2: Make my project agent-ready

When people use agents to build with my project, I want to publish deterministic agent-facing context artifacts so agents choose the correct APIs, examples, and constraints.

### JTBD 3: Detect docs issues that break agents

When my docs evolve, I want a repeatable scanner that tells me whether agents will receive stale, ambiguous, incomplete, or unsafe context.

## 7. Core product principles

1. **Deterministic first**  
   The core pipeline must work without an LLM. Crawling, normalization, structure extraction, indexing, artifact generation, and readiness checks should be deterministic.

2. **Traceable outputs**  
   Generated artifacts should preserve evidence. If AgentDocs claims a task pack needs a page, it should be possible to trace that inclusion to a URL, heading, code block, OpenAPI endpoint, or rule.

3. **Task packs over random chunks**  
   Agents do not need arbitrary search snippets. They need compact bundles for tasks such as quickstart, authentication, webhooks, migration, pagination, deployment, and debugging.

4. **Portable over hosted**  
   v1 should be a local CLI with static outputs and a local MCP server. No account, cloud dependency, or hosted backend is required.

5. **Works with existing docs**  
   AgentDocs should run on Docusaurus, Mintlify, GitBook, ReadMe, Nextra, custom markdown, static HTML, local docs folders, and repos over time. The first version may support a smaller set.

6. **No docs rewrite in v0**  
   AgentDocs creates an agent-facing layer on top of docs. It does not modify or rewrite the source docs.

7. **Security-conscious by default**  
   The tool must treat external docs, crawled content, and MCP tool descriptions as untrusted input. Generated instructions must not silently execute arbitrary commands from docs.

## 8. Non-goals

v1 is not:

- a chatbot over docs;
- a full RAG platform;
- a hosted SaaS;
- a docs CMS;
- a replacement for Docusaurus, Mintlify, GitBook, ReadMe, or Nextra;
- an autonomous coding agent;
- a codebase understanding platform;
- an LLM-powered docs rewriter;
- an analytics dashboard;
- a browser extension.

## 9. Product surfaces

### 9.1 CLI

Primary user interface.

Required commands for v1:

```bash
agentdocs try <url-or-path>
agentdocs context <goal>
agentdocs handoff <goal>
agentdocs setup-agent
agentdocs status
agentdocs rebuild --changed
agentdocs watch
agentdocs verify-context --task <goal>
agentdocs init
agentdocs crawl <source>
agentdocs ingest <path>
agentdocs build
agentdocs doctor
agentdocs search <query>
agentdocs inspect <target>
agentdocs export
agentdocs serve-mcp
```

### 9.2 Static artifacts

Generated outputs:

```txt
llms.txt
AGENTS.md
.agentdocs/manifest.json
.agentdocs/agent-map.json
.agentdocs/chunks.jsonl
.agentdocs/task-packs/*.md
.agentdocs/reports/agent-readiness.md
.agentdocs/index.sqlite
```

### 9.3 MCP server

A local MCP server exposes the generated context to coding agents.

Initial MCP tools:

```txt
search_docs
get_page
get_task_pack
get_related_pages
get_code_examples
get_agent_start_context
```

Initial MCP resources:

```txt
agentdocs://llms.txt
agentdocs://AGENTS.md
agentdocs://manifest.json
agentdocs://agent-map.json
agentdocs://task-packs/{task}.md
agentdocs://pages/{pageId}.md
```

## 10. v1 scope

### 10.1 Inputs

v1 inputs:

- one public docs URL;
- local markdown, MDX, reST, text, AsciiDoc, or repository docs directory where supported by the normalizer;
- OpenAPI config is recognized and rejected early in this build with a clear unsupported-source message; ingestion is deferred to a future opt-in adapter;
- optional package metadata from local `package.json`.

Not required in v1:

- authentication for private docs;
- PDFs;
- Confluence;
- Slack or Discord;
- deep GitHub code intelligence;
- cloud execution.

### 10.2 Outputs

v1 outputs:

- normalized pages;
- page/chunk metadata;
- link graph;
- code block inventory;
- extracted package names, imports, env vars, CLI commands, API routes;
- `llms.txt`;
- `AGENTS.md`;
- `agent-map.json`;
- deterministic task packs;
- agent-readiness report;
- SQLite full-text index;
- local MCP server.

### 10.3 Deterministic extraction targets

v1 should extract:

- page titles;
- heading hierarchy;
- internal and external links;
- code blocks with language tags;
- package install commands;
- JavaScript/TypeScript imports;
- environment variables;
- shell commands;
- HTTP methods and routes;
- no OpenAPI operations in v1 unless a future opt-in adapter is implemented;
- warning/admonition blocks;
- deprecated markers;
- version strings;
- likely task pages by title, heading, URL, and nav labels.

## 11. Functional requirements

### FR1: Initialize project

`agentdocs init` creates `agentdocs.config.yaml` with sensible defaults.

Acceptance criteria:

- Creates config in current directory.
- Does not overwrite existing config without confirmation or `--force`.
- Includes commented examples for website, local markdown, and repo sources. OpenAPI examples are omitted until OpenAPI ingestion is implemented; config validation fails early with an actionable unsupported-source message.

### FR2: Crawl docs source

`agentdocs crawl <url>` crawls a docs website and stores raw/normalized pages.

Acceptance criteria:

- Uses sitemap when available.
- Falls back to internal link crawling.
- Respects include/exclude rules.
- Avoids infinite loops.
- Deduplicates canonical URLs.
- Stores raw HTML and normalized markdown.
- Preserves title, headings, links, code blocks, and source URL.

### FR3: Ingest local markdown

The tool can ingest a local markdown directory.

Acceptance criteria:

- Supports `.md` and `.mdx` files.
- Preserves relative links.
- Extracts frontmatter.
- Produces the same normalized page model as website crawling.

### FR4: Build index and graph

`agentdocs build` builds the internal model.

Acceptance criteria:

- Generates chunks by heading boundaries.
- Builds page-link graph.
- Extracts entities and relationships.
- Builds SQLite FTS index.
- Emits schema-valid `manifest.json`, `agent-map.json`, and `chunks.jsonl`.

### FR5: Generate agent artifacts

`agentdocs build` generates agent-facing files.

Acceptance criteria:

- Generates concise `llms.txt`.
- Generates operational `AGENTS.md`.
- Generates task packs for known task families when evidence exists.
- Does not invent missing docs.
- Includes source evidence in task packs.

### FR6: Doctor/readiness report

`agentdocs doctor` produces an agent-readiness report.

Acceptance criteria:

- Reports score from 0 to 100.
- Reports pass/warn/fail checks.
- Flags missing quickstart, missing auth, missing examples, broken links, deprecated markers, unclear versioning, giant pages, and missing task packs.
- Writes `.agentdocs/reports/agent-readiness.md`.
- Exits non-zero only when configured threshold fails.

### FR7: Search

`agentdocs search <query>` searches the local index.

Acceptance criteria:

- Searches page titles, headings, and chunks.
- Shows ranked results with page title, URL/path, heading path, and snippet.
- Does not require network access after build.

### FR8: MCP server

`agentdocs serve-mcp` exposes context through MCP.

Acceptance criteria:

- Starts locally over stdio for MCP clients.
- Exposes the initial tools and resources.
- Reads only from generated `.agentdocs` artifacts.
- Does not crawl or execute arbitrary commands through MCP tools.

### FR9: Inspect/debug commands

`agentdocs inspect <target>` helps users understand outputs.

Acceptance criteria:

- Supports `pages`, `links`, `entities`, `task-packs`, `chunks`, `config`, and `broken-links`.
- Outputs human-readable tables or JSON with `--json`.

## 12. Readiness scoring model

The score should be deterministic and explainable.

Suggested categories:

| Category | Weight | Example checks |
|---|---:|---|
| Discoverability | 20 | sitemap, canonical URLs, markdown-friendly pages, nav structure |
| Structure | 20 | headings, small pages, code blocks, link graph, page metadata |
| Task coverage | 25 | quickstart, auth, install, examples, errors, migration, deployment |
| Version safety | 15 | version labels, deprecated markers, current package names |
| Agent safety | 10 | security warnings, auth constraints, secret handling, webhook verification |
| Runtime readiness | 10 | generated llms.txt, AGENTS.md, task packs, MCP resources |

Example output:

```txt
Agent-readiness: 72/100

Critical:
- No canonical task pack for webhooks.
- v1 and v2 SDK examples appear in the same guide.

Warnings:
- 12 pages exceed recommended context size.
- 7 code examples lack package version hints.
```

## 13. Task-pack model

Task packs are compact, evidence-linked implementation bundles.

Initial task families:

- quickstart;
- installation;
- authentication;
- environment setup;
- API usage;
- pagination;
- webhooks;
- errors/debugging;
- deployment;
- migration;
- configuration;
- testing.

A task pack should include:

- task summary;
- when to use it;
- required source pages;
- canonical steps;
- code examples;
- gotchas and warnings;
- related APIs/entities;
- evidence links.

Task packs must not claim unsupported behavior. If evidence is weak, the pack should say so.

## 14. Success metrics

### Developer utility metrics

- Time from docs URL to generated context under 5 minutes for a medium docs site.
- A user can connect the MCP server to a coding agent and retrieve task context.
- Search returns relevant docs for common tasks.
- Task packs are compact enough to paste into agents manually.

### Maintainer utility metrics

- Doctor report identifies at least 5 actionable issues on real docs sites.
- Generated `llms.txt` and `AGENTS.md` are good enough to commit with minor edits.
- CI mode can fail on a configurable readiness threshold.

### Technical metrics

- Deterministic tests pass offline.
- Build can be rerun idempotently.
- Generated artifacts validate against schemas.
- v1 has no required LLM dependency.

### Production value metrics

The current metrics prove the compiler works. What is needed to actually measure value in production:

- **Task success rate delta**: % of agent tasks that produce passing CI with AgentDocs context vs. without, on a fixed task suite.
- **Time-to-correct-implementation**: How many agent turns/tokens until a passing implementation, with and without AgentDocs.
- **Context conflict rate surfaced vs. missed**: Of all cases where an agent would have received wrong-version context, what % did AgentDocs catch?
- **Routing precision@1**: For a given natural language task goal, does the correct task pack appear first, measured across a standardized task suite (not just the targets the tool was tuned on).
- **False positive gate rate**: How often does verify-context fail when the context was actually safe? (i.e., is the gate blocking legitimate work).
- **Build cold-start and incremental time**: At repo scale; this matters for CI integration cost.
- **Per-task token usage delta**: Does using task packs reduce the token budget the agent spends on context retrieval?

Task success and correct source use are the primary product signals. Tokens,
turns, latency, and cost are secondary descriptive metrics: they never offset a
failed task or evidence gap.

## 15. Future scope

Potential future features:

- optional LLM enrichment with evidence requirements;
- GitHub Actions integration;
- private docs auth;
- PDF/Confluence/Notion ingestion;
- generated docs improvement PRs;
- hosted report viewer;
- vector/hybrid search;
- deeper codebase graphing;
- multi-version docs comparison;
- stale agent-context detection;
- framework-specific adapters;
- badges for agent-readiness.

## 16. Key product risks

### Risk: The output is too generic

Mitigation: Make outputs evidence-linked, task-specific, and grounded in real commands, imports, APIs, warnings, and examples.

### Risk: Docs platforms add native support

Mitigation: Stay portable, local-first, open-source, framework-agnostic, and CI-friendly.

### Risk: Agents ignore large context

Mitigation: Return coverage-first task context and exact source references. Use
lossless continuation reads for more detail instead of silently truncating
evidence.

### Risk: Dynamic docs are hard to crawl

Mitigation: Start with sitemap/static/markdown support. Add Playwright fallback later.

### Risk: LLM summaries hallucinate

Mitigation: Keep v0 deterministic. Optional enrichment must include evidence links and validation.

## 17. v1 definition of done

v1 is done when a developer can run:

```bash
agentdocs try https://docs.example.com --goal "implement authentication"
agentdocs handoff "implement authentication"
agentdocs setup-agent
agentdocs serve-mcp
agentdocs verify-context --task "implement authentication"
agentdocs status
```

And receive:

```txt
llms.txt
AGENTS.md
.agentdocs/agent-map.json
.agentdocs/task-packs/*.md
.agentdocs/reports/agent-readiness.md
.agentdocs/index.sqlite
.agentdocs/agent-brief.md
.agentdocs/state/build-state.json
```

The generated context must be compact, evidence-linked, deterministic, and
consistent between CLI and MCP surfaces for the same implementation goal.

With no required LLM API key, no hosted account, and repeatable offline search after build.
