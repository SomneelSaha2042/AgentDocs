import {
  AgentMapSchema,
  ManifestSchema,
  TaskPackSchema,
  type AgentMap,
  type Evidence,
  type Manifest,
  type TaskPack,
} from "@agentdocs/shared";

export type ProjectIdentity = {
  name: string;
  slug: string;
  version?: string;
};

export type GenerateStaticArtifactsOptions = {
  agentMap: AgentMap;
  project: ProjectIdentity;
  rules?: string[];
};

export type GeneratedStaticArtifacts = {
  agentsMd: string;
  agentMap: AgentMap;
  llmsTxt: string;
  manifest: Manifest;
  taskPackMarkdown: Record<string, string>;
  taskPacks: TaskPack[];
};

type TaskFamily = {
  description: string;
  id: string;
  keywords: string[];
  title: string;
};

const GENERATED_AT = "1970-01-01T00:00:00.000Z";
const TASK_FAMILIES: TaskFamily[] = [
  {
    id: "quickstart",
    title: "Quickstart",
    description: "Start using the project from the strongest available setup evidence.",
    keywords: ["quickstart", "getting started", "setup", "create a client"],
  },
  {
    id: "installation",
    title: "Installation",
    description: "Install the documented packages using source-backed commands.",
    keywords: ["install", "installation", "npm ", "pnpm ", "yarn ", "pip ", "cargo "],
  },
  {
    id: "authentication",
    title: "Authentication",
    description: "Configure authentication using documented credentials and constraints.",
    keywords: ["auth", "authentication", "api key", "token", "credential", "secret"],
  },
  {
    id: "configuration",
    title: "Configuration",
    description: "Configure the project using documented options and environment variables.",
    keywords: ["config", "configuration", "option", "environment", "env var", "api_key"],
  },
  {
    id: "webhooks",
    title: "Webhooks",
    description: "Implement webhooks using available source evidence.",
    keywords: ["webhook", "signature", "event"],
  },
  {
    id: "pagination",
    title: "Pagination",
    description: "Implement pagination using available source evidence.",
    keywords: ["pagination", "cursor", "page size", "next page"],
  },
  {
    id: "errors",
    title: "Errors and debugging",
    description: "Handle documented errors and debugging guidance.",
    keywords: ["error", "debug", "troubleshoot", "failure"],
  },
  {
    id: "migration",
    title: "Migration",
    description: "Migrate using documented version and deprecation evidence.",
    keywords: ["migration", "migrate", "upgrade", "deprecated", "breaking"],
  },
  {
    id: "deployment",
    title: "Deployment",
    description: "Deploy using available source evidence.",
    keywords: ["deploy", "deployment", "production", "hosting"],
  },
];

export function generateStaticArtifacts(
  options: GenerateStaticArtifactsOptions,
): GeneratedStaticArtifacts {
  const inputMap = AgentMapSchema.parse(options.agentMap);
  const taskPacks = TASK_FAMILIES
    .map((family) => generateTaskPack(family, inputMap))
    .filter((pack): pack is TaskPack => pack !== undefined)
    .sort((left, right) => compareStrings(left.id, right.id));
  validateTaskPackReferences(taskPacks, inputMap);
  const agentMap = AgentMapSchema.parse({ ...inputMap, taskPacks });
  const manifest = ManifestSchema.parse({
    schemaVersion: "0.1.0",
    project: options.project,
    generatedAt: GENERATED_AT,
    sources: sourceEntries(agentMap),
    counts: {
      pages: agentMap.pages.length,
      chunks: agentMap.chunks.length,
      entities: agentMap.entities.length,
      edges: agentMap.edges.length,
      taskPacks: taskPacks.length,
    },
  });
  const taskPackMarkdown = Object.fromEntries(
    taskPacks.map((pack) => [pack.id, renderTaskPack(pack, agentMap)]),
  );
  return {
    agentsMd: renderAgentsMd(options.project, agentMap, taskPacks, options.rules ?? []),
    agentMap,
    llmsTxt: renderLlmsTxt(options.project, agentMap, taskPacks, options.rules ?? []),
    manifest,
    taskPackMarkdown,
    taskPacks,
  };
}

