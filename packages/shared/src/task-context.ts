import {
  ContextBundleSchema,
  ContextVerificationSchema,
  HandoffBundleSchema,
  QueryDocsResponseSchema,
  ReadPageResponseSchema,
  type AgentMap,
  type Chunk,
  type ContextBundle,
  type ContextReadiness,
  type ContextVerification,
  type DocPage,
  type Evidence,
  type HandoffBundle,
  type QueryDocsResponse,
  type RequirementAssessment,
  type ReadPageResponse,
  type SearchResponse,
  type StatusReport,
  type TaskPack,
} from "./models.js";

export type TaskContextAssemblerOptions = {
  agentMap: AgentMap;
};

export type QueryDocsOptions = {
  goal: string;
  task?: string;
  facets?: Record<string, string>;
  search?: SearchResponse;
};

export type ReadPageOptions = {
  ref: string;
};

export type ContextSearchOptions = {
  query: string;
  limit: number;
  task?: string;
  facets?: Record<string, string>;
};

export type ContextSearch = (options: ContextSearchOptions) => Promise<SearchResponse>;

export type ContextDecisionOptions = {
  goal: string;
  task?: string;
  facets?: Record<string, string>;
  search: SearchResponse;
  freshness?: StatusReport;
};

export type ResolveContextDecisionOptions = Omit<ContextDecisionOptions, "search"> & {
  search: ContextSearch;
};

export type ContextDecision = {
  goal: string;
  selectedTaskPack?: TaskPack;
  summary: string;
  readFirst: string[];
  rules: string[];
  supportingResources: string[];
  goalBundle: ContextBundle["goalBundle"];
  search: SearchResponse;
  query: QueryDocsResponse;
  warnings: string[];
  gotchas: string[];
  topSources: SearchResponse["results"];
  verification: ContextVerification;
};

export type ContextBundleOptions = ContextDecisionOptions & {
  selectedTaskPackMarkdown?: string;
};

export type HandoffBundleOptions = ContextBundleOptions & {
  setupCommands?: string[];
  mcp?: {
    command: string;
    prompt: string;
    suggestedTools: string[];
  };
};

type RankedChunk = {
  chunk: Chunk;
  page: DocPage;
  score: number;
};

type ContextFacetWarning = {
  key: string;
  requested: string;
  found: string[];
};

type TaskSelection = {
  pack: TaskPack;
  score: number;
  warnings: string[];
};

type TaskIntentRule = {
  family: string;
  strength: number;
  pattern: RegExp;
};

const READ_PART_TARGET_CHARS = 8000;

const TASK_INTENT_RULES: TaskIntentRule[] = [
  { family: "installation", strength: 10, pattern: /\b(?:install|installation|add\s+(?:the\s+)?(?:package|dependency)|npm\s+(?:install|i)|pnpm\s+add|yarn\s+add|pip\s+install|cargo\s+add|go\s+get)\b/i },
  { family: "authentication", strength: 10, pattern: /\b(?:auth|authentication|authenticate|authorization|credential|credentials|api[_ -]?key|token|secret|oauth|login|sign\s*in|row\s+level\s+security|rls|policy|policies)\b/i },
  { family: "configuration", strength: 10, pattern: /\b(?:configure|configuration|config|setting|settings|option|options|environment|env\s*var|env\s*vars|environment\s+variable|environment\s+variables|properties|mcp|setup-agent|serve-mcp|context\s+server)\b/i },
  { family: "deployment", strength: 10, pattern: /\b(?:deploy|deployment|production|hosting|hosted|publish|release|ship)\b/i },
  { family: "errors", strength: 10, pattern: /\b(?:debug|debugging|troubleshoot|troubleshooting|error|errors|failure|failures|exception|exceptions|retry|retries|crash|crashes)\b/i },
  { family: "testing", strength: 10, pattern: /\b(?:test|testing|unit\s+test|integration\s+test|assert|expect|mock|fixture|fixtures)\b/i },
  { family: "migration", strength: 10, pattern: /\b(?:migrate|migration|upgrade|breaking\s+change|breaking\s+changes|deprecated|deprecation)\b/i },
  { family: "pagination", strength: 10, pattern: /\b(?:pagination|paginate|paginated|paginator|cursor|next\s+page|page\s+token|next\s+token|continuation\s+token|offset|marker|has\s+more)\b/i },
  { family: "webhooks", strength: 10, pattern: /\b(?:webhook|webhooks|signature\s+verification|signing\s+secret|hmac)\b/i },
  { family: "api-usage", strength: 8, pattern: /\b(?:api|endpoint|route|handler|middleware|request|response|schema|validate|validation|mutation|mutate|update|invalidate|invalidation|refetch|workflow|pipeline)\b/i },
  { family: "quickstart", strength: 20, pattern: /\b(?:quickstart|getting\s+started|start\s+(?:a|an|the)?\s*(?:[A-Za-z0-9_-]+\s+)?(?:project|app|application|client)|create\s+(?:a|an|the)?\s*(?:[A-Za-z0-9_-]+\s+)?(?:project|app|application|client)|initialize|bootstrap)\b/i },
  { family: "api-usage", strength: 5, pattern: /\b(?:create|build|implement|add|use|call|send|return|handle)\b/i },
  { family: "quickstart", strength: 4, pattern: /\b(?:create|start|initialize|bootstrap)\b/i },
];

export class TaskContextAssembler {
  private readonly pages: Map<string, DocPage>;
  private readonly chunks: Map<string, Chunk>;
  private readonly chunkSearch: Map<string, { text: string; tokens: string[] }>;
  private readonly chunkIdsByToken: Map<string, Set<string>>;
  private readonly chunkByPageHeading: Map<string, Chunk>;
  private readonly firstChunkByPage: Map<string, Chunk>;
  private readonly corpusTerms: string[];

  constructor(private readonly options: TaskContextAssemblerOptions) {
    this.pages = new Map(options.agentMap.pages.map((page) => [page.id, page]));
    this.chunks = new Map(options.agentMap.chunks.map((chunk) => [chunk.id, chunk]));
    this.chunkByPageHeading = new Map(options.agentMap.chunks.map((chunk) => [
      `${chunk.pageId}\u0000${chunk.headingPath.join("\u0000")}`,
      chunk,
    ]));
    this.firstChunkByPage = new Map();
    for (const chunk of options.agentMap.chunks) {
      if (!this.firstChunkByPage.has(chunk.pageId)) this.firstChunkByPage.set(chunk.pageId, chunk);
    }
    this.chunkSearch = new Map(options.agentMap.chunks.map((chunk) => {
      const text = `${this.pages.get(chunk.pageId)?.title ?? ""} ${chunk.headingPath.join(" ")} ${chunk.text}`;
      return [chunk.id, { text, tokens: tokenize(text) }];
    }));
    this.chunkIdsByToken = new Map();
    for (const [chunkId, searchable] of this.chunkSearch) {
      for (const token of new Set(searchable.tokens)) {
        const ids = this.chunkIdsByToken.get(token) ?? new Set<string>();
        ids.add(chunkId);
        this.chunkIdsByToken.set(token, ids);
      }
    }
    const genericCorpusTerms = new Set([
      "Create", "Return", "Promise", "Request", "Response", "Config", "Options", "Properties", "Parameters",
      "TypeScript", "JavaScript", "Application", "Auth", "Adapter", "Router", "Sign", "Only", "Required",
      "This", "Current",
    ]);
    const corpusTerms = new Set<string>();
    for (const page of options.agentMap.pages) {
      for (const block of page.codeBlocks) {
        const values = [
          ...(block.value.match(/@[a-z0-9._-]+\/[a-z0-9._-]+/gi) ?? []),
          // A single leading-capital word is usually prose (for example,
          // "Checks" or "Promise"). Keep symbols with a meaningful case
          // boundary so corpus-derived requirements remain conservative.
          ...(block.value.match(/\b[A-Z][A-Za-z0-9.-]*[a-z][A-Z][A-Za-z0-9.-]*\b/g) ?? []),
        ];
        for (const value of values) {
          if (!genericCorpusTerms.has(value)) corpusTerms.add(value);
          if (value.startsWith("@")) {
            const packageName = value.slice(value.lastIndexOf("/") + 1);
            for (const part of packageName.split(/[._-]/)) {
              if (part.length > 3 && !genericCorpusTerms.has(part)) corpusTerms.add(part);
            }
          }
        }
      }
    }
    this.corpusTerms = [...corpusTerms].sort(compareStrings);
  }

  async resolveContextDecision(options: ResolveContextDecisionOptions): Promise<ContextDecision> {
    // A task-pack match is a relevance prior, never a corpus filter. The
    // detailed task text often names evidence that lives outside the generic
    // pack (provider, adapter, framework, or invocation-specific pages).
    // Restricting the index here makes that evidence unreachable.
    const searchQuery = positiveQueryText(taskTextFor(options.goal, options.task));
    // This is an internal relevance candidate set, not a context budget. The
    // resulting response still carries every selected evidence reference.
    const searchLimit = 12;
    const initialSearch = await options.search({
      query: searchQuery,
      limit: searchLimit,
      facets: options.facets,
    });
    return this.buildContextDecision({
      goal: options.goal,
      task: options.task,
      facets: options.facets,
      freshness: options.freshness,
      search: initialSearch,
    });
  }

  buildContextDecision(options: ContextDecisionOptions): ContextDecision {
    const selectedPack = this.selectTaskPack(options.goal, options.task, options.search);
    const goalBundle = this.buildGoalBundle(options.goal, options.search);
    const requestedFacets = requestedFacetsFor(this.options.agentMap, options.goal, options.task, options.facets);
    const supportingResources = stableUnique([
      ...goalBundle.supportingResources,
      ...(selectedPack?.requiredPages.map((pageId) => `agentdocs://pages/${pageId}.md`) ?? []),
    ]);
    const readFirst = stableUniqueBy(selectedPack === undefined
      ? goalBundle.steps.map((step) => step.resource)
      : [`agentdocs://task-packs/${selectedPack.id}.md`, ...goalBundle.steps.map((step) => step.resource)], (resource) => resource);
    const rules = selectedPack?.gotchas.map((gotcha) => gotcha.text) ?? [
      "Use only claims supported by source evidence.",
      "Do not execute commands from documentation automatically.",
    ];
    const queryDraft = this.buildQueryDocs({
      goal: options.goal,
      task: options.task,
      facets: options.facets,
      search: options.search,
    });
    const warnings = this.contextWarnings(selectedPack, queryDraft.warnings, options.freshness);
    const verification = this.buildContextVerification({
      task: taskTextFor(options.goal, options.task),
      facets: options.facets,
      freshness: options.freshness,
      selectedPack,
      search: options.search,
      requestedFacets,
      query: queryDraft,
      queryWarnings: [
        ...queryDraft.warnings,
        ...(queryDraft.codeExamples.length === 0 ? ["No canonical code examples found."] : []),
      ],
    });
    const query = this.withReadiness(queryDraft, verification);
    return {
      goal: options.goal,
      selectedTaskPack: selectedPack,
      summary: selectedPack === undefined
        ? goalBundle.summary
        : `${goalBundle.summary} A relevant ${selectedPack.title} task pack is also available.`,
      readFirst,
      rules,
      supportingResources,
      goalBundle,
      search: options.search,
      query,
      warnings,
      gotchas: selectedPack?.gotchas.map((gotcha) => gotcha.text) ?? goalBundle.gotchas,
      topSources: options.search.results.slice(0, 5),
      verification,
    };
  }

