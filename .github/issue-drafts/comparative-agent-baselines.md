# Add comparative baselines for agent-context workflows

## Problem

Current dogfood results show that AgentDocs can compile, audit, and route
documentation context deterministically. They do not yet show how AgentDocs
compares with an adopter's existing workflow.

A prospective adopter will reasonably ask whether AgentDocs improves over:

- direct coding-agent web browsing;
- repository keyword search;
- native coding-agent search;
- `llms.txt` only;
- generic vector RAG;
- unfiltered AgentDocs search;
- AgentDocs search with facets and verification.

## Proposed change

Add a comparative benchmark harness for a small set of representative tasks.
Each task should run against at least one baseline and one AgentDocs-assisted
workflow, then record outcome and operational cost.

## Scope

- Define 3-5 benchmark tasks from existing dogfood targets.
- Record baseline context source, prompt, tool access, and constraints.
- Compare task success, wrong-version/wrong-framework mistakes, elapsed time,
  review corrections, token/context size, and web/network use where available.
- Preserve failed and inconclusive runs instead of omitting them.
- Publish an adopter-facing comparison table.

## Acceptance criteria

- Public docs include at least one baseline comparison.
- The comparison distinguishes compile success from implementation success.
- Metrics are deterministic where possible and explicit where human judgment is
  required.
- No benchmark requires a mandatory LLM dependency in the AgentDocs core.

## Notes

This should complement, not replace, the existing dogfood regression. The
baseline can start manual and become more automated later.