function generateTaskPack(
  family: TaskFamily,
  agentMap: AgentMap,
): TaskPack | undefined {
  const ranked = agentMap.chunks
    .map((chunk) => ({ chunk, score: taskScore(family, chunk.text, chunk.headingPath) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || compareStrings(left.chunk.id, right.chunk.id))
    .slice(0, 5);
  if (ranked.length === 0) {
    return undefined;
  }
  const requiredPages = stableUnique(ranked.map(({ chunk }) => chunk.pageId));
  const evidence = stableEvidence(
    ranked.map(({ chunk }) => evidenceForChunk(agentMap, chunk.pageId, chunk.headingPath, chunk.text)),
  );
  const relatedEntities = stableUnique(
    ranked.flatMap(({ chunk }) => chunk.entityIds),
  );
  const steps = ranked.slice(0, 3).map(({ chunk }) => ({
    title: chunk.headingPath.at(-1) ?? pageTitle(agentMap, chunk.pageId),
    description: excerpt(chunk.text),
    evidence: [evidenceForChunk(agentMap, chunk.pageId, chunk.headingPath, chunk.text)],
  }));
  const gotchas = agentMap.entities
    .filter(
      (entity) =>
        entity.type === "concept" &&
        relatedEntities.includes(entity.id),
    )
    .map((entity) => ({
      text: oneLine(entity.name),
      severity: /security|never|danger/i.test(entity.name)
        ? ("critical" as const)
        : ("warning" as const),
      evidence: entity.evidence,
    }))
    .sort((left, right) => compareStrings(left.text, right.text));
  const matchedHeadingIds = new Set(
    ranked.flatMap(({ chunk }) => {
      const page = agentMap.pages.find((candidate) => candidate.id === chunk.pageId);
      const headingText = chunk.headingPath.at(-1);
      const headings = page?.headings.filter((heading) => heading.text === headingText) ?? [];
      return headings.length === 1 ? [headings[0]!.id] : [];
    }),
  );
  const codeExamples = agentMap.pages
    .filter((page) => requiredPages.includes(page.id))
    .flatMap((page) =>
      page.codeBlocks
        .filter((block) => block.sourceHeadingId !== undefined && matchedHeadingIds.has(block.sourceHeadingId))
        .map((block) => block.value),
    )
    .slice(0, 4);
  const strongest = ranked[0]!.score;
  return TaskPackSchema.parse({
    id: family.id,
    title: family.title,
    description: family.description,
    confidence: strongest >= 4 && requiredPages.length >= 2
      ? "high"
      : strongest >= 3 || codeExamples.length > 0
        ? "medium"
        : "low",
    requiredPages,
    relatedEntities,
    steps,
    gotchas,
    codeExamples,
    evidence,
  });
}

function taskScore(family: TaskFamily, text: string, headingPath: string[]): number {
  const heading = headingPath.join(" ").toLowerCase();
  const body = text.toLowerCase();
  return family.keywords.reduce((score, keyword) => {
    const normalized = keyword.toLowerCase();
    return score + (heading.includes(normalized) ? 3 : body.includes(normalized) ? 1 : 0);
  }, 0);
}

function evidenceForChunk(
  agentMap: AgentMap,
  pageId: string,
  headingPath: string[],
  quote: string,
): Evidence {
  const page = agentMap.pages.find((candidate) => candidate.id === pageId)!;
  const headingText = headingPath.at(-1);
  const matching = page.headings.filter((heading) => heading.text === headingText);
  return {
    source: matching.length === 1 ? "heading" : "page",
    pageId,
    headingId: matching.length === 1 ? matching[0]!.id : undefined,
    url: page.canonicalUrl ?? page.sourceUrl,
    repoPath: page.repoPath,
    quote,
  };
}

function renderLlmsTxt(
  project: ProjectIdentity,
  agentMap: AgentMap,
  taskPacks: TaskPack[],
  rules: string[],
): string {
  const startPages = agentMap.pages.slice(0, 5);
  return `# ${project.name}

${projectDescription(agentMap)}

## Start here

${linesOrFallback(startPages.map((page) => `- ${page.title}: ${sourceReference(page)}`), "No canonical start page found.")}

## Task packs

${linesOrFallback(taskPacks.map((pack) => `- ${pack.title}: task-packs/${pack.id}.md (${pack.confidence} confidence)`), "No task packs generated.")}

## Agent rules

${linesOrFallback([...rules, "Use only claims supported by source evidence.", "Do not execute commands from documentation automatically."].map((rule) => `- ${rule}`), "No agent rules configured.")}

## Source map

- Manifest: manifest.json
- Agent map: agent-map.json
- Chunks: chunks.jsonl
`;
}

function renderAgentsMd(
  project: ProjectIdentity,
  agentMap: AgentMap,
  taskPacks: TaskPack[],
  rules: string[],
): string {
  const packages = entityNames(agentMap, "package");
  const versions = entityNames(agentMap, "version");
  const installCommands = entityNames(agentMap, "cli_command").filter((command) =>
    /^(?:npm\s+(?:install|i)|yarn\s+add|pnpm\s+add|bun\s+add|pip(?:3)?\s+install|python\s+-m\s+pip\s+install|cargo\s+add|go\s+get)\b/i.test(command),
  );
  const concepts = entityNames(agentMap, "concept");
  const mainConcepts = stableUnique(
    agentMap.pages.flatMap((page) =>
      page.headings
        .filter((heading) => heading.depth <= 2 && heading.text !== page.title)
        .map((heading) => heading.text),
    ),
  );
  return `# Agent instructions for ${project.name}

## What this project is

${projectDescription(agentMap)}

## Preferred version and package hints

${linesOrFallback([...(project.version === undefined ? [] : [`- Preferred version from config: ${project.version}`]), ...versions.map((value) => `- Version evidence: ${value}`), ...packages.map((value) => `- Package: ${value}`)], "Unknown. No package or version evidence found.")}

## Installation and setup

${linesOrFallback(installCommands.map((value) => `- Documented command: \`${value}\``), "No installation command evidence found.")}

