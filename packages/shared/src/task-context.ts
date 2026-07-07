import {
  ContextBundleSchema,
  ContextVerificationSchema,
  HandoffBundleSchema,
  QueryDocsResponseSchema,
  ReadPageResponseSchema,
  type AgentMap,
  type Chunk,
  type ContextBundle,
  type ContextVerification,
  type DocPage,
  type Evidence,
  type HandoffBundle,
  type QueryDocsResponse,
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
  limit?: number;
  search?: SearchResponse;
};

export type ReadPageOptions = {
  pageId?: string;
  chunkId?: string;
  heading?: string;
  maxChars?: number;
  fullPage?: boolean;
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
  limit?: number;
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

const DEFAULT_SECTION_MAX_CHARS = 1000;

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

  constructor(private readonly options: TaskContextAssemblerOptions) {
    this.pages = new Map(options.agentMap.pages.map((page) => [page.id, page]));
    this.chunks = new Map(options.agentMap.chunks.map((chunk) => [chunk.id, chunk]));
  }

  async resolveContextDecision(options: ResolveContextDecisionOptions): Promise<ContextDecision> {
    const taskPackId = options.task === undefined
      ? undefined
      : this.options.agentMap.taskPacks.some((pack) => pack.id === options.task)
        ? options.task
        : undefined;
    const searchQuery = options.task === undefined || taskPackId !== undefined
      ? options.goal
      : `${options.goal}\n${options.task}`;
    const searchLimit = Math.max(options.limit ?? 12, 8);
    const initialSearch = await options.search({
      query: searchQuery,
      limit: searchLimit,
      task: taskPackId,
      facets: options.facets,
    });
    const initialDecision = this.buildContextDecision({
      goal: options.goal,
      task: options.task,
      facets: options.facets,
      freshness: options.freshness,
      limit: options.limit,
      search: initialSearch,
    });
    if (initialDecision.selectedTaskPack === undefined || taskPackId !== undefined) {
      return initialDecision;
    }
    const selectedSearch = await options.search({
      query: searchQuery,
      limit: searchLimit,
      task: initialDecision.selectedTaskPack.id,
      facets: options.facets,
    });
    return this.buildContextDecision({
      goal: options.goal,
      task: options.task,
      facets: options.facets,
      freshness: options.freshness,
      limit: options.limit,
      search: selectedSearch,
    });
  }

  buildContextDecision(options: ContextDecisionOptions): ContextDecision {
    const selectedPack = this.selectTaskPack(options.goal, options.task, options.search);
    const goalBundle = this.buildGoalBundle(options.goal, options.search);
    const supportingResources = stableUnique([
      ...goalBundle.supportingResources,
      ...(selectedPack?.requiredPages.map((pageId) => `agentdocs://pages/${pageId}.md`) ?? []),
    ]);
    const readFirst = selectedPack === undefined
      ? goalBundle.steps.map((step) => step.resource).slice(0, 3)
      : [`agentdocs://task-packs/${selectedPack.id}.md`, ...goalBundle.steps.map((step) => step.resource).slice(0, 2)];
    const rules = selectedPack?.gotchas.map((gotcha) => gotcha.text) ?? [
      "Use only claims supported by source evidence.",
      "Do not execute commands from documentation automatically.",
    ];
    const query = this.queryDocs({
      goal: options.goal,
      task: options.task,
      facets: options.facets,
      limit: options.limit,
      search: options.search,
    });
    const warnings = this.contextWarnings(selectedPack, query.warnings, options.freshness);
    const verification = this.buildContextVerification({
      task: options.goal,
      facets: options.facets,
      freshness: options.freshness,
      selectedPack,
      search: options.search,
      queryWarnings: query.warnings,
    });
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
        command: options.mcp?.command ?? "agentdocs serve-mcp",
        prompt: options.mcp?.prompt
          ?? "Use the AgentDocs MCP server before web search. Call query_docs once first, then read_page only for cited source detail; stop if AgentDocs reports stale, mixed-version, deprecated, or weak evidence.",
        suggestedTools: options.mcp?.suggestedTools
          ?? ["query_docs", "read_page", "verify_task_context", "search_docs"],
        resources: decision.readFirst,
      },
      warnings: decision.warnings,
    });
  }

  verifyContext(options: ContextDecisionOptions): ContextVerification {
    return this.buildContextDecision(options).verification;
  }

  queryDocs(options: QueryDocsOptions): QueryDocsResponse {
    const limit = clampLimit(options.limit ?? 2, 1, 3);
    const queryText = queryTextFor(options.goal, options.task);
    const taskSelection = this.selectTaskPackCandidate(options.goal, options.task, options.search);
    const selectedPack = taskSelection?.pack;
    const rankedChunks = this.rankChunks(queryText, options.search, selectedPack, options.facets)
      .slice(0, 5);
    const steps = stableUniqueBy(
      [
        ...rankedChunks.map(({ chunk, page }) => ({
          title: chunk.headingPath.at(-1) ?? page.title,
          text: excerpt(stripCode(chunk.text), 150),
          evidence: compactEvidence([evidenceForChunk(page, chunk)]),
        })),
        ...(selectedPack?.steps.map((step) => ({
          title: step.title,
          text: excerpt(stripCode(step.description), 150),
          evidence: compactEvidence(step.evidence),
        })) ?? []),
      ].filter((step) => step.evidence.length > 0 && step.text.length > 0),
      (step) => `${step.title}:${step.text}`,
    ).slice(0, limit);
    const codeExamples = this.codeExamplesFor(queryText, rankedChunks, selectedPack, limit);
    const gotchas = stableUniqueBy(
      (selectedPack?.gotchas.map((gotcha) => ({
        ...gotcha,
        text: excerpt(gotcha.text, 150),
        evidence: compactEvidence(gotcha.evidence),
      })) ?? []),
      (gotcha) => `${gotcha.severity}:${gotcha.text}`,
    ).slice(0, 2);
    const citations = stableUniqueBy(
      [
        ...steps.flatMap((step) => step.evidence),
        ...codeExamples.flatMap((example) => example.evidence),
        ...gotchas.flatMap((gotcha) => gotcha.evidence),
      ].map((evidence, index) => citationForEvidence(evidence, index + 1)),
      (citation) => citation.id,
    );
    const warnings = [
      selectedPack?.confidence === "low" ? "Evidence is weak." : undefined,
      steps.length === 0 ? "No source-backed steps found." : undefined,
      codeExamples.length === 0 ? "No canonical code examples found." : undefined,
      ...(taskSelection?.warnings ?? []),
      ...(options.search?.warnings.map((warning) =>
        `${warning.code}: ${warning.key}=${warning.values.join(",")}`) ?? []),
    ].filter((warning): warning is string => warning !== undefined);
    const confidence = confidenceFor(selectedPack, rankedChunks, steps.length, codeExamples.length);
    const shouldIncludeFollowUpRefs = confidence === "low" || warnings.length > 0 || steps.length === 0;
    const followUpRefs = shouldIncludeFollowUpRefs
      ? stableUniqueBy(
        rankedChunks.map(({ chunk, page }) => ({
          type: "chunk" as const,
          ref: `agentdocs://pages/${page.id}.md#${chunk.id}`,
          pageId: page.id,
          chunkId: chunk.id,
          title: chunk.headingPath.at(-1) ?? page.title,
          sourceUrl: page.canonicalUrl ?? page.sourceUrl,
          repoPath: page.repoPath,
        })),
        (ref) => ref.chunkId,
      ).slice(0, 1)
      : [];
    const implementationHints = sourceBackedHints(rankedChunks, codeExamples);
    const answer = [
      selectedPack === undefined
        ? `Found ${steps.length} source-backed item(s) for "${options.goal}".`
        : `Use the ${selectedPack.title} task context for "${options.goal}".`,
      ...implementationHints,
      confidence === "low"
        ? "Evidence is weak; use the cited sources before implementing."
        : steps.length > 0 || codeExamples.length > 0
          ? "The steps and code examples below are sufficient to implement unless your task needs detail not covered here."
        : undefined,
    ].filter(Boolean).join(" ");
    return QueryDocsResponseSchema.parse({
      goal: options.goal,
      task: selectedPack?.id ?? options.task,
      answer,
      confidence,
      steps,
      codeExamples,
      gotchas,
      citations: citations.slice(0, 4),
      followUpRefs,
      warnings,
      estimatedTokens: estimateTokens(JSON.stringify({
        answer,
        steps,
        codeExamples,
        gotchas,
        citations: citations.slice(0, 4),
        followUpRefs,
        warnings,
      })),
    });
  }

  readPage(options: ReadPageOptions): ReadPageResponse {
    const maxChars = clampLimit(options.maxChars ?? 4000, 1, 50000);
    const selected = this.selectReadableSection(options);
    const effectiveMaxChars = selected.chunk === undefined
      ? maxChars
      : Math.min(maxChars, DEFAULT_SECTION_MAX_CHARS);
    const truncated = selected.text.length > effectiveMaxChars;
    const text = truncated ? selected.text.slice(0, effectiveMaxChars) : selected.text;
    return ReadPageResponseSchema.parse({
      section: {
        pageId: selected.page.id,
        chunkId: selected.chunk?.id,
        title: selected.title ?? selected.chunk?.headingPath.at(-1) ?? selected.page.title,
        headingPath: selected.headingPath ?? selected.chunk?.headingPath ?? [],
        sourceUrl: selected.page.canonicalUrl ?? selected.page.sourceUrl,
        repoPath: selected.page.repoPath,
        text,
        truncated,
        evidence: selected.evidence ?? (selected.chunk === undefined
          ? [{ source: "page", pageId: selected.page.id, url: selected.page.canonicalUrl ?? selected.page.sourceUrl, repoPath: selected.page.repoPath }]
          : [evidenceForChunk(selected.page, selected.chunk)]),
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
        const evidenceBoost = evidenceShapeScoreForTask(pack, queryText, this.options.agentMap);
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
      title: result.headingPath.at(-1) ?? result.title,
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
        severity: "critical",
        message: "No matching task pack was found for this task.",
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
      for (const [key, value] of Object.entries(options.facets ?? {})) {
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
    const status = issues.some((issue) => issue.severity === "critical")
      ? "fail"
      : issues.length > 0
        ? "warn"
        : "pass";
    return ContextVerificationSchema.parse({
      schemaVersion: 1,
      task: options.task,
      status,
      summary: status === "pass"
        ? "Context is safe to use for this task."
        : status === "fail"
          ? "Context has critical issues. Stop and refresh or narrow context before using it."
          : "Context has warnings. Review before using it.",
      issues,
      freshness: options.freshness,
    });
  }

  private rankChunks(
    goal: string,
    search: SearchResponse | undefined,
    pack: TaskPack | undefined,
    facets: Record<string, string> | undefined,
  ): RankedChunk[] {
    const byId = new Map<string, number>();
    for (const [index, result] of (search?.results ?? []).entries()) {
      byId.set(result.chunkId, Math.max(4, 24 - index * 2));
    }
    const packText = pack === undefined ? "" : taskPackSearchText(pack);
    return this.options.agentMap.chunks
      .map((chunk) => {
        const page = this.pages.get(chunk.pageId);
        if (page === undefined) return undefined;
        if (!facetsCompatible(chunk.facets, facets)) return undefined;
        const lexical = scoreTerms(`${page.title} ${chunk.headingPath.join(" ")} ${chunk.text}`, goal);
        const score = (byId.get(chunk.id) ?? 0)
          + lexical
          + (packText.length > 0 && scoreTerms(`${chunk.headingPath.join(" ")} ${chunk.text}`, packText) > 0 ? 1 : 0);
        return { chunk, page, score };
      })
      .filter((item): item is RankedChunk => item !== undefined && item.score > 0)
      .sort((left, right) => right.score - left.score || compareStrings(left.chunk.id, right.chunk.id));
  }

  private codeExamplesFor(goal: string, ranked: RankedChunk[], pack: TaskPack | undefined, limit: number) {
    const rankedChunkIds = new Set(ranked.map(({ chunk }) => chunk.id));
    const rankedPageIds = new Set(ranked.map(({ page }) => page.id));
    const examples = this.options.agentMap.pages.flatMap((page) =>
      page.codeBlocks.map((block) => {
        const headingPath = headingPathFor(page, block.sourceHeadingId);
        const relatedChunk = this.options.agentMap.chunks.find((chunk) =>
          chunk.pageId === page.id
          && (headingPath.length === 0 || arraysEqual(chunk.headingPath, headingPath)));
        const packMatch = pack?.codeExamples.some((example) => oneLine(example) === oneLine(block.value)) ?? false;
        const score = scoreTerms(`${page.title} ${headingPath.join(" ")} ${block.value}`, goal)
          + (rankedPageIds.has(page.id) ? 6 : 0)
          + (relatedChunk !== undefined && rankedChunkIds.has(relatedChunk.id) ? 10 : 0)
          + (packMatch ? 4 : 0);
        return {
          language: block.language,
          value: excerptCode(block.value, 600),
          evidence: compactEvidence([{
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
      .filter((example) => example.score > 0)
      .sort((left, right) => right.score - left.score || compareStrings(left.value, right.value));
    return stableUniqueBy(examples, (example) => oneLine(example.value))
      .slice(0, 1)
      .map(({ score: _score, ...example }) => example);
  }

  private selectReadableSection(options: ReadPageOptions): {
    page: DocPage;
    chunk?: Chunk;
    text: string;
    evidence?: Evidence[];
    title?: string;
    headingPath?: string[];
  } {
    if (options.chunkId !== undefined) {
      // 1. Try chunk ID
      const chunk = this.chunks.get(options.chunkId);
      if (chunk !== undefined) {
        const page = this.pages.get(chunk.pageId);
        if (page === undefined) throw new Error(`Page "${chunk.pageId}" was not found.`);
        return { page, chunk, text: chunk.text };
      }

      // 2. Try code block ID
      const code = this.findCodeBlock(options.chunkId);
      if (code !== undefined) {
        return {
          page: code.page,
          text: code.block.value,
          title: "Code example",
          headingPath: headingPathFor(code.page, code.block.sourceHeadingId),
          evidence: compactEvidence([{
            source: "code_block",
            pageId: code.page.id,
            headingId: code.block.sourceHeadingId,
            codeBlockId: code.block.id,
            url: code.page.canonicalUrl ?? code.page.sourceUrl,
            repoPath: code.page.repoPath,
            quote: code.block.value,
          }]),
        };
      }

      // 3. Try heading ID
      const headingRef = this.findHeadingRef(options.chunkId);
      if (headingRef !== undefined) {
        return headingRef;
      }

      // 4. Try page ID (fallback in case pageId was passed as chunkId)
      const page = this.pages.get(options.chunkId);
      if (page !== undefined) {
        if (options.fullPage === true) {
          return { page, text: page.markdown };
        }
        const pageChunks = this.options.agentMap.chunks.filter((c) => c.pageId === page.id);
        const normalizedHeading = options.heading?.toLowerCase();
        const chunk = normalizedHeading === undefined
          ? pageChunks[0]
          : pageChunks.find((candidate) =>
            candidate.headingPath.some((heading) => heading.toLowerCase() === normalizedHeading)
            || candidate.headingPath.join(" ").toLowerCase().includes(normalizedHeading));
        if (chunk === undefined) {
          return { page, text: excerpt(page.markdown, 4000) };
        }
        return { page, chunk, text: chunk.text };
      }

      throw new Error(`Chunk "${options.chunkId}" was not found.`);
    }

    if (options.pageId === undefined) {
      throw new Error("pageId or chunkId is required.");
    }

    // Treat pageId broadly as a unified reference ID
    // 1. Try chunk ID
    const chunk = this.chunks.get(options.pageId);
    if (chunk !== undefined) {
      const page = this.pages.get(chunk.pageId);
      if (page === undefined) throw new Error(`Page "${chunk.pageId}" was not found.`);
      return { page, chunk, text: chunk.text };
    }

    // 2. Try code block ID
    const code = this.findCodeBlock(options.pageId);
    if (code !== undefined) {
      return {
        page: code.page,
        text: code.block.value,
        title: "Code example",
        headingPath: headingPathFor(code.page, code.block.sourceHeadingId),
        evidence: compactEvidence([{
          source: "code_block",
          pageId: code.page.id,
          headingId: code.block.sourceHeadingId,
          codeBlockId: code.block.id,
          url: code.page.canonicalUrl ?? code.page.sourceUrl,
          repoPath: code.page.repoPath,
          quote: code.block.value,
        }]),
      };
    }

    // 3. Try heading ID
    const headingRef = this.findHeadingRef(options.pageId);
    if (headingRef !== undefined) {
      return headingRef;
    }

    // 4. Try page ID
    const page = this.pages.get(options.pageId);
    if (page === undefined) {
      throw new Error(`Page "${options.pageId}" was not found.`);
    }
    if (options.fullPage === true) {
      return { page, text: page.markdown };
    }
    const pageChunks = this.options.agentMap.chunks.filter((c) => c.pageId === page.id);
    const normalizedHeading = options.heading?.toLowerCase();
    const c = normalizedHeading === undefined
      ? pageChunks[0]
      : pageChunks.find((candidate) =>
        candidate.headingPath.some((heading) => heading.toLowerCase() === normalizedHeading)
        || candidate.headingPath.join(" ").toLowerCase().includes(normalizedHeading));
    if (c === undefined) {
      return { page, text: excerpt(page.markdown, 4000) };
    }
    return { page, chunk: c, text: c.text };
  }

  private findCodeBlock(codeBlockId: string) {
    for (const page of this.options.agentMap.pages) {
      const block = page.codeBlocks.find((candidate) => candidate.id === codeBlockId);
      if (block !== undefined) {
        return { page, block };
      }
    }
    return undefined;
  }

  private findHeadingRef(headingId: string) {
    for (const page of this.options.agentMap.pages) {
      const heading = page.headings.find((candidate) => candidate.id === headingId);
      if (heading !== undefined) {
        const pageChunks = this.options.agentMap.chunks.filter((chunk) => chunk.pageId === page.id);
        const chunk = pageChunks.find((candidate) => candidate.headingPath.at(-1) === heading.text) ?? pageChunks[0];
        if (chunk !== undefined) {
          return {
            page,
            chunk,
            text: chunk.text,
            title: heading.text,
            headingPath: chunk.headingPath,
            evidence: compactEvidence([{
              source: "heading",
              pageId: page.id,
              headingId: heading.id,
              url: page.canonicalUrl ?? page.sourceUrl,
              repoPath: page.repoPath,
            }]),
          };
        }
      }
    }
    return undefined;
  }
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

function compactEvidence(evidence: Evidence[]): Evidence[] {
  return evidence.map((item) => ({
    ...item,
    quote: item.quote === undefined ? undefined : excerpt(item.quote, 120),
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
  return [...path, target.text];
}

function taskPackSearchText(pack: TaskPack): string {
  return [
    pack.id,
    pack.title,
    pack.description,
    ...pack.steps.flatMap((step) => [step.title, step.description]),
    ...pack.gotchas.map((gotcha) => gotcha.text),
  ].join(" ").toLowerCase();
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

function negativeIntentConflict(packId: string, intents: Map<string, number>, query: string): number {
  const strongest = Math.max(0, ...intents.values());
  if (strongest < 10 || (intents.get(packId) ?? 0) > 0) return 0;
  if (packId === "errors" && /\b(?:create|build|implement|add|deploy|configure|install|test|paginate|authenticate)\b/i.test(query)) return -24;
  if (packId === "testing" && /\b(?:deploy|install|configure|authenticate|pagination|paginate|mutation|route|middleware)\b/i.test(query)) return -22;
  if (packId === "migration" && /\b(?:create|start|deploy|configure|authenticate|test|pagination|paginate|mutation|route|middleware)\b/i.test(query)) return -22;
  if (packId === "pagination" && /\b(?:auth|authentication|credential|rls|policy|environment|env|install|deploy|test|debug)\b/i.test(query)) return -20;
  if (packId === "quickstart" && /\b(?:configure|configuration|environment|env|auth|authentication|deploy|debug|test|pagination|paginate|migration|migrate)\b/i.test(query)) return -16;
  return -10;
}

function evidenceShapeScoreForTask(pack: TaskPack, query: string, agentMap: AgentMap): number {
  const text = taskPackSearchText(pack);
  const code = pack.codeExamples.join("\n");
  const pages = pack.requiredPages
    .map((pageId) => agentMap.pages.find((page) => page.id === pageId))
    .filter((page): page is DocPage => page !== undefined);
  const pageText = pages.map((page) => `${page.title} ${page.markdown}`).join("\n").toLowerCase();
  const combined = `${text}\n${code}\n${pageText}`;
  let score = 0;
  if (pack.id === "configuration" && /\b(?:config|configure|environment|env|option|properties)\b/i.test(query) && /\b(?:process\.env|environment|env|option|properties|config)\b/i.test(combined)) score += 8;
  if (pack.id === "authentication" && /\b(?:auth|authentication|credential|token|secret|rls|policy)\b/i.test(query) && /\b(?:auth|credential|token|secret|rls|policy|permission)\b/i.test(combined)) score += 8;
  if (pack.id === "deployment" && /\bdeploy\b|\bdeployment\b/i.test(query) && /\b(?:deploy|production|host|publish|worker|runtime)\b/i.test(combined)) score += 8;
  if (pack.id === "api-usage" && /\b(?:route|middleware|schema|validation|mutation|invalidate|workflow|pipeline|request|response)\b/i.test(query) && /\b(?:route|middleware|schema|validation|mutation|invalidate|workflow|pipeline|request|response|api|endpoint)\b/i.test(combined)) score += 8;
  if (pack.id === "quickstart" && /\b(?:quickstart|getting\s+started|create|start|initialize|bootstrap)\b/i.test(query) && /\b(?:quickstart|getting\s+started|create|start|initialize|bootstrap|hello|first)\b/i.test(combined)) score += 8;
  if (pack.id === "testing" && /\btest\b|\btesting\b/i.test(query) && /\b(?:test|testing|assert|expect|mock)\b/i.test(combined)) score += 8;
  if (pack.id === "errors" && /\b(?:debug|error|failure|troubleshoot|exception)\b/i.test(query) && /\b(?:debug|error|failure|troubleshoot|exception|retry)\b/i.test(combined)) score += 8;
  return score;
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

function facetsCompatible(facets: Chunk["facets"], requested?: Record<string, string>): boolean {
  if (requested === undefined) return true;
  return Object.entries(requested).every(([key, value]) => {
    const values = facets.filter((facet) => facet.key === key).map((facet) => facet.value);
    return values.length === 0 || values.includes(value);
  });
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

function excerptCode(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 36)).trimEnd()}\n/* ... truncated by AgentDocs ... */`;
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function queryTextFor(goal: string, task?: string): string {
  return task === undefined ? goal : `${goal} ${task}`;
}

function scoreTerms(value: string, query: string): number {
  const queryTerms = stableUnique(tokenize(query));
  if (queryTerms.length === 0) return 0;
  const valueTokens = tokenize(value);
  
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

function clampLimit(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function estimateTokens(value: string): number {
  return Math.ceil(value.length / 4);
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