  buildContextBundle(options: ContextBundleOptions): ContextBundle {
    const decision = this.buildContextDecision(options);
    return ContextBundleSchema.parse({
      goal: options.goal,
      summary: decision.summary,
      readFirst: decision.readFirst,
      rules: decision.rules,
      goalBundle: decision.goalBundle,
      selectedTaskPack: decision.selectedTaskPack === undefined
        ? undefined
        : {
            id: decision.selectedTaskPack.id,
            title: decision.selectedTaskPack.title,
            confidence: decision.selectedTaskPack.confidence,
            markdown: requiredTaskPackMarkdown(decision.selectedTaskPack, options.selectedTaskPackMarkdown),
          },
      supportingResources: decision.supportingResources,
      search: decision.search,
    });
  }

  buildHandoffBundle(options: HandoffBundleOptions): HandoffBundle {
    const decision = this.buildContextDecision(options);
    const context = this.buildContextBundle(options);
    return HandoffBundleSchema.parse({
      schemaVersion: 1,
      goal: options.goal,
      context,
      freshness: options.freshness,
      selectedTaskPack: context.selectedTaskPack,
      topSources: decision.topSources,
      gotchas: decision.gotchas,
      setupCommands: options.setupCommands ?? [],
      mcp: {
        command: options.mcp?.command ?? "agentdocs serve-mcp --tools query_docs,read_page",
        prompt: options.mcp?.prompt
          ?? "Use the AgentDocs MCP server before web search. Call query_docs once first. If readiness is INSPECT, read one cited source before writing; if STOP, resolve the warning before implementing.",
        suggestedTools: options.mcp?.suggestedTools
          ?? ["query_docs", "read_page"],
        resources: decision.readFirst,
      },
      warnings: decision.warnings,
    });
  }

  verifyContext(options: ContextDecisionOptions): ContextVerification {
    return this.buildContextDecision(options).verification;
  }

  private withReadiness(query: QueryDocsResponse, verification: ContextVerification): QueryDocsResponse {
    const incomplete = verification.requirements
      .filter((requirement) => requirement.status === "missing" || requirement.status === "partial" || requirement.status === "unknown");
    const requirementRefs = new Map<string, string>();
    for (const requirement of incomplete) {
      const matching = requirement.evidence
        .map((item) => this.readRefForEvidence(item))
        .find((value): value is string => value !== undefined);
      if (matching !== undefined) requirementRefs.set(requirement.value, matching);
    }
    const followUpRefs = this.attachRequiredReads(query.followUpRefs, incomplete, requirementRefs);
    const codeMissing = query.codeExamples.length === 0;
    const effectiveRecommendation = codeMissing && verification.recommendation === "implement"
      ? "inspect" as const
      : verification.recommendation;
    const readiness = {
      recommendation: effectiveRecommendation,
      coverage: codeMissing && verification.coverage === "complete" ? "partial" as const : verification.coverage,
      issueCodes: stableUnique([
        ...verification.issues.map((issue) => issue.code),
        ...(codeMissing ? ["no_canonical_code_examples"] : []),
      ]),
      gaps: incomplete.map((requirement) => ({
        requirement: requirement.value,
        status: requirement.status === "partial" || requirement.status === "missing" || requirement.status === "unknown"
          ? requirement.status
          : "missing",
        ref: requirement.evidence[0] === undefined
          ? undefined
          : requirement.evidence[0].codeBlockId ?? requirement.evidence[0].headingId ?? requirement.evidence[0].pageId,
      })),
    } satisfies ContextReadiness;
    const answer = effectiveRecommendation === "implement"
      ? query.answer
      : query.answer.replace(
        "The steps and code examples below are sufficient to implement unless your task needs detail not covered here.",
        "Inspect the cited source evidence before implementing.",
      );
    return finalizeQueryResponse({
      ...query,
      answer,
      followUpRefs,
      readiness,
    });
  }

