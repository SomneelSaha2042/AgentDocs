# Active Evaluation Sandbox

This document explains how to run active agent evaluations to benchmark AgentDocs against a control group and compute production-readiness metrics.

## Architecture Overview

To test the actual value of AgentDocs, the evaluation harness runs a standardized coding task in two modes:
1. **Control Group:** The agent implements the task using only standard filesystem tools (no documentation tools or MCP server).
2. **Experimental Group:** The agent implements the task with access to the `agentdocs serve-mcp` server.

## Telemetry Captured

The evaluation runner captures:
- **Task Success Rate Delta:** Did the agent produce code that passed the task's CI validation with AgentDocs vs. without?
- **Turns Saved:** Did using task-specific context reduce the number of agent turns needed to reach a passing implementation?
- **Token Usage Delta:** Did AgentDocs reduce the prompt token budget?
- **Time Delta:** Total run execution time differences.

---

## Setup & Running

### Step 1: Run Control Group
Set your API key (either `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`) and run the control trial.
```bash
# PowerShell
$env:OPENAI_API_KEY="your-api-key"
node scripts/eval-runner.mjs --task dummy-sdk --control

# Bash
export OPENAI_API_KEY="your-api-key"
node scripts/eval-runner.mjs --task dummy-sdk --control
```

By default, the runner uses the model `gpt-4o` if `OPENAI_API_KEY` is present, or `claude-3-5-sonnet-20241022` if `ANTHROPIC_API_KEY` is present. You can override this using the `--provider` option (e.g., `--provider anthropic`).

### Step 2: Run Experimental Group
Run the runner again without the `--control` flag to execute the task with AgentDocs MCP server context:
```bash
node scripts/eval-runner.mjs --task dummy-sdk
```

### Step 3: Aggregate Results
After running both trials, execute the metrics aggregator to generate the comparative delta:
```bash
node scripts/aggregate-metrics.mjs dummy-sdk
```

This will print out the final benchmark results (e.g. Success Rate Delta, Turns Saved, Tokens Saved) and save the detailed breakdown to `.dogfood/eval-summary-dummy-sdk.json`.
