import type { StatusReport } from "@agentdocs/shared";

import { readStatusReport } from "./workflow.js";
import type { AgentDocsConfig } from "@agentdocs/shared";

export type BuildCheckContext = {
  config?: AgentDocsConfig;
  configPath: string;
  cwd: string;
  out: string;
};

export class BuildCheckFailedError extends Error {
  override readonly name = "BuildCheckFailedError";
  readonly exitCode = 4;
}

export async function runBuildCheck(context: BuildCheckContext): Promise<StatusReport> {
  return readStatusReport(context);
}

export function assertBuildCheckPassed(report: StatusReport): void {
  if (report.state !== "fresh") {
    throw new BuildCheckFailedError(`AgentDocs context is ${report.state}. Run "agentdocs rebuild --changed" or "agentdocs build" before committing generated artifacts.`);
  }
}

export function formatBuildCheckReport(report: StatusReport): string {
  const header = report.state === "fresh"
    ? "AgentDocs build check: PASS"
    : `AgentDocs build check: ${report.state.toUpperCase()}`;
  const staleSources = report.sources.filter((source) => source.state !== "fresh");
  const staleArtifacts = report.artifacts.filter((artifact) =>
    artifact.state === "missing" || artifact.state === "stale" || artifact.state === "unknown");
  const sourceLines = staleSources.length === 0
    ? "- No stale sources."
    : staleSources.map((source) => `- ${source.value}: ${source.reason}`).join("\n");
  const artifactLines = staleArtifacts.length === 0
    ? "- No stale artifacts."
    : staleArtifacts.map((artifact) => `- ${artifact.path}: ${artifact.reason}`).join("\n");
  return `${header}\n${report.summary}\n\nSources:\n${sourceLines}\n\nArtifacts:\n${artifactLines}\n\nNext actions:\n${report.recommendations.map((item) => `- ${item}`).join("\n")}\n`;
}
