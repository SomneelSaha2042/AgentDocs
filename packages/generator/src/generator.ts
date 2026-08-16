import {
  AgentMapSchema,
  ManifestSchema,
  TaskPackSchema,
  type AgentMap,
  type Evidence,
  type Manifest,
  type SourceCoverage,
  type TaskCodeExample,
  type TaskPack,
  type Chunk,
  type CodeBlock,
  type DocPage,
  type DocumentationMap,
} from "@agentdocs/shared";
import { compileDocumentationMap } from "@agentdocs/navigator";

export type ProjectIdentity = {
  name: string;
  slug: string;
  version?: string;
};

export type GenerateStaticArtifactsOptions = {
  agentMap: AgentMap;
  linkTaskPacks?: boolean;
  project: ProjectIdentity;
  rules?: string[];
  preferredFacets?: Record<string, string>;
  exclusiveKeys?: string[];
  sourceCoverage?: SourceCoverage;
  tasks?: Array<{ id: string; title: string; queries: string[]; requiredFacets: Record<string, string> }>;
};

export type GeneratedStaticArtifacts = {
  agentsMd: string;
  agentMap: AgentMap;
  documentationMap: DocumentationMap;
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
  requiredFacets?: Record<string, string>;
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
    keywords: ["webhook", "webhook signature"],
  },
  {
    id: "pagination",
    title: "Pagination",
    description: "Implement pagination using available source evidence.",
    keywords: [
      "pagination", "paginate", "paginator", "cursor", "page size", "next page",
      "next token", "page token", "continuation token", "next cursor", "has more",
      "offset", "marker",
    ],
  },
  {
    id: "errors",
    title: "Errors and debugging",
    description: "Handle documented errors and debugging guidance.",
    keywords: ["error", "debug", "troubleshoot", "failure", "retry", "retries"],
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
  {
    id: "api-usage",
    title: "API usage",
    description: "Use documented APIs, routes, requests, responses, schemas, and update flows.",
    keywords: [
      "api usage", "endpoint", "route", "request", "response", "http",
      "schema", "validation", "validate", "mutation", "update", "invalidate", "invalidation",
    ],
  },
  {
    id: "testing",
    title: "Testing",
    description: "Test documented behavior using source-backed commands and examples.",
    keywords: ["testing", "unit test", "integration test", "test command", "assert", "mock"],
  },
];

type TaskShapeSignal = {
  families: string[];
  label: string;
  bonus: number;
  match: (ctx: {
    text: string;
    headingPath: string[];
    pageTitle: string;
    codeBlocks: CodeBlock[];
  }) => boolean;
};

type ScoredCodeExample = {
  evidence: Evidence[];
  implementationEvidence: boolean;
  language?: string;
  relevance: number;
  source: "chunk" | "sibling";
  value: string;
};

type TaskPackDiagnostics = {
  codeEvidenceStatus: string;
  contextConflicts: string[];
  selectedEvidence: string[];
  weakEvidenceReason?: string;
};

type GeneratedTaskPack = {
  diagnostics: TaskPackDiagnostics;
  pack: TaskPack;
};

