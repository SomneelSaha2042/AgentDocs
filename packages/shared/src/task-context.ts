import {
  QueryDocsResponseSchema,
  ReadPageResponseSchema,
  type AgentMap,
  type Chunk,
  type DocPage,
  type Evidence,
  type QueryDocsResponse,
  type ReadPageResponse,
  type SearchResponse,
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

type RankedChunk = {
  chunk: Chunk;
  page: DocPage;
  score: number;
};

const DEFAULT_SECTION_MAX_CHARS = 1000;

export class TaskContextAssembler {
  private readonly pages: Map<string, DocPage>;
  private readonly chunks: Map<string, Chunk>;

  constructor(private readonly options: TaskContextAssemblerOptions) {
    this.pages = new Map(options.agentMap.pages.map((page) => [page.id, page]));
    this.chunks = new Map(options.agentMap.chunks.map((chunk) => [chunk.id, chunk]));
  }

  queryDocs(options: QueryDocsOptions): QueryDocsResponse {
    const limit = clampLimit(options.limit ?? 2, 1, 3);
    const queryText = queryTextFor(options.goal, options.task);
    const selectedPack = this.selectTaskPack(options.goal, options.task, options.search);
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
    if (task !== undefined) {
      const exact = this.options.agentMap.taskPacks.find((pack) => pack.id === task);
      if (exact !== undefined) return exact;
    }
    const goalTerms = tokenize(goal.toLowerCase());
    const taskTerms = task !== undefined ? tokenize(task.toLowerCase()) : [];
    const allTerms = [...goalTerms, ...taskTerms];
    const searchPageScores = new Map<string, number>();
    for (const [index, result] of (search?.results ?? []).entries()) {
      searchPageScores.set(result.pageId, Math.max(searchPageScores.get(result.pageId) ?? 0, 16 - index));
    }

    return this.options.agentMap.taskPacks
      .map((pack) => {
        const searchText = taskPackSearchText(pack);
        const baseScore = scoreTerms(searchText, `${task ?? ""} ${goal}`.toLowerCase());
        const searchEvidenceScore = pack.requiredPages.reduce(
          (score, pageId) => score + (searchPageScores.get(pageId) ?? 0),
          0,
        );

        // Title/ID direct match bonus
        const titleTokens = tokenize(pack.title.toLowerCase());
        const titleBonus = allTerms.some((t) =>
          t === pack.id.toLowerCase() || titleTokens.includes(t)
        ) ? 10 : 0;

        // Penalty for generic packs when query has specific API terms
        const hasSpecificTerms = allTerms.some((t) => t.length >= 10);
        const packHasSpecificMatch = allTerms.some((q) => 
          q.length >= 10 && tokenize(searchText).some((t) => t === q || t.startsWith(q))
        );
        const genericPenalty = hasSpecificTerms && !packHasSpecificMatch ? -10 : 0;

        return { pack, score: baseScore + titleBonus + genericPenalty + searchEvidenceScore };
      })
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score || compareStrings(left.pack.id, right.pack.id))[0]?.pack;
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