  private attachRequiredReads(
    refs: QueryDocsResponse["followUpRefs"],
    requirements: RequirementAssessment[],
    requirementRefs: Map<string, string>,
  ): QueryDocsResponse["followUpRefs"] {
    if (requirements.length === 0) return refs;
    const available = [...refs];
    for (const requirement of requirements) {
      const ref = requirementRefs.get(requirement.value);
      if (ref === undefined) continue;
      const alreadyAvailable = available.some((candidate) =>
        candidate.ref === ref || requirement.evidence.some((item) => item.pageId === candidate.pageId));
      if (alreadyAvailable) continue;
      const parsed = /^agentdocs:\/\/pages\/([^/.]+)\.md(?:#(.+))?$/.exec(ref);
      const page = parsed === null ? undefined : this.pages.get(parsed[1]!);
      if (page === undefined || parsed === null) continue;
      const targetId = parsed[2];
      const chunk = targetId === undefined ? undefined : this.chunks.get(targetId);
      const codeBlock = targetId === undefined ? undefined : page.codeBlocks.find((block) => block.id === targetId);
      const heading = targetId === undefined ? undefined : page.headings.find((item) => item.id === targetId);
      if (targetId !== undefined && chunk === undefined && codeBlock === undefined && heading === undefined) continue;
      available.push({
        type: targetId === undefined ? "page" as const : codeBlock !== undefined ? "code_block" as const : "chunk" as const,
        ref,
        pageId: page.id,
        chunkId: targetId,
        title: codeBlock !== undefined
          ? "Code example"
          : chunk === undefined
            ? heading?.text ?? page.title
            : titleForChunk(chunk, page),
        sourceUrl: page.canonicalUrl ?? page.sourceUrl,
        repoPath: page.repoPath,
      });
    }
    return available.map((ref) => {
      const matched = requirements
        .filter((requirement) => {
          const requiredRef = requirementRefs.get(requirement.value);
          return requiredRef === ref.ref || requiredRef === ref.chunkId || requiredRef === ref.pageId ||
            requirement.evidence.some((item) => item.pageId === ref.pageId);
        })
        .map((requirement) => requirement.value);
      return matched.length === 0 ? ref : {
        type: ref.type,
        ref: ref.ref,
        pageId: ref.pageId,
        chunkId: ref.chunkId,
        title: ref.title,
        requiredFor: matched,
      };
    }).sort((left, right) =>
      (right.requiredFor?.length ?? 0) - (left.requiredFor?.length ?? 0)
      || compareStrings(left.ref, right.ref));
  }

  private readRefForEvidence(evidence: Evidence): string | undefined {
    const pageId = evidence.pageId;
    const target = evidence.codeBlockId ?? evidence.headingId;
    if (pageId === undefined) return undefined;
    return target === undefined
      ? `agentdocs://pages/${pageId}.md`
      : `agentdocs://pages/${pageId}.md#${target}`;
  }

  private followUpRefForEvidence(
    evidence: Evidence,
  ): QueryDocsResponse["followUpRefs"][number] | undefined {
    if (evidence.pageId === undefined) return undefined;
    const page = this.pages.get(evidence.pageId);
    if (page === undefined) return undefined;
    const targetId = evidence.codeBlockId ?? evidence.headingId;
    const heading = targetId === undefined ? undefined : page.headings.find((item) => item.id === targetId);
    return {
      type: evidence.codeBlockId === undefined ? (targetId === undefined ? "page" : "chunk") : "code_block",
      ref: targetId === undefined
        ? `agentdocs://pages/${page.id}.md`
        : `agentdocs://pages/${page.id}.md#${targetId}`,
      pageId: page.id,
      chunkId: targetId,
      title: evidence.codeBlockId === undefined ? heading?.text ?? page.title : "Code example",
      sourceUrl: page.canonicalUrl ?? page.sourceUrl,
      repoPath: page.repoPath,
    };
  }

  queryDocs(options: QueryDocsOptions): QueryDocsResponse {
    const query = this.buildQueryDocs(options);
    const search = options.search ?? { query: options.goal, results: [], warnings: [] };
    const selectedPack = this.selectTaskPack(options.goal, options.task, options.search);
    const verification = this.buildContextVerification({
      task: taskTextFor(options.goal, options.task),
      facets: options.facets,
      selectedPack,
      search,
      query,
      requestedFacets: requestedFacetsFor(this.options.agentMap, options.goal, options.task, options.facets),
      queryWarnings: [
        ...query.warnings,
        ...(query.codeExamples.length === 0 ? ["No canonical code examples found."] : []),
      ],
    });
    return this.withReadiness(query, verification);
  }

  private buildQueryDocs(options: QueryDocsOptions): QueryDocsResponse {
    const queryText = positiveQueryText(queryTextFor(options.goal, options.task));
    const requestedFacets = requestedFacetsFor(this.options.agentMap, options.goal, options.task, options.facets);
    const taskSelection = this.selectTaskPackCandidate(options.goal, options.task, options.search);
    const selectedPack = taskSelection?.pack;
    const allowUnknownFacets = options.facets === undefined;
    const rankedChunks = this.rankChunks(queryText, options.search, selectedPack, requestedFacets, allowUnknownFacets);
    const steps = stableUniqueBy(
      [
        ...rankedChunks.map(({ chunk, page }) => ({
          title: titleForChunk(chunk, page),
          text: stripCode(chunk.text).trim(),
          evidence: compactEvidence([evidenceForChunk(page, chunk)]),
        })),
        ...(selectedPack?.steps
          .filter((step) => isRelevantPackEvidence(`${step.title} ${step.description}`, queryText))
          .filter((step) => this.evidenceCompatibleWithRequestedFacets(step.evidence, requestedFacets))
          .map((step) => ({
            title: step.title,
            text: stripCode(step.description).trim(),
            evidence: compactEvidence(step.evidence),
          })) ?? []),
      ].filter((step) => step.evidence.length > 0 && step.text.length > 0),
      (step) => `${step.title}:${step.text}`,
    );
    const codeExamples = this.codeExamplesFor(queryText, rankedChunks, selectedPack, requestedFacets, allowUnknownFacets);
    const gotchas = stableUniqueBy(
      (selectedPack?.gotchas
        .filter((gotcha) => gotcha.severity === "critical" || isRelevantPackEvidence(gotcha.text, queryText))
        .filter((gotcha) => this.evidenceCompatibleWithRequestedFacets(gotcha.evidence, requestedFacets))
        .map((gotcha) => ({
          ...gotcha,
          text: gotcha.text.trim(),
          evidence: compactEvidence(gotcha.evidence),
        })) ?? []),
      (gotcha) => `${gotcha.severity}:${gotcha.text}`,
    );
    const citations = stableUniqueBy(
      [
        ...steps.flatMap((step) => step.evidence),
        ...codeExamples.flatMap((example) => example.evidence),
        ...gotchas.flatMap((gotcha) => gotcha.evidence),
      ].map((evidence, index) => citationForEvidence(evidence, index + 1)),
      (citation) => citation.id,
    );
    const facetWarnings = contextFacetWarnings([
      ...(options.search?.results.map((result) => result.facets) ?? []),
      ...(selectedPack === undefined ? [] : [facetsFromTaskPack(selectedPack)]),
    ], requestedFacets);
    const warnings = [
      selectedPack?.confidence === "low" ? "Evidence is weak." : undefined,
      steps.length === 0 ? "No source-backed steps found." : undefined,
      codeExamples.length === 0 ? "No canonical code examples found." : undefined,
      ...(taskSelection?.warnings ?? []),
      ...facetWarnings.map(formatContextFacetWarning),
      ...(options.search?.warnings.map((warning) =>
        `${warning.code}: ${warning.key}=${warning.values.join(",")}`) ?? []),
    ].filter((warning): warning is string => warning !== undefined);
    const confidence = confidenceFor(selectedPack, rankedChunks, steps.length, codeExamples.length);
    const followUpRefs = stableUniqueBy(
      [
        ...rankedChunks.map(({ chunk, page }) => ({
          type: "chunk" as const,
          ref: `agentdocs://pages/${page.id}.md#${chunk.id}`,
          pageId: page.id,
          chunkId: chunk.id,
          title: titleForChunk(chunk, page),
          sourceUrl: page.canonicalUrl ?? page.sourceUrl,
          repoPath: page.repoPath,
        })),
        ...steps.flatMap((step) => step.evidence.map((evidence) => this.followUpRefForEvidence(evidence))),
        ...codeExamples.flatMap((example) => example.evidence.map((evidence) => this.followUpRefForEvidence(evidence))),
        ...gotchas.flatMap((gotcha) => gotcha.evidence.map((evidence) => this.followUpRefForEvidence(evidence))),
      ].filter((ref): ref is NonNullable<typeof ref> => ref !== undefined),
      (ref) => ref.ref,
    );
    const implementationHints = sourceBackedHints(rankedChunks, codeExamples);
    const readiness = readinessFromQueryWarnings(warnings, steps.length, codeExamples.length);
    const answer = [
      selectedPack === undefined
        ? `Found ${steps.length} source-backed item(s) for "${options.goal}".`
        : `Use the ${selectedPack.title} task context for "${options.goal}".`,
      ...implementationHints,
      confidence === "low"
        ? "Evidence is weak; use the cited sources before implementing."
        : readiness.recommendation === "implement"
          ? "The steps and code examples below are sufficient to implement unless your task needs detail not covered here."
          : "Inspect the cited source evidence before implementing.",
    ].filter(Boolean).join(" ");
    return finalizeQueryResponse({
      goal: options.goal,
      task: selectedPack?.id ?? options.task,
      answer,
      confidence,
      steps,
      codeExamples,
      gotchas,
      citations,
      followUpRefs,
      warnings,
      readiness,
    });
  }

  readPage(options: ReadPageOptions): ReadPageResponse {
    const reference = parseAgentDocsReference(options.ref);
    const selected = this.selectReadableTarget(reference);
    const part = selected.parts[reference.part - 1];
    if (part === undefined) {
      throw new Error(`Part ${reference.part} was not found for "${options.ref}".`);
    }
    const complete = reference.part === selected.parts.length;
    return ReadPageResponseSchema.parse({
      section: {
        pageId: selected.page.id,
        targetId: reference.targetId,
        title: selected.title,
        headingPath: selected.headingPath,
        sourceUrl: selected.page.canonicalUrl ?? selected.page.sourceUrl,
        repoPath: selected.page.repoPath,
        text: part,
        part: reference.part,
        complete,
        nextRef: complete ? undefined : formatAgentDocsReference({ ...reference, part: reference.part + 1 }),
        evidence: selected.evidence,
      },
    });
  }

  private selectTaskPack(goal: string, task?: string, search?: SearchResponse): TaskPack | undefined {
    return this.selectTaskPackCandidate(goal, task, search)?.pack;
  }

  private selectTaskPackCandidate(goal: string, task?: string, search?: SearchResponse): TaskSelection | undefined {
    if (task !== undefined) {
      const exact = this.options.agentMap.taskPacks.find((pack) => pack.id === task);
      if (exact !== undefined) return { pack: exact, score: Number.POSITIVE_INFINITY, warnings: [] };
    }
    const goalTerms = tokenize(goal.toLowerCase());
    const taskTerms = task !== undefined ? tokenize(task.toLowerCase()) : [];
    const allTerms = [...goalTerms, ...taskTerms];
    const queryText = `${task ?? ""} ${goal}`.toLowerCase();
    const intents = taskIntentScores(queryText);
    const strongestIntent = Math.max(0, ...intents.values());
    const searchPageScores = new Map<string, number>();
    for (const [index, result] of (search?.results ?? []).entries()) {
      searchPageScores.set(result.pageId, Math.max(searchPageScores.get(result.pageId) ?? 0, 16 - index));
    }

    const ranked = this.options.agentMap.taskPacks
      .map((pack) => {
        const searchText = taskPackSearchText(pack);
        const baseScore = scoreTerms(searchText, queryText);
        const searchEvidenceScore = pack.requiredPages.reduce(
          (score, pageId) => score + (searchPageScores.get(pageId) ?? 0),
          0,
        );
        const titleTokens = tokenize(pack.title.toLowerCase());
        const exactTitleMatch = allTerms.some((term) => term === pack.id.toLowerCase() || titleTokens.includes(term));
        const fuzzyTitleMatch = allTerms.some((term) =>
          term.length >= 4 && (
            pack.id.toLowerCase().startsWith(term)
            || titleTokens.some((token) => token.startsWith(term) || term.startsWith(token))
          ));
        const titleBonus = exactTitleMatch ? 20 : fuzzyTitleMatch ? 6 : 0;
        const intentScore = intents.get(pack.id) ?? 0;
        const hasSpecificTerms = allTerms.some((term) => term.length >= 10);
        const packHasSpecificMatch = allTerms.some((queryTerm) =>
          queryTerm.length >= 10 && tokenize(searchText).some((term) => term === queryTerm || term.startsWith(queryTerm))
        );
        const genericPenalty = hasSpecificTerms && !packHasSpecificMatch ? -6 : 0;
        const intentPenalty = strongestIntent >= 10 && intentScore < strongestIntent ? (intentScore === 0 ? -18 : -10) : 0;
        const negativeIntentPenalty = negativeIntentConflict(pack.id, intents, queryText);
        const evidenceBoost = evidenceOverlapScoreForTask(pack, queryText, this.options.agentMap);
        return {
          pack,
          score: baseScore + searchEvidenceScore + titleBonus + intentScore * 3 + evidenceBoost + genericPenalty + intentPenalty + negativeIntentPenalty,
        };
      })
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score || compareStrings(left.pack.id, right.pack.id));

    const selected = ranked[0];
    if (selected === undefined) return undefined;
    const warnings = taskSelectionWarnings(selected, ranked[1], intents, strongestIntent);
    return { ...selected, warnings };
  }

  private buildGoalBundle(goal: string, search: SearchResponse): ContextBundle["goalBundle"] {
    const chunks = new Map(this.options.agentMap.chunks.map((chunk) => [chunk.id, chunk]));
    const candidates = (search.results.length > 0
      ? search.results
      : this.options.agentMap.chunks.slice(0, 1).map((chunk) => {
          const page = this.pages.get(chunk.pageId)!;
          return {
            title: page.title,
            sourceUrl: page.canonicalUrl ?? page.sourceUrl,
            repoPath: page.repoPath,
            headingPath: chunk.headingPath,
            snippet: excerpt(chunk.text),
            score: 0,
            pageId: page.id,
            chunkId: chunk.id,
            facets: chunk.facets,
          };
        }))
      .map((result) => ({ result, role: evidenceRole(result.title, result.headingPath, chunks.get(result.chunkId)?.text ?? result.snippet) }));
    const selected: typeof candidates = [];
    const roles = new Set<string>();
    for (const candidate of candidates) {
      if (selected.length >= 5) break;
      if (!roles.has(candidate.role)) {
        selected.push(candidate);
        roles.add(candidate.role);
      }
    }
    for (const candidate of candidates) {
      if (selected.length >= 5) break;
      if (!selected.some(({ result }) => result.chunkId === candidate.result.chunkId)) selected.push(candidate);
    }
    const steps = selected.map(({ result, role }) => ({
      role,
      title: titleForHeadingPath(result.headingPath, result.title),
      snippet: result.snippet || excerpt(chunks.get(result.chunkId)?.text ?? result.title),
      resource: `agentdocs://pages/${result.pageId}.md`,
      pageId: result.pageId,
      chunkId: result.chunkId,
    }));
    const gotchas = steps
      .filter((step) => step.role === "gotcha")
      .map((step) => step.snippet);
    return {
      summary: `Use ${steps.length} complementary source section(s) for "${goal}".`,
      confidence: roles.size >= 3 && search.results.length >= 3
        ? "high" as const
        : steps.length >= 2
          ? "medium" as const
          : "low" as const,
      steps,
      gotchas,
      supportingResources: stableUnique(steps.map((step) => step.resource)),
      warnings: search.warnings,
    };
  }

