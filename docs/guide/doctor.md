# Readiness Doctor

`agentdocs doctor` audits whether documentation gives coding agents enough
evidence to perform common tasks safely.

```bash
agentdocs doctor
agentdocs doctor --min-score 80
agentdocs doctor --category task_coverage
agentdocs doctor --json
```

Checks cover discoverability, structure, task coverage, version safety, agent
safety, and runtime readiness. Findings identify inspected evidence and provide
specific recommendations.

Use `--min-score` in CI. A score below the threshold exits with code `5`.
