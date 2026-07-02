import { ArtifactService } from "@agentdocs/mcp-server";
import { type ContextBundle } from "@agentdocs/shared";

export type ContextOptions = {
  cwd: string;
  goal: string;
  out: string;
};

export async function buildContextBundle(options: ContextOptions): Promise<ContextBundle> {
  return new ArtifactService({ cwd: options.cwd, out: options.out })
    .getContextBundle(options.goal);
}

export function formatContextBundle(bundle: ContextBundle): string {
  const rules = bundle.rules.length === 0
    ? "- No task-specific rules found."
    : bundle.rules.map((rule) => `- ${rule}`).join("\n");
  const selectedTaskPack = bundle.selectedTaskPack === undefined
    ? "Selected task pack: none"
    : `Selected task pack: ${bundle.selectedTaskPack.id} (${bundle.selectedTaskPack.confidence} confidence)`;
  const warnings = bundle.goalBundle.warnings.length === 0 && bundle.search.warnings.length === 0
    ? "- No context warnings."
    : [
        ...bundle.goalBundle.warnings.map((warning) => `- ${warning.code}: ${warning.key}=${warning.values.join(",")}`),
        ...bundle.search.warnings.map((warning) => `- ${warning.code}: ${warning.key}=${warning.values.join(",")}`),
      ].join("\n");
  const evidence = bundle.search.results.length === 0
    ? "- No matching source evidence found."
    : bundle.search.results.map((result) => {
        const source = result.sourceUrl ?? result.repoPath ?? "Unknown source";
        const heading = result.headingPath.length === 0
          ? ""
          : ` > ${result.headingPath.join(" > ")}`;
        return `- ${result.title}${heading}\n  ${source}\n  ${result.snippet}`;
      }).join("\n");
  const taskPack = bundle.selectedTaskPack === undefined
    ? "No matching task pack found."
    : bundle.selectedTaskPack.markdown.trim();
  const goalSteps = bundle.goalBundle.steps.map((step, index) =>
    `${index + 1}. **${step.role}: ${step.title}**\n   ${step.snippet}\n   ${step.resource}`,
  ).join("\n");

  return `Goal: ${bundle.goal}

${bundle.summary}

${selectedTaskPack}

## Goal bundle
Confidence: ${bundle.goalBundle.confidence}

${goalSteps}

## Read first
${bundle.readFirst.map((resource) => `- ${resource}`).join("\n")}

## Rules
${rules}

## Warnings
${warnings}

## Task pack
${taskPack}

## Supporting evidence
${evidence}
`;
}