  private contextWarnings(
    pack: TaskPack | undefined,
    queryWarnings: string[],
    freshness: StatusReport | undefined,
  ): string[] {
    return stableUnique([
      freshness !== undefined && freshness.state !== "fresh" ? `Freshness ${freshness.state}: ${freshness.summary}` : undefined,
      ...queryWarnings,
      ...(pack?.context.conflicts.map((conflict) => `context_conflict: ${conflict.key}=${conflict.values.join(",")}`) ?? []),
      pack?.confidence === "low" ? "Task-pack evidence is weak." : undefined,
    ].filter((item): item is string => item !== undefined));
  }

  private buildContextVerification(options: {
    task: string;
    facets?: Record<string, string>;
    freshness?: StatusReport;
    selectedPack?: TaskPack;
    search: SearchResponse;
    query: QueryDocsResponse;
    requestedFacets?: Record<string, string>;
    queryWarnings?: string[];
  }): ContextVerification {
    const issues: ContextVerification["issues"] = [];
    if (options.freshness !== undefined && options.freshness.state !== "fresh") {
      issues.push({
        code: "stale_context",
        severity: options.freshness.state === "stale" ? "critical" : "warning",
        message: options.freshness.summary,
        evidence: [],
      });
    }
    const pack = options.selectedPack;
    if (pack === undefined) {
      issues.push({
        code: "missing_task_pack",
        severity: "warning",
        message: "No matching task pack was found; inspect corpus evidence directly.",
        evidence: [],
      });
    } else {
      if (pack.confidence === "low") {
        issues.push({
          code: "weak_evidence",
          severity: "warning",
          message: `Task pack "${pack.id}" has low confidence.`,
          evidence: pack.evidence,
        });
      }
      for (const conflict of pack.context.conflicts) {
        issues.push({
          code: "mixed_context",
          severity: "critical",
          message: `Task pack mixes ${conflict.key} values: ${conflict.values.join(", ")}.`,
          evidence: conflict.evidence,
        });
      }
      for (const [key, value] of Object.entries(options.requestedFacets ?? options.facets ?? {})) {
        const values = pack.context.facets[key] ?? [];
        if (values.length > 0 && !values.includes(value)) {
          issues.push({
            code: "preferred_context_mismatch",
            severity: "critical",
            message: `Task pack does not match requested ${key}=${value}.`,
            evidence: pack.evidence,
          });
        }
      }
      if (pack.requiredPages.length === 0) {
        issues.push({
          code: "missing_canonical_source",
          severity: "critical",
          message: "Task pack has no required source pages.",
          evidence: pack.evidence,
        });
      }
      for (const gotcha of pack.gotchas.filter((item) => /deprecated/i.test(item.text))) {
        issues.push({
          code: "deprecated_evidence",
          severity: "warning",
          message: gotcha.text,
          evidence: gotcha.evidence,
        });
      }
    }
    for (const warning of options.search.warnings) {
      issues.push({
        code: "mixed_search_context",
        severity: "warning",
        message: `Search results mix ${warning.key} values: ${warning.values.join(", ")}.`,
        evidence: [],
      });
    }
    for (const warning of options.queryWarnings ?? []) {
      const issue = issueForQueryWarning(warning, pack);
      if (issue !== undefined && !issues.some((candidate) => candidate.code === issue.code)) {
        issues.push(issue);
      }
    }
    const requirements = assessTaskRequirements({
      task: options.task,
      explicitFacets: options.facets,
      requestedFacets: options.requestedFacets,
      selectedPack: pack,
      query: options.query,
      candidateEvidenceFor: (requirement) => this.candidateEvidenceFor(requirement),
      corpusTerms: this.corpusTerms,
    });
    const incompleteRequirements = requirements.filter((requirement) =>
      requirement.status === "missing" || requirement.status === "partial" || requirement.status === "unknown");
    for (const requirement of incompleteRequirements) {
      issues.push({
        code: "missing_task_requirement_evidence",
        severity: requirement.status === "missing"
          || (requirement.status === "unknown" && requirement.source === "explicit" && !isNegativeConstraint(requirement.value))
          ? "critical"
          : "warning",
        message: requirement.message,
        evidence: requirement.evidence,
      });
    }
    const coverage = requirements.length === 0
      ? "unknown" as const
      : requirements.some((requirement) => requirement.status === "missing" || requirement.status === "partial" || requirement.status === "unknown")
        ? "partial" as const
        : "complete" as const;
    const status = issues.some((issue) => issue.severity === "critical")
      ? "fail"
      : issues.length > 0
        ? "warn"
        : "pass";
    return ContextVerificationSchema.parse({
      schemaVersion: 2,
      task: options.task,
      status,
      summary: status === "fail"
        ? "Context has critical issues. Stop and refresh or narrow context before using it."
        : status === "warn"
          ? "Context has warnings. Review before using it."
          : coverage === "complete"
            ? "Context is safe to use for this task."
            : "Context has no detected conflicts, but task coverage is not complete. Inspect cited evidence before using it.",
      issues,
      coverage,
      recommendation: status === "fail"
        ? "stop"
        : status === "warn" || coverage !== "complete"
          ? "inspect"
          : "implement",
      requirements,
      freshness: options.freshness,
    });
  }

  private rankChunks(
    goal: string,
    search: SearchResponse | undefined,
    pack: TaskPack | undefined,
    facets: Record<string, string> | undefined,
    allowUnknownFacets = false,
  ): RankedChunk[] {
    const byId = new Map<string, number>();
    for (const [index, result] of (search?.results ?? []).entries()) {
      byId.set(result.chunkId, Math.max(4, 24 - index * 2));
    }
    const packText = pack === undefined ? "" : taskPackSearchText(pack);
    const anchors = highSignalAnchors(goal).map(normalizeFacetText);
    const queryTerms = stableUnique(tokenize(goal));
    const candidateIds = new Set<string>(search?.results.map((result) => result.chunkId) ?? []);
    for (const anchor of anchors) {
      for (const token of tokenize(anchor)) {
        for (const chunkId of this.chunkIdsByToken.get(token) ?? []) candidateIds.add(chunkId);
      }
    }
    if (pack !== undefined) {
      for (const chunk of this.options.agentMap.chunks) {
        if (pack.requiredPages.includes(chunk.pageId)) candidateIds.add(chunk.id);
      }
    }
    const candidates = candidateIds.size === 0 ? this.options.agentMap.chunks : [...candidateIds]
      .map((id) => this.chunks.get(id))
      .filter((chunk): chunk is Chunk => chunk !== undefined);
    return candidates
      .map((chunk) => {
        const page = this.pages.get(chunk.pageId);
        if (page === undefined) return undefined;
        if (!facetsCompatible(
          scopedFacetsForChunks(page, [chunk]),
          facets,
          `${page.title} ${chunk.headingPath.join(" ")} ${chunk.text}`,
          allowUnknownFacets,
        )) return undefined;
        const cachedSearch = this.chunkSearch.get(chunk.id);
        const searchableText = cachedSearch?.text ?? `${page.title} ${chunk.headingPath.join(" ")} ${chunk.text}`;
        const lexical = scoreTokenizedTerms(cachedSearch?.tokens ?? tokenize(searchableText), queryTerms, searchableText, goal);
        const exact = exactAnchorScoreWithAnchors(searchableText, anchors);
        const headingExact = exactAnchorScoreWithAnchors(chunk.headingPath.join(" "), anchors);
        const score = (byId.get(chunk.id) ?? 0)
          + lexical
          + exact * 5
          + headingExact * 12
          + (packText.length > 0 && scoreTerms(`${chunk.headingPath.join(" ")} ${chunk.text}`, packText) > 0 ? 1 : 0);
        return { chunk, page, score };
      })
      .filter((item): item is RankedChunk => item !== undefined && item.score > 0)
      .sort((left, right) => right.score - left.score || compareStrings(left.chunk.id, right.chunk.id));
  }

  private candidateEvidenceFor(requirement: Pick<RequirementAssessment, "kind" | "value">): Evidence[] {
    if (requirement.kind === "facet") return [];
    const candidateIds = new Set<string>();
    for (const term of meaningfulTerms(requirement.value)) {
      for (const chunkId of this.chunkIdsByToken.get(term) ?? []) candidateIds.add(chunkId);
    }
    const candidates = [...candidateIds]
      .map((id) => this.chunks.get(id))
      .filter((chunk): chunk is Chunk => chunk !== undefined)
      .map((chunk) => {
        const page = this.pages.get(chunk.pageId);
        if (page === undefined) return undefined;
        const text = `${page.title} ${chunk.headingPath.join(" ")} ${chunk.text}`;
        const normalizedRequirement = normalizeFacetText(requirement.value);
        const normalizedCandidate = normalizeFacetText(text);
        const terms = meaningfulTerms(requirement.value);
        const matched = requirement.kind === "constraint"
          ? terms.filter((term) => containsTerm(text, term)).length
          : containsRequirement(text, requirement.value) ? terms.length || 1 : 0;
        const threshold = requirement.kind === "constraint"
          ? Math.max(1, Math.ceil(terms.length * 0.5))
          : 1;
        if (matched < threshold) return undefined;
        const exactHeading = containsRequirement(`${page.title} ${chunk.headingPath.join(" ")}`, requirement.value);
        const exactText = containsRequirement(normalizedCandidate, normalizedRequirement);
        return {
          evidence: evidenceForChunk(page, chunk),
          score: (exactHeading ? 100 : 0) + (exactText ? 40 : 0) + matched + scoreTerms(text, requirement.value),
        };
      })
      .filter((candidate): candidate is { evidence: Evidence; score: number } => candidate !== undefined)
      .sort((left, right) => right.score - left.score || compareStrings(JSON.stringify(left.evidence), JSON.stringify(right.evidence)));
    return compactEvidence(candidates.map((candidate) => candidate.evidence));
  }

