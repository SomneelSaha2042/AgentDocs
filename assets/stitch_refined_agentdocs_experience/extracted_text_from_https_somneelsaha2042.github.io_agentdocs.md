Skip to content

[AgentDocs](/AgentDocs/)

Search```K`

Main Navigation [Guide](/AgentDocs/guide/installation.html)[Results](/AgentDocs/results/)[Reference](/AgentDocs/reference/configuration.html)[GitHub](https://github.com/SomneelSaha2042/AgentDocs)

[](https://github.com/SomneelSaha2042/AgentDocs)

Appearance

[](https://github.com/SomneelSaha2042/AgentDocs)

# AgentDocsPrevent coding agents from using stale, wrong-version, or incomplete documentation

A local context compiler and CI gate that gives coding agents task-specific, source-linked evidence.

[Get Started](/AgentDocs/guide/installation.html)

[See Real-World Results](/AgentDocs/results/)

[View on GitHub](https://github.com/SomneelSaha2042/AgentDocs)

## What AgentDocs Is ​

Agents fail when they reuse stale docs, mix versions or frameworks, or start a task without source-backed evidence. AgentDocs compiles existing documentation into a separate local context layer optimized for task execution, without rewriting the source docs.

It puts three questions in front of every agent handoff:

  * Is the compiled context fresh?
  * Is it scoped to the right version, framework, router, runtime, or locale?
  * Does it contain evidence for the task I am about to ask an agent to do?



Install the published beta from npm:

bash
```

    npm install --global @somneelsaha/agentdocs
    agentdocs try ./docs --goal "implement authentication"

```

Start with the [installation guide](/AgentDocs/guide/installation.html), then complete the [five-minute quick start](/AgentDocs/guide/quick-start.html). For the design behind multi-session agent use, read the [agent workflow guide](/AgentDocs/guide/agent-workflow.html).

## Choose Your Entry Point ​

If you...| Start here| Success metric  
---|---|---  
Maintain documentation| `agentdocs build && agentdocs doctor`| CI can catch missing task evidence, stale context, source coverage gaps, and unsafe mixed context.  
Use coding agents on an application| `agentdocs try <url-or-path> --goal "<task>"`| The agent gets a scoped handoff with source pages, task packs, warnings, and setup commands.  
Operate agent infrastructure| `agentdocs serve-mcp`| Agents can reuse read-only local task context through MCP without arbitrary filesystem access.  
  
## What It Looks Like ​

bash
```

    $ agentdocs verify-context --task "migrate this service to Fastify v5"
    WARN: Context needs review.
      Issue: deprecated_evidence
      Selected task pack: migration
      Recommended action: inspect the migration task pack and apply version facets when searching.
    
    $ agentdocs verify-context --task "migrate this service to Fastify v5" --facet version=v5
    PASS: Context is safe to use for this task.
      Version boundary: v5
      Task evidence: source-linked migration sections

```

## From docs to gateable context ​

### [Compile existing docsCollect, normalize, graph, and generate deterministic local context from existing docs.](/AgentDocs/guide/quick-start.html)### [Scope retrievalFilter versions, frameworks, routers, and runtimes while retrieving evidence offline.](/AgentDocs/guide/search-mcp.html)### [Trace every claimLink task packs, entities, and findings back to source pages, headings, and code.](/AgentDocs/reference/artifacts.html)### [Generate task packsGive coding agents compact task context without silently combining conflicting evidence.](/AgentDocs/reference/artifacts.html)### [Hand off to agentsServe task context, freshness, verification, setup commands, and source evidence through read-only MCP.](/AgentDocs/guide/search-mcp.html)### [Gate readinessCheck freshness, coverage, evidence quality, and context conflicts before agents start work.](/AgentDocs/guide/doctor.html)### [Run locally and safelyKeep the core offline, treat docs as untrusted input, and never execute crawled commands.](/AgentDocs/guide/architecture.html)

## Why the workflow layer exists ​

The first version proved that AgentDocs could compile docs into task packs, search, readiness reports, and MCP resources. The next problem was operational: an agent needs to reuse the right context tomorrow without rereading the internet or mixing stale evidence into a task.

AgentDocs now records build state, fingerprints local sources, expires website crawls by TTL, emits `agent-brief.md`, and exposes `handoff` and `verify-context` through both CLI and MCP. The tradeoff is intentionally boring: status checks are deterministic and local, while live recrawling remains an explicit build action.

## Validated Against Real Documentation ​

AgentDocs was tested against its own docs and documentation from Hono, Fastify, Supabase, TanStack Query, Next.js, Octokit, Django, CPython, Spring Framework, and Airflow. The post-hardening regression suite compiled successful targets twice, audited readiness, and checked version, framework, router, locale, content-type, MDX, Sphinx/reST, AsciiDoc, and task-pack behavior. Deterministic compilation and context-risk detection are proven. End-to-end agent-task benchmarks are still in progress.

Result| Evidence  
---|---  
Deterministic output| Every successful target produced the same artifact hash on its repeated build  
Resilient MDX| Supabase compiled 737 pages while preserving per-file degraded and failed diagnostics  
Sphinx & AsciiDoc Parsing| Django, CPython, Spring Framework, and Airflow compiled cleanly with Sphinx/reST and AsciiDoc normalizers  
Large website crawl| Next.js compiled a bounded 100-page crawl into 823 chunks and 7 task packs  
Context-safe retrieval| Fastify v5 filters exclude v3 evidence; TanStack React filters exclude other frameworks  
Context risk detection| Unsafe unfiltered retrieval emits explicit conflict warnings  
  
The important result is not that every target passed. It is that AgentDocs makes useful context, unsafe context, and degraded normalization measurable before a coding agent relies on them.

[Read the benchmark summary](/AgentDocs/results/benchmark-summary.html), explore the [real-world findings](/AgentDocs/results/), or read the [reproducible methodology](/AgentDocs/results/methodology.html).

Released under the MIT License.

Copyright 2026 Somneel Saha