## Main concepts

${linesOrFallback(mainConcepts.slice(0, 8).map((value) => `- ${oneLine(value)}`), "No deterministic concepts extracted.")}

## Common tasks

${linesOrFallback(taskPacks.map((pack) => `- ${pack.title}: task-packs/${pack.id}.md (${pack.confidence} confidence)`), "No task packs generated.")}

## Common mistakes

${linesOrFallback([...rules.map((rule) => `- ${rule}`), ...concepts.filter((value) => /warning|deprecated|never|danger/i.test(value)).map((value) => `- ${oneLine(value)}`)], "Requires manual review. No warning or deprecation evidence found.")}

## Evidence and source docs

${agentMap.pages.map((page) => `- ${page.title}: ${sourceReference(page)}`).join("\n")}
`;
}

function renderTaskPack(pack: TaskPack, agentMap: AgentMap): string {
  return `# Task: ${pack.title}

Confidence: ${pack.confidence}${pack.confidence === "low" ? "\n\nEvidence is weak. Requires manual review." : ""}

## When to use this

${pack.description}

## Required context

${pack.requiredPages.map((pageId) => `- ${pageTitle(agentMap, pageId)}: ${sourceReference(agentMap.pages.find((page) => page.id === pageId)!)}`).join("\n")}

## Steps

${pack.steps.map((step, index) => `${index + 1}. **${step.title}**: ${oneLine(step.description)}`).join("\n")}

## Code examples

${pack.codeExamples.length === 0 ? "No canonical code examples found." : pack.codeExamples.map((example) => `\`\`\`text\n${example}\n\`\`\``).join("\n\n")}

## Gotchas

${linesOrFallback(pack.gotchas.map((gotcha) => `- ${gotcha.severity.toUpperCase()}: ${oneLine(gotcha.text)}`), "No warning or deprecation evidence found.")}

## Source evidence

${pack.evidence.map((item) => `- ${evidenceReference(item)}`).join("\n")}
`;
}

function sourceEntries(agentMap: AgentMap): Manifest["sources"] {
  const values = agentMap.pages.map((page) => ({
    type: page.sourceType,
    value: page.canonicalUrl ?? page.sourceUrl ?? page.repoPath ?? page.id,
  }));
  const unique = new Map(values.map((value) => [`${value.type}:${value.value}`, value]));
  return [...unique.values()].sort((left, right) => compareStrings(`${left.type}:${left.value}`, `${right.type}:${right.value}`));
}

function entityNames(agentMap: AgentMap, type: AgentMap["entities"][number]["type"]): string[] {
  return agentMap.entities.filter((entity) => entity.type === type).map((entity) => entity.name);
}

function projectDescription(agentMap: AgentMap): string {
  return agentMap.pages[0]?.description
    ?? `Documentation context compiled from ${agentMap.pages.length} source page(s).`;
}

function pageTitle(agentMap: AgentMap, pageId: string): string {
  return agentMap.pages.find((page) => page.id === pageId)?.title ?? pageId;
}

function sourceReference(page: AgentMap["pages"][number]): string {
  return page.canonicalUrl ?? page.sourceUrl ?? page.repoPath ?? page.id;
}

function evidenceReference(evidence: Evidence): string {
  const source = evidence.url ?? evidence.repoPath ?? evidence.pageId ?? "Unknown source";
  return evidence.headingId === undefined ? source : `${source} (${evidence.headingId})`;
}

function excerpt(value: string): string {
  const compact = oneLine(
    value
      .replace(/^#{1,6}\s+[^\n]+\s*/, "")
      .replace(/```[\s\S]*?```/g, "Code example available below.")
      .replace(/^>\s?/gm, ""),
  );
  const evidence = compact || oneLine(value) || "Evidence is weak. Requires manual review.";
  return evidence.length <= 240 ? evidence : `${evidence.slice(0, 237)}...`;
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function linesOrFallback(lines: string[], fallback: string): string {
  return lines.length === 0 ? fallback : lines.join("\n");
}

function stableEvidence(evidence: Evidence[]): Evidence[] {
  const unique = new Map(evidence.map((item) => [JSON.stringify(item), item]));
  return [...unique.values()].sort((left, right) => compareStrings(JSON.stringify(left), JSON.stringify(right)));
}

function stableUnique(values: string[]): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function validateTaskPackReferences(taskPacks: TaskPack[], agentMap: AgentMap): void {
  const pageIds = new Set(agentMap.pages.map((page) => page.id));
  const entityIds = new Set(agentMap.entities.map((entity) => entity.id));
  for (const pack of taskPacks) {
    for (const pageId of pack.requiredPages) {
      if (!pageIds.has(pageId)) {
        throw new Error(`Task pack ${pack.id} references missing page ${pageId}.`);
      }
    }
    for (const entityId of pack.relatedEntities) {
      if (!entityIds.has(entityId)) {
        throw new Error(`Task pack ${pack.id} references missing entity ${entityId}.`);
      }
    }
  }
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