  private codeExamplesFor(
    goal: string,
    ranked: RankedChunk[],
    pack: TaskPack | undefined,
    facets: Record<string, string> | undefined,
    allowUnknownFacets = false,
  ) {
    const rankedChunkIds = new Set(ranked.map(({ chunk }) => chunk.id));
    const rankedPageIds = new Set(ranked.map(({ page }) => page.id));
    const examples = this.options.agentMap.pages.flatMap((page) =>
      page.codeBlocks.map((block) => {
        if (!isUsableCodeExample(block.value, block.language)) return undefined;
        const headingPath = headingPathFor(page, block.sourceHeadingId);
        const relatedChunk = headingPath.length === 0
          ? this.firstChunkByPage.get(page.id)
          : this.chunkByPageHeading.get(`${page.id}\u0000${headingPath.join("\u0000")}`);
        const packExample = pack?.codeExamples.find((example) =>
          oneLine(taskPackCodeExampleValue(example)) === oneLine(block.value));
        const packMatch = packExample !== undefined;
        const blockFacetMatch = facets !== undefined
          && Object.entries(facets).every(([, value]) => containsFacetValue(block.value, value));
        if (!blockFacetMatch && !facetsCompatible(
          scopedFacetsForChunks(page, relatedChunk === undefined ? [] : [relatedChunk]),
          facets,
          `${page.title} ${headingPath.join(" ")} ${block.value}`,
          allowUnknownFacets,
        )) return undefined;
        const searchableText = `${page.title} ${headingPath.join(" ")} ${block.value}`;
        const score = scoreTerms(searchableText, goal)
          + exactAnchorScore(searchableText, goal) * 10
          + exactAnchorScore(headingPath.join(" "), goal) * 10
          + (rankedPageIds.has(page.id) ? 6 : 0)
          + (relatedChunk !== undefined && rankedChunkIds.has(relatedChunk.id) ? 10 : 0)
          + (packMatch ? 4 : 0);
        return {
          language: block.language,
          value: block.value,
          evidence: packExample !== undefined && typeof packExample !== "string"
            ? compactEvidence(packExample.evidence)
            : compactEvidence([{
            source: "code_block" as const,
            pageId: page.id,
            headingId: block.sourceHeadingId,
            codeBlockId: block.id,
            url: page.canonicalUrl ?? page.sourceUrl,
            repoPath: page.repoPath,
            quote: block.value,
          }]),
          score,
        };
      }))
      .filter((example): example is NonNullable<typeof example> => example !== undefined)
      .filter((example) => example.score > 0)
      .sort((left, right) => right.score - left.score || compareStrings(left.value, right.value));
    const ordered = stableUniqueBy(examples, (example) => oneLine(example.value));
    const candidates = ordered;
    const anchors = highSignalAnchors(goal).map(normalizeFacetText).filter((anchor) => anchor.length > 2);
    const selected: typeof ordered = [];
    const remaining = [...candidates];
    while (remaining.length > 0) {
      const selectedText = selected.map((example) => normalizeFacetText(example.value)).join(" ");
      let bestIndex = 0;
      let bestScore = Number.NEGATIVE_INFINITY;
      for (let index = 0; index < remaining.length; index += 1) {
        const candidate = remaining[index]!;
        const candidateText = normalizeFacetText(candidate.value);
        const newAnchors = anchors.filter((anchor) => candidateText.includes(anchor) && !selectedText.includes(anchor)).length;
        const score = candidate.score + newAnchors * 24;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      }
      selected.push(remaining.splice(bestIndex, 1)[0]!);
    }
    for (const facetValue of Object.values(facets ?? {})) {
      if (selected.some((example) => containsFacetValue(example.value, facetValue))) continue;
      const facetIndex = remaining.findIndex((example) => containsFacetValue(example.value, facetValue));
      if (facetIndex < 0) continue;
      const facetExample = remaining.splice(facetIndex, 1)[0]!;
      selected.push(facetExample);
    }
    return selected.map(({ score: _score, ...example }) => example);
  }

  private evidenceCompatibleWithRequestedFacets(evidence: Evidence[], requested: Record<string, string> | undefined): boolean {
    if (requested === undefined) return true;
    return evidence.some((item) => {
      const page = item.pageId === undefined ? undefined : this.pages.get(item.pageId);
      if (page === undefined) return false;
      const pageChunks = this.options.agentMap.chunks.filter((chunk) => chunk.pageId === page.id);
      const quotedChunks = item.quote === undefined
        ? []
        : pageChunks.filter((chunk) => {
          const quote = item.quote!.trim();
          const text = chunk.text.trim();
          return quote.length > 0 && (text.includes(quote) || quote.includes(text));
        });
      const headingChunks = item.headingId === undefined
        ? []
        : pageChunks.filter((chunk) => arraysEqual(
          chunk.headingPath,
          headingPathFor(page, item.headingId),
        ));
      const chunks = quotedChunks.length > 0
        ? quotedChunks
        : headingChunks.length > 0
          ? headingChunks
          : pageChunks;
      const facets = scopedFacetsForChunks(page, chunks);
      return facetsCompatible(
        facets,
        requested,
        `${page.title} ${page.headings.map((heading) => heading.text).join(" ")} ${page.markdown}`,
      );
    });
  }

  private selectReadableTarget(reference: AgentDocsReference): ReadableTarget {
    const page = this.pages.get(reference.pageId);
    if (page === undefined) throw new Error(`Page "${reference.pageId}" was not found.`);
    const pageChunks = this.options.agentMap.chunks.filter((chunk) => chunk.pageId === page.id);
    const source = (text: string, targetId: string | undefined, title: string, headingPath: string[], evidence: Evidence[]) => ({
      page,
      title,
      headingPath,
      evidence: compactEvidence(evidence),
      parts: splitReadableText(text),
      targetId,
    });

    if (reference.targetId === undefined) {
      const texts = pageChunks.map((chunk) => chunk.text);
      return {
        page,
        title: page.title,
        headingPath: [],
        evidence: compactEvidence([{ source: "page", pageId: page.id, url: page.canonicalUrl ?? page.sourceUrl, repoPath: page.repoPath }]),
        parts: texts.length === 0 ? splitReadableText(page.markdown) : texts.flatMap((text) => splitReadableText(text)),
      };
    }

    const chunk = this.chunks.get(reference.targetId);
    if (chunk !== undefined) {
      if (chunk.pageId !== page.id) throw new Error(`Target "${reference.targetId}" does not belong to page "${page.id}".`);
      return source(chunk.text, chunk.id, titleForChunk(chunk, page), chunk.headingPath, [evidenceForChunk(page, chunk)]);
    }

    const codeBlock = page.codeBlocks.find((block) => block.id === reference.targetId);
    if (codeBlock !== undefined) {
      return source(codeBlock.value, codeBlock.id, "Code example", headingPathFor(page, codeBlock.sourceHeadingId), [{
        source: "code_block",
        pageId: page.id,
        headingId: codeBlock.sourceHeadingId,
        codeBlockId: codeBlock.id,
        url: page.canonicalUrl ?? page.sourceUrl,
        repoPath: page.repoPath,
        quote: codeBlock.value,
      }]);
    }

    const heading = page.headings.find((item) => item.id === reference.targetId);
    if (heading !== undefined) {
      const headingPath = headingPathFor(page, heading.id);
      const texts = pageChunks
        .filter((chunk) => headingPath.every((value, index) => chunk.headingPath[index] === value))
        .map((chunk) => chunk.text);
      return {
        page,
        title: heading.text,
        headingPath,
        evidence: compactEvidence([{
          source: "heading",
          pageId: page.id,
          headingId: heading.id,
          url: page.canonicalUrl ?? page.sourceUrl,
          repoPath: page.repoPath,
        }]),
        parts: texts.length === 0 ? splitReadableText(page.markdown) : texts.flatMap((text) => splitReadableText(text)),
      };
    }

    throw new Error(`Target "${reference.targetId}" was not found on page "${page.id}".`);
  }
}

type AgentDocsReference = {
  pageId: string;
  part: number;
  targetId?: string;
};

type ReadableTarget = {
  page: DocPage;
  title: string;
  headingPath: string[];
  evidence: Evidence[];
  parts: string[];
};