const TASK_SHAPE_SIGNALS: TaskShapeSignal[] = [
  {
    families: ["api-usage", "webhooks"],
    label: "HTTP route or endpoint evidence",
    bonus: 5,
    match: ({ text, headingPath, pageTitle, codeBlocks }) => {
      const heading = `${pageTitle} ${headingPath.join(" ")}`.toLowerCase();
      const body = text.toLowerCase();
      const hasRouteTerm = /\b(?:route|handler|router|endpoint|api|http|request|response)\b/i.test(heading)
        || /\b(?:route|handler|router|endpoint|api|http|request|response)\b/i.test(body);
      if (!hasRouteTerm) return false;
      return codeBlocks.some((block) => {
        const routes = block.extracted?.httpRoutes ?? [];
        const val = block.value.toLowerCase();
        return routes.length > 0
          || /\b(?:get|post|put|patch|delete|head|options)\s*\(/i.test(val)
          || /\.\s*(?:get|post|put|patch|delete|head|options)\s*\(/i.test(val)
          || /\b(?:get|post|put|patch|delete|head|options)\s+\/[\w./:*-]*/i.test(val);
      });
    },
  },
  {
    families: ["api-usage", "configuration", "testing"],
    label: "Request/response or schema evidence",
    bonus: 3,
    match: ({ text, headingPath, pageTitle, codeBlocks }) => {
      const value = `${pageTitle} ${headingPath.join(" ")} ${text}`.toLowerCase();
      const hasSchemaOrIo = /\b(?:request|response|body|payload|schema|json|validate|validation|validator)\b/i.test(value);
      if (!hasSchemaOrIo) return false;
      return codeBlocks.length > 0 || /\b(?:create|build|implement|use|call|send|return|verify|test)\b/i.test(value);
    },
  },
  {
    families: ["api-usage"],
    label: "Mutation or update flow evidence",
    bonus: 3,
    match: ({ text, codeBlocks }) => {
      const value = `${text}\n${codeBlocks.map((block) => block.value).join("\n")}`;
      return /\b(?:mutation|mutate|update|invalidate|refresh|refetch|write|delete|create)\b/i.test(value)
        && /\b(?:after|then|when|on success|success|complete|call|use)\b/i.test(value);
    },
  },
  {
    families: [],
    label: "Basic usage example",
    bonus: 3,
    match: ({ headingPath, codeBlocks }) => {
      if (codeBlocks.length === 0) return false;
      const heading = headingPath.join(" ").toLowerCase();
      const isAdvanced = /\b(?:compiler|custom|internal|advanced|migration|type\s*provider|extending|deprecated)\b/i.test(heading);
      return !isAdvanced;
    },
  },
  {
    families: ["pagination"],
    label: "Pagination loop",
    bonus: 4,
    match: ({ text }) => {
      const body = text.toLowerCase();
      const loopMatch = /\b(?:do|while|for\s+await|for)\b/i.test(body);
      if (!loopMatch) return false;
      return /\b(?:next|cursor|token|page|marker|offset|hasMore|paginator)\b/i.test(body);
    },
  },
  {
    families: ["authentication", "quickstart", "api-usage"],
    label: "Auth initialization",
    bonus: 4,
    match: ({ codeBlocks }) => {
      return codeBlocks.some((block) => {
        const val = block.value;
        return /\b(?:new\s+\w*Client|createClient|from)\(/i.test(val);
      });
    },
  },
  {
    families: ["webhooks"],
    label: "Webhook signature",
    bonus: 4,
    match: ({ text, codeBlocks }) => {
      const body = text.toLowerCase();
      const hasSignature = /\b(?:signature|verify|signing|header)\b/i.test(body);
      return hasSignature && codeBlocks.length > 0;
    },
  },
  {
    families: ["installation", "quickstart", "api-usage"],
    label: "Install + import",
    bonus: 3,
    match: ({ text, codeBlocks }) => {
      const body = text.toLowerCase();
      const hasInstall = /(?:npm\s+install|npm\s+i|pnpm\s+add|yarn\s+add|bun\s+add|pip\s+install|cargo\s+add|go\s+get)/i.test(body);
      const hasImport = /\b(?:import|require)\b/i.test(body) || codeBlocks.some((block) => /\b(?:import|require)\b/i.test(block.value));
      return hasInstall && hasImport;
    },
  },
  {
    families: [],
    label: "Advanced/internal penalty",
    bonus: -4,
    match: ({ headingPath }) => {
      const heading = headingPath.join(" ").toLowerCase();
      return /\b(?:compiler|custom|internal|advanced|migration|type\s*provider|extending)\b/i.test(heading);
    },
  },
];

export function generateStaticArtifacts(
  options: GenerateStaticArtifactsOptions,
): GeneratedStaticArtifacts {
  const inputMap = AgentMapSchema.parse(options.agentMap);
  const families = [...TASK_FAMILIES, ...(options.tasks ?? []).map((task) => ({
    id: task.id,
    title: task.title,
    description: `Complete ${task.title} using source-backed evidence.`,
    keywords: task.queries,
    requiredFacets: task.requiredFacets,
  }))];
  const generatedTaskPacks = families
    .map((family) => generateTaskPack(
      family,
      inputMap,
      options.preferredFacets ?? {},
      options.exclusiveKeys ?? [],
    ))
    .filter((pack): pack is GeneratedTaskPack => pack !== undefined)
    .sort((left, right) => compareStrings(left.pack.id, right.pack.id));
  const taskPacks = generatedTaskPacks.map(({ pack }) => pack);
  const diagnosticsByTask = new Map(generatedTaskPacks.map(({ pack, diagnostics }) => [pack.id, diagnostics]));
  validateTaskPackReferences(taskPacks, inputMap);
  const agentMap = AgentMapSchema.parse({ ...inputMap, taskPacks });
  const documentationMap = compileDocumentationMap({ agentMap });
  const manifest = ManifestSchema.parse({
    schemaVersion: "0.2.0",
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
    sourceCoverage: options.sourceCoverage,
  });
  const taskPackMarkdown = Object.fromEntries(
    taskPacks.map((pack) => [pack.id, renderTaskPack(pack, agentMap, diagnosticsByTask.get(pack.id))]),
  );
  const linkedTaskPacks = options.linkTaskPacks === false ? [] : taskPacks;
  const contextRules = Object.entries(options.preferredFacets ?? {})
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([key, value]) => `Preferred context: ${key}=${value}.`);
  return {
    agentsMd: renderAgentsMd(options.project, agentMap, linkedTaskPacks, [...contextRules, ...(options.rules ?? [])]),
    agentMap,
    documentationMap,
    llmsTxt: renderLlmsTxt(options.project, agentMap, linkedTaskPacks, [...contextRules, ...(options.rules ?? [])]),
    manifest,
    taskPackMarkdown,
    taskPacks,
  };
}

function generateTaskPack(
  family: TaskFamily,
  agentMap: AgentMap,
  preferredFacets: Record<string, string>,
  exclusiveKeys: string[],
): GeneratedTaskPack | undefined {
  const requestedFacets = {
    ...preferredFacets,
    ...(family.requiredFacets ?? {}),
  };
  const candidates = agentMap.chunks
    .map((chunk) => {
      const score = taskScore(
        family,
        chunk.text,
        chunk.headingPath,
        pageTitle(agentMap, chunk.pageId),
      );
      const shapeScore = taskShapeScore(family, chunk, agentMap);
      return {
        chunk,
        score,
        shapeScore,
        shapeLabels: taskShapeLabels(family, chunk, agentMap),
        facetScore: facetSelectionScore(chunk.facets, requestedFacets),
      };
    })
    .filter(({ score }) => score > 0)
    .filter(({ chunk }) => contextCompatible(chunk.facets, requestedFacets, exclusiveKeys))
    .sort((left, right) =>
      right.facetScore - left.facetScore
      || (right.score + right.shapeScore) - (left.score + left.shapeScore)
      || compareStrings(left.chunk.id, right.chunk.id));
  const anchoredFacets = anchorExclusiveFacets(
    candidates[0]?.chunk.facets ?? [],
    requestedFacets,
    exclusiveKeys,
  );
  const ranked = diversifyTaskChunks(
    candidates.filter(({ chunk }) => contextCompatible(chunk.facets, anchoredFacets, exclusiveKeys)),
    5,
  );
  if (ranked.length === 0) {
    return undefined;
  }
  const strongest = ranked[0]!.score + ranked[0]!.shapeScore;
  const strongTaskEvidence = hasStrongTaskEvidence(family, ranked.map(({ chunk }) => chunk.text));
  if (strongest < 3 && !strongTaskEvidence) {
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
  const topChunkHeadingPath = ranked[0]?.chunk.headingPath ?? [];
  const scoredExamples = ranked.flatMap<ScoredCodeExample>(({ chunk }) => {
    const page = agentMap.pages.find((candidate) => candidate.id === chunk.pageId);
    if (page === undefined) return [];
    
    const codeBlocks = getChunkCodeBlocks(agentMap, chunk);
    if (codeBlocks.length > 0) {
      return codeBlocks.map<ScoredCodeExample>((block) => ({
        evidence: [evidenceForCodeBlock(page, block)],
        language: block.language,
        value: block.value,
        relevance: codeBlockRelevance(block, page, family, topChunkHeadingPath),
        implementationEvidence: codeBlockImplementationScore(block, family) > 0,
        source: "chunk",
      }));
    }

    return getSiblingHeadingCodeBlocks(agentMap, chunk).map<ScoredCodeExample>((block) => ({
      evidence: [evidenceForCodeBlock(page, block)],
      language: block.language,
      value: block.value,
      relevance: codeBlockRelevance(block, page, family),
      implementationEvidence: codeBlockImplementationScore(block, family) > 0,
      source: "sibling",
    }));
  });

  const selectedExamples = scoredExamples
    .filter((ex) => ex.source === "chunk" ? ex.relevance >= -2 : ex.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance);
  const codeExamples: TaskCodeExample[] = stableUniqueInOrder(
    selectedExamples.map((ex) => ex.value),
  ).slice(0, 4).map((value) => {
    const selected = selectedExamples.find((example) => example.value === value)!;
    return {
      language: selected.language,
      value,
      evidence: selected.evidence,
    };
  });

  const context = taskContext(ranked.map(({ chunk }) => chunk.facets), exclusiveKeys);
  const hasImplementationEvidence = ranked.some((candidate) => candidate.shapeScore > 0)
    || selectedExamples.some((example) => example.implementationEvidence);
  const hasImplementationProse = ranked.some(({ chunk }) => hasImplementationShapedProse(chunk.text));
  const hasCodeOrCommandEvidence = selectedExamples.some((example) => example.implementationEvidence)
    || codeExamples.some((example) => hasCommandOrCodeEvidence(example.value));
  const baseConfidence = strongest >= 6 && requiredPages.length >= 2 && hasImplementationEvidence && hasImplementationProse && hasCodeOrCommandEvidence
    ? "high"
    : strongest >= 4 || strongTaskEvidence || (strongest >= 3 && codeExamples.length > 0)
      ? "medium"
      : "low";
  const confidence = context.conflicts.length > 0 && baseConfidence === "high" ? "medium" : baseConfidence;
  const pack = TaskPackSchema.parse({
    id: family.id,
    title: family.title,
    description: family.description,
    confidence,
    requiredPages,
    relatedEntities,
    steps,
    gotchas,
    codeExamples,
    evidence,
    context,
  });
  return {
    pack,
    diagnostics: {
      selectedEvidence: stableUniqueInOrder(ranked.flatMap((candidate) => candidate.shapeLabels)).slice(0, 6),
      codeEvidenceStatus: codeExamples.length === 0
        ? "No relevant code or command evidence selected."
        : hasCodeOrCommandEvidence
          ? `Selected ${codeExamples.length} relevant code/command example(s).`
          : `Selected ${codeExamples.length} example(s), but none proved implementation commands or API usage.`,
      weakEvidenceReason: confidence === "high"
        ? undefined
        : weakEvidenceReason({
            codeExamples,
            contextConflicts: context.conflicts.length,
            hasCodeOrCommandEvidence,
            hasImplementationEvidence,
            hasImplementationProse,
            requiredPages: requiredPages.length,
            strongest,
          }),
      contextConflicts: context.conflicts.map((conflict) => `${conflict.key}=${conflict.values.join("|")}`),
    },
  };
}

function facetSelectionScore(
  facets: AgentMap["chunks"][number]["facets"],
  preferred: Record<string, string>,
): number {
  return Object.entries(preferred).reduce((score, [key, value]) =>
    score + (facets.some((facet) => facet.key === key && facet.value === value) ? 10 : 0), 0);
}

function anchorExclusiveFacets(
  facets: AgentMap["chunks"][number]["facets"],
  requested: Record<string, string>,
  exclusiveKeys: string[],
): Record<string, string> {
  const anchored = { ...requested };
  for (const key of exclusiveKeys) {
    if (anchored[key] !== undefined) continue;
    const values = stableUnique(facets.filter((facet) => facet.key === key).map((facet) => facet.value));
    if (values.length === 1) anchored[key] = values[0]!;
  }
  return anchored;
}

function contextCompatible(
  facets: AgentMap["chunks"][number]["facets"],
  requested: Record<string, string>,
  exclusiveKeys: string[],
): boolean {
  return exclusiveKeys.every((key) => {
    const expected = requested[key];
    const values = stableUnique(facets.filter((facet) => facet.key === key).map((facet) => facet.value));
    return expected === undefined || values.length === 0 || values.every((value) => value === expected);
  });
}

function taskContext(
  groups: Array<AgentMap["chunks"][number]["facets"]>,
  exclusiveKeys: string[],
): TaskPack["context"] {
  const facets = groups.flat();
  const values = Object.fromEntries(stableUnique(facets.map((facet) => facet.key)).map((key) => [
    key,
    stableUnique(facets.filter((facet) => facet.key === key).map((facet) => facet.value)),
  ]));
  const conflicts = exclusiveKeys.flatMap((key) => {
    const keyValues = values[key] ?? [];
    return keyValues.length < 2 ? [] : [{
      key,
      values: keyValues,
      evidence: stableEvidence(facets.filter((facet) => facet.key === key).flatMap((facet) => facet.evidence)),
    }];
  });
  return { facets: values, conflicts };
}

function diversifyTaskChunks<T extends { chunk: { id: string; pageId: string } }>(
  candidates: T[],
  limit: number,
): T[] {
  const selected: T[] = [];
  const pages = new Set<string>();
  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    if (!pages.has(candidate.chunk.pageId)) {
      selected.push(candidate);
      pages.add(candidate.chunk.pageId);
    }
  }
  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    if (!selected.some(({ chunk }) => chunk.id === candidate.chunk.id)) selected.push(candidate);
  }
  return selected;
}

function hasStrongTaskEvidence(family: TaskFamily, texts: string[]): boolean {
  return texts.some((text) =>
    (family.id === "installation"
      && /(?:npm\s+(?:install|i)|yarn\s+add|pnpm\s+add|bun\s+add|pip(?:3)?\s+install|python\s+-m\s+pip\s+install|cargo\s+add|go\s+get)\b/i.test(text))
    || (family.id === "quickstart" && /\bnpm\s+create\b/i.test(text)),
  );
}

function taskScore(
  family: TaskFamily,
  text: string,
  headingPath: string[],
  title: string,
): number {
  const heading = `${title} ${headingPath.join(" ")}`.toLowerCase();
  const body = text.toLowerCase();
  return family.keywords.reduce((score, keyword) => {
    const normalized = keyword.toLowerCase();
    const specificity = Math.max(1, Math.floor(normalized.length / 5));
    return score + (
      containsKeyword(heading, normalized) ? 3 * specificity :
      containsKeyword(body, normalized) ? 1 * specificity : 0
    );
  }, 0);
}

function containsKeyword(value: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefix = /^[a-z0-9]/i.test(keyword) ? "(?<![a-z0-9])" : "";
  const suffix = /[a-z0-9]$/i.test(keyword) ? "(?![a-z0-9])" : "";
  return new RegExp(`${prefix}${escaped}${suffix}`, "i").test(value);
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

function evidenceForCodeBlock(page: DocPage, block: CodeBlock): Evidence {
  return {
    source: "code_block",
    pageId: page.id,
    headingId: block.sourceHeadingId,
    codeBlockId: block.id,
    url: page.canonicalUrl ?? page.sourceUrl,
    repoPath: page.repoPath,
    quote: block.value,
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
- Documentation map: documentation-map.json
- Chunks: chunks.jsonl
`;
}

function renderAgentsMd(
  project: ProjectIdentity,
  agentMap: AgentMap,
  taskPacks: TaskPack[],
  rules: string[],
): string {
  const packages = entityNames(agentMap, "package").filter(isLikelyPackageName).slice(0, 20);
  const versions = entityNames(agentMap, "version").filter(isLikelyVersionHint).slice(0, 12);
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

## Guidelines for coding agents

- **Traverse before implementing**: Start at \`agentdocs://map\` with \`browse_docs\`. Follow collections, document sections, authored links, adjacent blocks, and entity occurrences according to the task.
- **Read selected evidence**: Pass exact page, section, block, or code refs from the map to \`read_docs\`. Keep following \`nextRef\` until the selected source is complete.
- **Use retrieval as an optional locator**: \`query_docs\`, \`search_docs\`, task packs, and readiness checks remain available as evidence-backed saved views and audit tools; they do not replace map traversal.
- **Coding & Implementation**: Implement and test only after reading the source evidence selected during traversal. Return to the map whenever the task needs more context.

## Evidence and source docs

${agentMap.pages.map((page) => `- ${page.title}: ${sourceReference(page)}`).join("\n")}
`;
}

function renderTaskPack(pack: TaskPack, agentMap: AgentMap, diagnostics?: TaskPackDiagnostics): string {
  return `# Task: ${pack.title}

Confidence: ${pack.confidence}${pack.confidence === "low" ? "\n\nEvidence is weak. Requires manual review." : ""}

## When to use this

${pack.description}

## Required context

${pack.requiredPages.map((pageId) => `- ${pageTitle(agentMap, pageId)}: ${sourceReference(agentMap.pages.find((page) => page.id === pageId)!)}`).join("\n")}

Context facets: ${Object.entries(pack.context.facets).map(([key, values]) => `${key}=${values.join("|")}`).join(", ") || "Unknown"}

${pack.context.conflicts.length === 0 ? "No exclusive context conflicts detected." : pack.context.conflicts.map((conflict) => `WARNING: Conflicting ${conflict.key} context: ${conflict.values.join(", ")}.`).join("\n")}

## Steps

${pack.steps.map((step, index) => `${index + 1}. **${step.title}**: ${oneLine(step.description)}`).join("\n")}

## Code examples

${pack.codeExamples.length === 0 ? "No canonical code examples found." : pack.codeExamples.map((example) => {
    const value = typeof example === "string" ? example : example.value;
    const language = typeof example === "string" ? "text" : example.language ?? "text";
    return `\`\`\`${language}\n${value}\n\`\`\``;
  }).join("\n\n")}

## Gotchas

${linesOrFallback(pack.gotchas.map((gotcha) => `- ${gotcha.severity.toUpperCase()}: ${oneLine(gotcha.text)}`), "No warning or deprecation evidence found.")}

## Source evidence

${pack.evidence.map((item) => `- ${evidenceReference(item)}`).join("\n")}

## Diagnostics

${renderTaskPackDiagnostics(diagnostics)}
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

function isLikelyPackageName(value: string): boolean {
  const normalized = value.replace(/[`,.;:)]+$/g, "");
  if (normalized !== value.trim()) return false;
  if (/^(?:and|for|from|install|needed|on|our|plugin|the|to|with)$/i.test(normalized)) return false;
  return /^(?:@[\w.-]+\/)?[\w.-]+(?:\/[\w.-]+)?$/.test(normalized)
    && /[a-z]/i.test(normalized)
    && normalized.length >= 2;
}

function isLikelyVersionHint(value: string): boolean {
  const normalized = value.trim();
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(normalized)) return false;
  return /^(?:v|version\s+)?\d+(?:\.\d+){0,3}(?:[-+][\w.-]+)?$/i.test(normalized)
    || /^[A-Z]?\d+$/.test(normalized);
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

function stableUniqueInOrder(values: string[]): string[] {
  return [...new Set(values)];
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

function getChunkCodeBlocks(agentMap: AgentMap, chunk: Chunk): CodeBlock[] {
  const page = agentMap.pages.find((p) => p.id === chunk.pageId);
  if (!page) return [];
  const headingText = chunk.headingPath.at(-1);
  const headings = page.headings.filter((h) => h.text === headingText);
  const chunkBlocks = page.codeBlocks.filter((block) =>
    block.value.trim().length > 0 && chunk.text.includes(block.value.trim()));
  if (chunkBlocks.length > 0) return chunkBlocks;
  if (!/^\s*(?:```|~~~)/m.test(chunk.text)) return [];
  if (headings.length === 1) {
    const headingId = headings[0]!.id;
    return page.codeBlocks.filter((b) => b.sourceHeadingId === headingId);
  }
  return page.codeBlocks.filter((b) => b.sourceHeadingId === undefined);
}

function getSiblingHeadingCodeBlocks(agentMap: AgentMap, chunk: Chunk): CodeBlock[] {
  const page = agentMap.pages.find((p) => p.id === chunk.pageId);
  if (!page) return [];
  return page.codeBlocks.filter((block) =>
    arraysEqual(headingPathFor(page, block.sourceHeadingId), chunk.headingPath));
}

function taskShapeLabels(family: TaskFamily, chunk: Chunk, agentMap: AgentMap): string[] {
  const page = agentMap.pages.find((p) => p.id === chunk.pageId);
  if (!page) return [];
  const codeBlocks = getChunkCodeBlocks(agentMap, chunk);
  return TASK_SHAPE_SIGNALS
    .filter((signal) => signal.families.length === 0 || signal.families.includes(family.id))
    .filter((signal) => signal.bonus > 0)
    .filter((signal) => signal.match({ text: chunk.text, headingPath: chunk.headingPath, pageTitle: page.title, codeBlocks }))
    .map((signal) => signal.label);
}

function taskShapeScore(family: TaskFamily, chunk: Chunk, agentMap: AgentMap): number {
  const page = agentMap.pages.find((p) => p.id === chunk.pageId);
  if (!page) return 0;
  
  const codeBlocks = getChunkCodeBlocks(agentMap, chunk);
  const pageTitleVal = page.title;
  
  let score = 0;
  for (const signal of TASK_SHAPE_SIGNALS) {
    if (signal.families.length > 0 && !signal.families.includes(family.id)) {
      continue;
    }
    if (signal.match({ text: chunk.text, headingPath: chunk.headingPath, pageTitle: pageTitleVal, codeBlocks })) {
      score += signal.bonus;
    }
  }
  return score;
}

function headingPathFor(page: DocPage, headingId?: string): string[] {
  if (headingId === undefined) return [];
  const index = page.headings.findIndex((heading) => heading.id === headingId);
  if (index < 0) return [];
  const target = page.headings[index]!;
  const parents = page.headings.slice(0, index).filter((heading) => heading.depth < target.depth).reverse();
  const path: string[] = [];
  let depth = target.depth;
  for (const parent of parents) {
    if (parent.depth < depth) {
      path.unshift(parent.text);
      depth = parent.depth;
    }
  }
  return [...path, target.text];
}

function isAdvancedHeading(headingPath: string[]): boolean {
  const joined = headingPath.join(" ").toLowerCase();
  return /\b(?:compiler|custom|internal|advanced|migration|type\s*provider|extending)\b/.test(joined);
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function codeBlockRelevance(
  block: CodeBlock,
  page: DocPage,
  family: TaskFamily,
  topChunkHeadingPath?: string[],
): number {
  let score = codeBlockImplementationScore(block, family);
  const headingPath = headingPathFor(page, block.sourceHeadingId);
  if (topChunkHeadingPath !== undefined && arraysEqual(headingPath, topChunkHeadingPath)) score += 6;
  
  const normalized = block.value.toLowerCase();
  score += family.keywords.filter((keyword) => containsKeyword(normalized, keyword.trim().toLowerCase())).length;
  
  if (isAdvancedHeading(headingPath)) score -= 4;
  return score;
}

function codeBlockImplementationScore(block: CodeBlock, family: TaskFamily): number {
  const normalized = block.value.toLowerCase();
  const extracted = block.extracted;
  const cliCommands = extracted?.cliCommands ?? [];
  const imports = extracted?.imports ?? [];
  const httpRoutes = extracted?.httpRoutes ?? [];
  const envVars = extracted?.envVars ?? [];
  let score = 0;

  if (family.id === "quickstart" || family.id === "authentication") {
    if (/\bnew\s+\w*client\b/i.test(block.value) || /\bcreate\w*client\b/i.test(block.value)) score += 4;
    if (/\b(?:api[_-]?key|token|credential|secret)\b/i.test(block.value)) score += 2;
  }

  if (family.id === "installation" || family.id === "quickstart") {
    const hasInstallCommand = cliCommands.some((command) =>
      /^(?:npm\s+(?:install|i)|yarn\s+add|pnpm\s+add|bun\s+add|pip(?:3)?\s+install|python\s+-m\s+pip\s+install|cargo\s+add|go\s+get)\b/i.test(command),
    );
    if (hasInstallCommand) score += 3;
    if (imports.length > 0 || /\b(?:import|require)\b/i.test(block.value)) score += 1;
  }

  if (family.id === "api-usage" || family.id === "webhooks") {
    const hasRoute = httpRoutes.length > 0
      || /\b(?:get|post|put|patch|delete|head|options)\s*\(/i.test(block.value)
      || /\.\s*(?:get|post|put|patch|delete|head|options)\s*\(/i.test(block.value)
      || /\b(?:get|post|put|patch|delete|head|options)\s+\/[\w./:*-]*/i.test(block.value);
    if (hasRoute) score += 3;
  }

  if (family.id === "api-usage" || family.id === "configuration" || family.id === "testing") {
    if (/\b(?:schema|json|body|payload|request|response|validate|validation|validator)\b/i.test(block.value)) score += 2;
  }

  if (family.id === "api-usage") {
    if (/\b(?:mutation|mutate|update|invalidate|refresh|refetch|write|delete|create)\b/i.test(block.value)) score += 2;
  }

  if (family.id === "pagination") {
    const hasLoop = /\b(?:do|while|for\s+await|for)\b/i.test(block.value);
    const hasPageTerm = /\b(?:next|cursor|token|page|marker|offset|hasmore|paginator)\b/i.test(normalized);
    if (hasLoop && hasPageTerm) score += 4;
  }

  if (family.id === "webhooks") {
    if (/\b(?:signature|verify|signing|header|hmac|secret)\b/i.test(block.value)) score += 4;
  }

  if (family.id === "configuration") {
    if (envVars.length > 0 || /\b(?:process\.env|config|configure|option)\b/i.test(block.value)) score += 3;
  }

  if (family.id === "testing") {
    if (/\b(?:test|expect|assert|mock|fixture|verify)\b/i.test(block.value)) score += 2;
  }

  return score;
}

function renderTaskPackDiagnostics(diagnostics: TaskPackDiagnostics | undefined): string {
  if (diagnostics === undefined) return "No generation diagnostics recorded.";
  return [
    diagnostics.selectedEvidence.length === 0
      ? "- Selected evidence signals: lexical task evidence only."
      : `- Selected evidence signals: ${diagnostics.selectedEvidence.join(", ")}.`,
    `- Code/command evidence: ${diagnostics.codeEvidenceStatus}`,
    diagnostics.weakEvidenceReason === undefined
      ? "- Weak evidence reason: none."
      : `- Weak evidence reason: ${diagnostics.weakEvidenceReason}`,
    diagnostics.contextConflicts.length === 0
      ? "- Context conflicts: none."
      : `- Context conflicts: ${diagnostics.contextConflicts.join(", ")}.`,
  ].join("\n");
}

function hasImplementationShapedProse(value: string): boolean {
  const prose = value.replace(/```[\s\S]*?```/g, " ");
  return /\b(?:create|build|implement|configure|install|use|call|send|return|handle|verify|test|deploy|migrate|update|paginate|authenticate)\b/i.test(prose);
}

function hasCommandOrCodeEvidence(value: string): boolean {
  return /\b(?:npm\s+(?:install|i)|yarn\s+add|pnpm\s+add|bun\s+add|pip(?:3)?\s+install|python\s+-m\s+pip\s+install|cargo\s+add|go\s+get)\b/i.test(value)
    || /\b(?:import|require|function|class|const|let|var|new\s+\w+|create\w*|await|return)\b/i.test(value)
    || /\b(?:get|post|put|patch|delete|head|options)\s*(?:\(|\/[\w./:*-]*)/i.test(value)
    || /\.\s*(?:get|post|put|patch|delete|head|options)\s*\(/i.test(value);
}

function weakEvidenceReason(options: {
  codeExamples: Array<{ value: string }>;
  contextConflicts: number;
  hasCodeOrCommandEvidence: boolean;
  hasImplementationEvidence: boolean;
  hasImplementationProse: boolean;
  requiredPages: number;
  strongest: number;
}): string {
  if (options.contextConflicts > 0) return "Context conflicts prevented high confidence.";
  if (!options.hasImplementationProse) return "Selected evidence is mostly conceptual rather than implementation-shaped.";
  if (!options.hasImplementationEvidence) return "No generic implementation evidence signal was selected.";
  if (!options.hasCodeOrCommandEvidence || options.codeExamples.length === 0) return "No relevant code or command evidence supported the task.";
  if (options.requiredPages < 2) return "Only one required source page supported the task.";
  return `Top evidence score ${options.strongest} did not satisfy the high-confidence threshold.`;
}