function parseAgentDocsReference(value: string): AgentDocsReference {
  const match = /^agentdocs:\/\/pages\/([a-zA-Z0-9_-]+)\.md(?:\?part=([1-9][0-9]*))?(?:#([a-zA-Z0-9_-]+))?$/.exec(value);
  if (match === null) {
    throw new Error("ref must be an AgentDocs page reference such as agentdocs://pages/page_id.md#target_id.");
  }
  return {
    pageId: match[1]!,
    part: match[2] === undefined ? 1 : Number(match[2]),
    targetId: match[3],
  };
}

function formatAgentDocsReference(reference: AgentDocsReference): string {
  return `agentdocs://pages/${reference.pageId}.md${reference.part === 1 ? "" : `?part=${reference.part}`}${reference.targetId === undefined ? "" : `#${reference.targetId}`}`;
}

function splitReadableText(value: string): string[] {
  if (value.length <= READ_PART_TARGET_CHARS) return [value];
  const blocks = value.split(/(?<=\n)(?=\n)/);
  const safeBlocks = blocks.flatMap((block) => block.length <= READ_PART_TARGET_CHARS
    ? [block]
    : splitReadableLines(block));
  const parts: string[] = [];
  let current = "";
  for (const block of safeBlocks) {
    if (current.length > 0 && current.length + block.length > READ_PART_TARGET_CHARS) {
      parts.push(current);
      current = "";
    }
    current += block;
  }
  if (current.length > 0) parts.push(current);
  return parts.length === 0 ? [""] : parts;
}

function splitReadableLines(value: string): string[] {
  const lines = value.match(/[^\n]*\n|[^\n]+/g) ?? [value];
  const parts: string[] = [];
  let current = "";
  for (const line of lines) {
    if (current.length > 0 && current.length + line.length > READ_PART_TARGET_CHARS) {
      parts.push(current);
      current = "";
    }
    current += line;
  }
  if (current.length > 0) parts.push(current);
  return parts.length === 0 ? [""] : parts;
}

function evidenceForChunk(page: DocPage, chunk: Chunk): Evidence {
  const headingText = chunk.headingPath.at(-1);
  const matching = page.headings.filter((heading) => heading.text === headingText);
  return {
    source: matching.length === 1 ? "heading" : "page",
    pageId: page.id,
    headingId: matching.length === 1 ? matching[0]!.id : undefined,
    url: page.canonicalUrl ?? page.sourceUrl,
    repoPath: page.repoPath,
    quote: chunk.text,
  };
}

function citationForEvidence(evidence: Evidence, fallback: number) {
  const id = evidence.codeBlockId ?? evidence.headingId ?? evidence.pageId ?? `citation_${fallback}`;
  return {
    id,
    pageId: evidence.pageId,
    headingId: evidence.headingId,
    codeBlockId: evidence.codeBlockId,
    sourceUrl: evidence.url,
    repoPath: evidence.repoPath,
    quote: undefined,
  };
}

function titleForChunk(chunk: Chunk, page: DocPage): string {
  return titleForHeadingPath(chunk.headingPath, page.title);
}

function titleForHeadingPath(headingPath: string[], fallback: string): string {
  const heading = headingPath.at(-1)?.trim();
  return heading === undefined || heading.length === 0 ? fallback : heading;
}

function compactEvidence(evidence: Evidence[]): Evidence[] {
  return evidence.map((item) => ({
    ...item,
    quote: item.quote === undefined ? undefined : excerpt(item.quote, 80),
  }));
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
  return [...path, target.text].filter((value) => value.trim().length > 0);
}

function taskPackSearchText(pack: TaskPack): string {
  return [
    pack.id,
    pack.title,
    pack.description,
    ...pack.codeExamples.map(taskPackCodeExampleValue),
    ...pack.steps.flatMap((step) => [step.title, step.description]),
    ...pack.gotchas.map((gotcha) => gotcha.text),
  ].join(" ").toLowerCase();
}

function taskPackCodeExampleValue(example: TaskPack["codeExamples"][number]): string {
  return typeof example === "string" ? example : example.value;
}

function taskIntentScores(query: string): Map<string, number> {
  const scores = new Map<string, number>();
  for (const rule of TASK_INTENT_RULES) {
    if (rule.pattern.test(query)) {
      scores.set(rule.family, Math.max(scores.get(rule.family) ?? 0, rule.strength));
    }
  }
  return scores;
}

function negativeIntentConflict(packId: string, intents: Map<string, number>, _query: string): number {
  const strongest = Math.max(0, ...intents.values());
  if (strongest < 10 || (intents.get(packId) ?? 0) > 0) return 0;
  return -12;
}

type EvidenceOverlapSignal = {
  query: RegExp;
  evidence: RegExp;
  score: number;
};

const EVIDENCE_OVERLAP_SIGNALS: EvidenceOverlapSignal[] = [
  { query: /\b(?:install|installation|add\s+(?:the\s+)?(?:package|dependency)|setup|set\s+up)\b/i, evidence: /\b(?:npm\s+(?:install|i)|pnpm\s+add|yarn\s+add|pip\s+install|cargo\s+add|go\s+get|install|setup|set\s+up)\b/i, score: 4 },
  { query: /\b(?:config|configure|configuration|environment|env|option|options|properties|setting|settings)\b/i, evidence: /\b(?:process\.env|environment|env|option|options|properties|config|configuration|setting|settings)\b/i, score: 4 },
  { query: /\b(?:auth|authentication|authenticate|authorization|credential|credentials|token|secret|rls|policy|policies|permission)\b/i, evidence: /\b(?:auth|authentication|credential|credentials|token|secret|rls|policy|policies|permission|oauth|login|sign\s*in)\b/i, score: 4 },
  { query: /\b(?:deploy|deployment|production|hosting|hosted|publish|release|runtime)\b/i, evidence: /\b(?:deploy|deployment|production|host|hosting|publish|release|runtime|worker)\b/i, score: 4 },
  { query: /\b(?:route|handler|middleware|endpoint|request|response)\b/i, evidence: /\b(?:route|handler|middleware|endpoint|request|response|api|get|post|put|patch|delete)\b/i, score: 4 },
  { query: /\b(?:schema|validate|validation|validator)\b/i, evidence: /\b(?:schema|validate|validation|validator|required|properties|type:\s*['\"]?object)\b/i, score: 4 },
  { query: /\b(?:mutation|mutate|update|invalidate|invalidation|refetch|cache)\b/i, evidence: /\b(?:mutation|mutate|update|invalidate|invalidation|refetch|cache|onSuccess)\b/i, score: 4 },
  { query: /\b(?:workflow|pipeline|job|task)\b/i, evidence: /\b(?:workflow|pipeline|job|task|schedule|dag)\b/i, score: 4 },
  { query: /\b(?:pagination|paginate|cursor|next\s+page|page\s+token|next\s+token|offset|marker|has\s+more)\b/i, evidence: /\b(?:pagination|paginate|cursor|next\s+page|page\s+token|next\s+token|offset|marker|has\s+more|while|for\s+await)\b/i, score: 4 },
  { query: /\b(?:webhook|webhooks|signature|signing\s+secret|hmac)\b/i, evidence: /\b(?:webhook|webhooks|signature|signing\s+secret|hmac|verify|verification)\b/i, score: 4 },
  { query: /\b(?:debug|debugging|troubleshoot|error|failure|exception|retry|crash)\b/i, evidence: /\b(?:debug|debugging|troubleshoot|error|failure|exception|retry|crash|warning)\b/i, score: 4 },
  { query: /\b(?:test|testing|assert|expect|mock|fixture)\b/i, evidence: /\b(?:test|testing|assert|expect|mock|fixture|describe\(|it\()\b/i, score: 4 },
  { query: /\b(?:quickstart|getting\s+started|create|start|initialize|bootstrap|first)\b/i, evidence: /\b(?:quickstart|getting\s+started|create|start|initialize|bootstrap|hello|first)\b/i, score: 4 },
  { query: /\b(?:migrate|migration|upgrade|breaking\s+change|deprecated|deprecation)\b/i, evidence: /\b(?:migrate|migration|upgrade|breaking\s+change|deprecated|deprecation)\b/i, score: 4 },
];

function evidenceOverlapScoreForTask(pack: TaskPack, query: string, agentMap: AgentMap): number {
  const text = taskPackSearchText(pack);
  const code = pack.codeExamples.map(taskPackCodeExampleValue).join("\n");
  const pages = pack.requiredPages
    .map((pageId) => agentMap.pages.find((page) => page.id === pageId))
    .filter((page): page is DocPage => page !== undefined);
  const pageText = pages.map((page) => `${page.title} ${page.markdown}`).join("\n").toLowerCase();
  const combined = `${text}\n${code}\n${pageText}`;
  const combinedTokens = tokenize(combined);
  const queryTerms = stableUnique(tokenize(query)).filter(isEvidenceTerm);

  const termOverlap = queryTerms.reduce((score, queryTerm) => {
    const matched = combinedTokens.some((term) => term === queryTerm || term.startsWith(queryTerm));
    return score + (matched ? Math.min(queryTerm.length / 6, 2) : 0);
  }, 0);
  const signalScore = EVIDENCE_OVERLAP_SIGNALS.reduce(
    (score, signal) => score + (signal.query.test(query) && signal.evidence.test(combined) ? signal.score : 0),
    0,
  );
  const codeTokens = tokenize(code);
  const codeOverlap = queryTerms.some((queryTerm) =>
    codeTokens.some((term) => term === queryTerm || term.startsWith(queryTerm)))
    ? 3
    : 0;

  return Math.min(12, Math.min(4, termOverlap) + Math.min(8, signalScore) + codeOverlap);
}

function isEvidenceTerm(term: string): boolean {
  return term.length >= 4 && !new Set([
    "with",
    "from",
    "using",
    "use",
    "uses",
    "this",
    "that",
    "your",
    "after",
    "before",
    "into",
    "when",
    "then",
  ]).has(term);
}

function taskSelectionWarnings(
  selected: { pack: TaskPack; score: number },
  runnerUp: { pack: TaskPack; score: number } | undefined,
  intents: Map<string, number>,
  strongestIntent: number,
): string[] {
  const warnings: string[] = [];
  if (strongestIntent >= 10 && (intents.get(selected.pack.id) ?? 0) === 0) {
    const expected = [...intents.entries()]
      .filter(([, score]) => score === strongestIntent)
      .map(([family]) => family)
      .sort(compareStrings)
      .join(",");
    warnings.push(`intent_evidence_mismatch: selected=${selected.pack.id}; expected=${expected}`);
  }
  if (runnerUp !== undefined && Number.isFinite(selected.score) && selected.score - runnerUp.score <= 12) {
    warnings.push(`ambiguous_task_selection: selected=${selected.pack.id}; alternative=${runnerUp.pack.id}`);
  }
  return warnings;
}

function requestedFacetsFor(
  agentMap: AgentMap,
  goal: string,
  task: string | undefined,
  explicit: Record<string, string> | undefined,
): Record<string, string> | undefined {
  const inferred: Record<string, string> = {};
  const text = normalizeFacetText(taskTextFor(goal, task));
  const valuesByKey = new Map<string, Set<string>>();
  // Facets can be attached to pages or to atomic evidence chunks (for
  // example, a row in a framework/version compatibility table). Include both
  // levels when inferring an unambiguous request from the task text.
  for (const facet of [
    ...agentMap.pages.flatMap((page) => page.facets),
    ...agentMap.chunks.flatMap((chunk) => chunk.facets),
  ]) {
    const values = valuesByKey.get(facet.key) ?? new Set<string>();
    values.add(facet.value);
    valuesByKey.set(facet.key, values);
  }
  for (const [key, values] of valuesByKey) {
    const matches = [...values].filter((value) => text.includes(normalizeFacetText(value)));
    // Infer only an unambiguous value. This keeps facet routing generic and
    // corpus-driven without embedding framework/package vocabulary here.
    if (matches.length === 1) inferred[key] = matches[0]!;
  }
  const combined = { ...inferred, ...(explicit ?? {}) };
  return Object.keys(combined).length === 0 ? undefined : combined;
}

function normalizeFacetText(value: string): string {
  return value.toLowerCase().replace(/[-_/]+/g, " ").replace(/\s+/g, " ").trim();
}

function facetsFromTaskPack(pack: TaskPack): Chunk["facets"] {
  return Object.entries(pack.context.facets).flatMap(([key, values]) =>
    values.map((value) => ({
      key,
      value,
      evidence: pack.evidence,
    })));
}

function contextFacetWarnings(
  groups: Array<Chunk["facets"]>,
  requested: Record<string, string> | undefined,
): ContextFacetWarning[] {
  if (requested === undefined) return [];
  return Object.entries(requested).flatMap(([key, requestedValue]) => {
    const found = stableUnique(groups
      .flatMap((facets) => facets.filter((facet) => facet.key === key).map((facet) => facet.value))
      .filter((value) => value !== requestedValue));
    return found.length === 0 ? [] : [{ key, requested: requestedValue, found }];
  });
}

function formatContextFacetWarning(warning: ContextFacetWarning): string {
  return `preferred_context_mismatch: ${warning.key}=${warning.requested}; found=${warning.found.join(",")}`;
}
function facetsCompatible(
  facets: Chunk["facets"],
  requested?: Record<string, string>,
  text = "",
  allowUnknown = false,
): boolean {
  if (requested === undefined) return true;
  return Object.entries(requested).every(([key, value]) => {
    const values = facets.filter((facet) => facet.key === key).map((facet) => facet.value);
    if (values.length > 0) return values.includes(value);
    return allowUnknown || containsFacetValue(text, value);
  });
}

function scopedFacetsForChunks(page: DocPage, chunks: Chunk[]): Chunk["facets"] {
  const chunkFacets = chunks.flatMap((chunk) => chunk.facets);
  const chunkKeys = new Set(chunkFacets.map((facet) => facet.key));
  return [
    ...page.facets.filter((facet) => !chunkKeys.has(facet.key)),
    ...chunkFacets,
  ];
}

function containsFacetValue(text: string, value: string): boolean {
  const normalizedText = normalizeFacetText(text);
  const normalizedValue = normalizeFacetText(value);
  if (normalizedText.length === 0 || normalizedValue.length === 0) return false;
  return ` ${normalizedText} `.includes(` ${normalizedValue} `) || normalizedText.includes(normalizedValue);
}

function confidenceFor(pack: TaskPack | undefined, chunks: RankedChunk[], steps: number, examples: number): "high" | "medium" | "low" {
  if (pack?.confidence === "high" && steps >= 2 && (examples > 0 || chunks.length >= 2)) return "high";
  if (pack?.confidence === "low" || steps === 0) return "low";
  return chunks.length >= 2 || examples > 0 ? "medium" : "low";
}

function sourceBackedHints(ranked: RankedChunk[], examples: Array<{ value: string }>): string[] {
  const text = [
    ...ranked.map(({ chunk }) => chunk.text),
    ...examples.map((example) => example.value),
  ].join("\n");
  return [
    /\b(?:do|while|for\s+await|while)\b[\s\S]{0,200}\b(?:next|cursor|token|page|more)[\p{L}\p{N}_-]*\b/iu.test(text)
      ? "Use the loop pattern shown in the cited source until the documented next-page marker is empty."
      : undefined,
    /\b(?:from\(|new\s+\w*Client\()/i.test(text)
      ? "Initialize the client or wrapper as shown in the examples."
      : undefined,
  ].filter((hint): hint is string => hint !== undefined);
}

function stripCode(value: string): string {
  return value.replace(/```[\s\S]*?```/g, "Code example available.").replace(/^>\s?/gm, "");
}

function excerpt(value: string, max = 220): string {
  const compact = oneLine(value);
  return compact.length <= max ? compact : `${compact.slice(0, Math.max(0, max - 3))}...`;
}

function isUsableCodeExample(value: string, language?: string): boolean {
  const trimmed = value.trimStart();
  const normalizedLanguage = language?.toLowerCase();
  if (normalizedLanguage === "mermaid" || ["md", "mdx", "markdown", "txt", "text"].includes(normalizedLanguage ?? "")) return false;
  return trimmed.length > 0
    && !/```/.test(value)
    && !/^:::/.test(trimmed)
    && !(language === undefined && /^</.test(trimmed))
    && !/^(?:<[A-Z][A-Za-z]+|<CodeGroup|<Accordion|#{1,6}\s)/.test(trimmed)
    && (language !== undefined || /\b(?:import|export|const|let|var|function|class|await|new)\b/.test(value));
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function queryTextFor(goal: string, task?: string): string {
  return task === undefined ? goal : `${goal} ${task}`;
}

function taskTextFor(goal: string, task?: string): string {
  return queryTextFor(goal, task).trim();
}

function positiveQueryText(value: string): string {
  return value
    .replace(/\b(?:do\s+not|don't|never|avoid|without|instead\s+of)\b[^.!?;\n]*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function exactAnchorScore(value: string, query: string): number {
  return exactAnchorScoreWithAnchors(value, highSignalAnchors(query));
}

function highSignalAnchors(query: string): string[] {
  return stableUnique([
    ...(query.match(/`([^`]+)`/g) ?? []).map((item) => item.slice(1, -1)),
    ...(query.match(/@[a-z0-9._-]+\/[a-z0-9._-]+/gi) ?? []),
    ...(query.match(/\bv\d+(?:\.\d+)*\b/gi) ?? []),
    ...(query.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) ?? []),
    ...(query.match(/\b[A-Z][A-Za-z0-9.-]{3,}\b/g) ?? []),
    ...(query.match(/\b[A-Za-z_$][\w$]*\s*\(\s*\)/g) ?? []).map((item) => item.replace(/\s*\(\s*\)$/, "")),
    ...(query.match(/\.[A-Za-z_$][\w$]*/g) ?? []).map((item) => item.slice(1)),
  ].filter((item) => item.length > 2 && !new Set(["Create", "Set", "Use", "The", "This", "Current", "Node"] as string[]).has(item)));
}

function exactAnchorScoreWithAnchors(value: string, anchors: string[]): number {
  const normalizedValue = normalizeFacetText(value);
  return anchors.reduce((score, anchor) => {
    const normalizedAnchor = normalizeFacetText(anchor);
    return score + (normalizedAnchor.length > 0 && normalizedValue.includes(normalizedAnchor) ? 1 : 0);
  }, 0);
}

function isRelevantPackEvidence(value: string, query: string): boolean {
  const positive = positiveQueryText(query);
  return exactAnchorScore(value, positive) > 0 || scoreTerms(value, positive) >= 3;
}

function containsTerm(value: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escaped}(?:$|[^\\p{L}\\p{N}_])`, "iu").test(value);
}

function containsRequirement(value: string, requirement: string): boolean {
  const normalizedValue = normalizeFacetText(value);
  const normalizedRequirement = normalizeFacetText(requirement);
  if (normalizedRequirement.length === 0) return false;
  if (normalizedValue.includes(normalizedRequirement)) return true;
  return meaningfulTerms(normalizedRequirement).every((term) => containsTerm(normalizedValue, term));
}

function scoreTerms(value: string, query: string): number {
  const queryTerms = stableUnique(tokenize(query));
  if (queryTerms.length === 0) return 0;
  return scoreTokenizedTerms(tokenize(value), queryTerms, value, query);
}

function scoreTokenizedTerms(valueTokens: string[], queryTerms: string[], value: string, query: string): number {
  if (queryTerms.length === 0) return 0;
  
  let score = 0;
  let matchedTerms = 0;
  
  for (const term of queryTerms) {
    const matches = valueTokens.filter((t) => t === term || t.startsWith(term));
    if (matches.length > 0) {
      matchedTerms++;
      // Specificity bonus: longer terms are more specific
      const specificityWeight = Math.min(term.length / 4, 3);
      // Cap frequency contribution to avoid verbose-text inflation
      score += Math.min(matches.length, 2) * specificityWeight;
    }
  }
  
  // Coverage ratio: what fraction of query terms matched?
  const coverage = matchedTerms / queryTerms.length;
  score *= (0.5 + coverage * 0.5);  // Scale by coverage
  
  // Exact substring bonus (keep but only for short queries)
  if (query.trim().length <= 40 && value.toLowerCase().includes(query.trim().toLowerCase())) {
    score += 5;
  }
  
  return score;
}

function tokenize(value: string): string[] {
  return value.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_./:@-]*/gu) ?? [];
}

function stableUnique(values: string[]): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function stableUniqueBy<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const value of values) {
    const id = key(value);
    if (seen.has(id)) continue;
    seen.add(id);
    output.push(value);
  }
  return output;
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function estimateTokens(value: string): number {
  return Math.ceil(value.length / 4);
}

function finalizeQueryResponse(
  value: Omit<QueryDocsResponse, "estimatedTokens">,
): QueryDocsResponse {
  const safeValue = value.codeExamples.length === 0 && value.readiness.recommendation === "implement"
    ? {
        ...value,
        readiness: {
          ...value.readiness,
          recommendation: "inspect" as const,
          coverage: "partial" as const,
          issueCodes: stableUnique([...value.readiness.issueCodes, "no_canonical_code_examples"]),
        },
      }
    : value;
  return QueryDocsResponseSchema.parse({
    ...safeValue,
    estimatedTokens: estimateTokens(JSON.stringify(safeValue)),
  });
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requiredTaskPackMarkdown(pack: TaskPack, markdown: string | undefined): string {
  if (markdown === undefined) {
    throw new Error(`Task-pack Markdown for "${pack.id}" is required to build a context bundle.`);
  }
  return markdown;
}

function readinessFromQueryWarnings(
  warnings: string[],
  steps: number,
  codeExamples: number,
): ContextReadiness {
  const issueCodes = stableUnique(warnings.map(queryWarningCode).filter((code): code is string => code !== undefined));
  const hasCriticalSignal = issueCodes.some((code) =>
    code === "preferred_context_mismatch" || code === "context_conflict" || code === "mixed_search_context");
  return {
    recommendation: hasCriticalSignal ? "stop" : warnings.length === 0 && steps > 0 && codeExamples > 0 ? "implement" : "inspect",
    coverage: warnings.length === 0 && steps > 0 && codeExamples > 0 ? "complete" : "unknown",
    issueCodes,
    gaps: [],
  };
}

function queryWarningCode(warning: string): string | undefined {
  if (warning.startsWith("preferred_context_mismatch:")) return "preferred_context_mismatch";
  if (warning.startsWith("context_conflict:")) return "context_conflict";
  if (warning.startsWith("ambiguous_task_selection:")) return "ambiguous_task_selection";
  if (warning.startsWith("intent_evidence_mismatch:")) return "intent_evidence_mismatch";
  if (warning === "Evidence is weak.") return "weak_evidence";
  if (warning === "No source-backed steps found.") return "missing_source_steps";
  if (warning === "No canonical code examples found.") return "no_canonical_code_examples";
  return undefined;
}

function assessTaskRequirements(options: {
  task: string;
  explicitFacets?: Record<string, string>;
  requestedFacets?: Record<string, string>;
  selectedPack?: TaskPack;
  query: QueryDocsResponse;
  candidateEvidenceFor?: (requirement: Pick<RequirementAssessment, "kind" | "value">) => Evidence[];
  corpusTerms?: string[];
}): RequirementAssessment[] {
  const requirements: Array<{ kind: RequirementAssessment["kind"]; value: string; source: RequirementAssessment["source"] }> = [];
  for (const [key, value] of Object.entries(options.requestedFacets ?? {})) {
    requirements.push({
      kind: "facet",
      value: `${key}=${value}`,
      source: options.explicitFacets?.[key] === value ? "explicit" : "inferred",
    });
  }
  for (const value of extractCodeLikeRequirements(options.task)) {
    requirements.push({ kind: value.kind, value: value.value, source: "explicit" });
  }
  for (const value of options.corpusTerms ?? []) {
    const matches = value.startsWith("@")
      ? normalizeFacetText(options.task).includes(normalizeFacetText(value))
      : containsTerm(options.task, value);
    if (value.length > 3 && matches) {
      requirements.push({ kind: "symbol", value, source: "explicit" });
    }
  }
  for (const value of extractConstraintRequirements(options.task)) {
    requirements.push({ kind: "constraint", value, source: "explicit" });
  }
  for (const value of extractConceptRequirements(options.task)) {
    requirements.push({ kind: "constraint", value, source: "explicit" });
  }

  const evidence = [
    ...options.query.steps.flatMap((step) => step.evidence.map((item) => ({ text: `${step.title} ${step.text}`, evidence: [item] }))),
    ...options.query.codeExamples.map((example) => ({ text: example.value, evidence: example.evidence })),
    ...options.query.gotchas.map((gotcha) => ({ text: gotcha.text, evidence: gotcha.evidence })),
  ];
  return stableUniqueBy(requirements.map((requirement) => {
    if (requirement.kind === "facet") {
      const [key, value] = requirement.value.split("=", 2);
      const values = options.selectedPack?.context.facets[key!] ?? [];
      const matching = options.selectedPack?.context.conflicts
        .filter((conflict) => conflict.key === key && conflict.values.includes(value!))
        .flatMap((conflict) => conflict.evidence) ?? [];
      if (values.some((candidate) => candidate !== value)) {
        return requirementAssessment(requirement, "contradicted", `Selected context contradicts ${requirement.value}.`, matching);
      }
      if (values.includes(value!)) {
        return requirementAssessment(requirement, "covered", `Selected context covers ${requirement.value}.`, options.selectedPack?.evidence ?? []);
      }
      const textualMatches = evidence.filter((candidate) => containsFacetValue(candidate.text, value!));
      if (textualMatches.length > 0) {
        return requirementAssessment(requirement, "covered", `Selected source evidence mentions ${requirement.value}.`, textualMatches.flatMap((candidate) => candidate.evidence));
      }
      return requirementAssessment(requirement, "unknown", `No facet evidence found for ${requirement.value}.`, []);
    }

    const matches = evidence.filter((candidate) => requirementMatches(requirement.value, candidate.text, requirement.kind));
    if (matches.length > 0) {
      return requirementAssessment(requirement, "covered", `Selected source evidence covers "${requirement.value}".`, matches.flatMap((candidate) => candidate.evidence));
    }
    if (requirement.kind === "constraint") {
      if (isNegativeConstraint(requirement.value)) {
        return requirementAssessment(
          requirement,
          "unknown",
          `Negative constraint "${requirement.value}" requires manual verification against the cited source.`,
          [],
        );
      }
      const terms = meaningfulTerms(requirement.value);
      const matchedTerms = terms.filter((term) => evidence.some((candidate) => candidate.text.toLowerCase().includes(term)));
      if (matchedTerms.length > 0) {
        const candidates = options.candidateEvidenceFor?.(requirement) ?? [];
        return requirementAssessment(
          requirement,
          "partial",
          `Selected evidence only partially covers "${requirement.value}"; inspect the most specific source candidate.`,
          candidates.length > 0 ? candidates : evidence.flatMap((candidate) => candidate.evidence),
        );
      }
    }
    const candidates = options.candidateEvidenceFor?.(requirement) ?? [];
    if (candidates.length > 0) {
      return requirementAssessment(requirement, "partial", `Candidate source evidence exists for "${requirement.value}"; inspect it before implementing.`, candidates);
    }
    return requirementAssessment(requirement, "missing", `No selected source evidence found for "${requirement.value}".`, []);
  }), (requirement) => `${requirement.kind}:${requirement.value}`);
}

function isNegativeConstraint(value: string): boolean {
  return /\b(?:do\s+not|don't|never|avoid|without|instead\s+of)\b/i.test(value);
}

function requirementAssessment(
  requirement: { kind: RequirementAssessment["kind"]; value: string; source: RequirementAssessment["source"] },
  status: RequirementAssessment["status"],
  message: string,
  evidence: Evidence[],
): RequirementAssessment {
  return { ...requirement, status, message, evidence: compactEvidence(evidence) };
}

function extractCodeLikeRequirements(task: string): Array<{ kind: "symbol" | "configuration"; value: string }> {
  const values = [
    ...(task.match(/`([^`]+)`/g) ?? []).map((value) => value.slice(1, -1)),
    ...(task.match(/@[a-z0-9._-]+\/[a-z0-9._-]+/gi) ?? []),
    ...(task.match(/\bv\d+(?:\.\d+)*\b/gi) ?? []),
    ...(task.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) ?? []),
    ...(task.match(/\b[A-Za-z_$][\w$]*\s*\(/g) ?? []).map((value) => value.replace(/\s*\($/, "")),
    ...(task.match(/--[a-z0-9-]+/gi) ?? []),
  ].map((value) => value.replace(/\(\)$/, ""))
    .filter((value) => !value.includes("/") || value.startsWith("@"));
  const genericAcronyms = new Set(["API", "HTTP", "HTTPS", "URL", "SDK", "JSON", "SQL"]);
  return stableUniqueBy(values.map((value) => ({
    kind: /^(?:[A-Z][A-Z0-9_]{2,}|--)/.test(value) ? "configuration" as const : "symbol" as const,
    value,
  })), (value) => `${value.kind}:${value.value}`)
    .filter((value) => (value.value.length > 2 || /^v\d/i.test(value.value)) && !genericAcronyms.has(value.value));
}

function extractConstraintRequirements(task: string): string[] {
  const constraints: string[] = [];
  const pattern = /\b(?:must|should|required to|requires|only|without|do not|never)\b([^.!?\n]+)/gi;
  for (const match of task.matchAll(pattern)) {
    const value = match[0]?.trim();
    if (value !== undefined && meaningfulTerms(value).length >= 2) constraints.push(value);
  }
  return stableUnique(constraints);
}

function extractConceptRequirements(task: string): string[] {
  const tokens = task.match(/[A-Za-z0-9@._/-]+/g) ?? [];
  const anchors = new Set([
    "provider", "adapter", "handler", "invocation", "signature", "webhook", "event",
    "model", "package", "client", "route", "action", "session", "body",
  ]);
  const ignored = new Set([
    "a", "an", "and", "the", "current", "documented", "legacy", "modular", "plain",
    "use", "using", "with", "for", "to", "in", "of", "from", "this", "that",
  ]);
  const values: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    const normalized = token.toLowerCase();
    const next = tokens[index + 1]?.toLowerCase();
    if (normalized === "server" && next === "action") {
      values.push("server action");
      continue;
    }
    if (!anchors.has(normalized)) continue;
    const previous = tokens[index - 1];
    const previousNormalized = previous?.toLowerCase();
    if (previous === undefined || previousNormalized === undefined || ignored.has(previousNormalized)) continue;
    values.push(`${previous} ${token}`);
  }
  return stableUnique(values.map((value) => value.trim()).filter((value) => meaningfulTerms(value).length >= 2));
}

function requirementMatches(value: string, text: string, kind: RequirementAssessment["kind"]): boolean {
  if (kind === "constraint") {
    const terms = meaningfulTerms(value);
    return terms.length > 0 && terms.every((term) => containsTerm(text, term));
  }
  return containsRequirement(text, value);
}

function meaningfulTerms(value: string): string[] {
  const ignored = new Set(["the", "and", "with", "that", "this", "must", "should", "using", "use", "only", "requires", "required", "without", "from", "into", "for", "return", "write", "create", "do", "not", "never"]);
  return stableUnique(tokenize(value).filter((term) => term.length > 2 && !ignored.has(term)));
}

function issueForQueryWarning(
  warning: string,
  pack: TaskPack | undefined,
): ContextVerification["issues"][number] | undefined {
  if (warning === "No canonical code examples found.") {
    return {
      code: "no_canonical_code_examples",
      severity: "warning",
      message: warning,
      evidence: pack?.evidence ?? [],
    };
  }
  if (warning === "No source-backed steps found.") {
    return {
      code: "missing_source_steps",
      severity: "critical",
      message: warning,
      evidence: pack?.evidence ?? [],
    };
  }
  if (warning === "Evidence is weak.") {
    return {
      code: "weak_evidence",
      severity: "warning",
      message: pack === undefined ? "Evidence is weak." : `Task pack "${pack.id}" has low confidence.`,
      evidence: pack?.evidence ?? [],
    };
  }
  if (warning.startsWith("ambiguous_task_selection:")) {
    return {
      code: "ambiguous_task_selection",
      severity: "warning",
      message: warning,
      evidence: pack?.evidence ?? [],
    };
  }
  if (warning.startsWith("intent_evidence_mismatch:")) {
    return {
      code: "intent_evidence_mismatch",
      severity: "warning",
      message: warning,
      evidence: pack?.evidence ?? [],
    };
  }
  if (warning.startsWith("preferred_context_mismatch:")) {
    return {
      code: "preferred_context_mismatch",
      severity: "critical",
      message: warning,
      evidence: pack?.evidence ?? [],
    };
  }
  return undefined;
}

function evidenceRole(
  title: string,
  headingPath: string[],
  value: string,
): "prerequisite" | "setup" | "implementation" | "validation" | "gotcha" | "evidence" {
  const text = `${title} ${headingPath.join(" ")} ${value}`.toLowerCase();
  if (/warning|caution|important|never|avoid|troubleshoot|error|failure/.test(text)) return "gotcha";
  if (/prerequisite|before you begin|requirement|credential|authenticate|authentication|permission/.test(text)) return "prerequisite";
  if (/install|setup|set up|configure|configuration|initialize/.test(text)) return "setup";
  if (/verify|validate|test|confirm|check|result|output/.test(text)) return "validation";
  if (/create|implement|build|deploy|upload|update|call|request|example/.test(text)) return "implementation";
  return "evidence";
}
