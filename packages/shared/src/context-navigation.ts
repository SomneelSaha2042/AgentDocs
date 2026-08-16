import type { AgentMap, Chunk, DocPage, Heading, Link } from "./models.js";
import type { ContextNavigation } from "./models.js";

export type ContextNavigationOptions = {
  relevantChunkIds?: readonly string[];
  requirementValues?: readonly string[];
  scopeRefs?: readonly string[];
  navigationCursor?: string;
};

export class ContextNavigationScopeError extends Error {
  override readonly name = "ContextNavigationScopeError";
}

type HeadingEntry = {
  heading: Heading;
  path: string[];
  index: number;
};

type PageIndex = {
  page: DocPage;
  headings: HeadingEntry[];
  headingByPath: Map<string, HeadingEntry>;
  headingById: Map<string, HeadingEntry>;
  chunks: Chunk[];
};

/**
 * Derives a compact navigation view from the built map without collecting or
 * executing anything. The catalog is deliberately serving-side: whether a
 * link is compiled depends on the complete corpus, not on one normalizer run.
 */
export class ContextNavigationCatalog {
  private readonly pages: Map<string, PageIndex>;
  private readonly chunks: Map<string, Chunk>;
  private readonly targetKeys: Set<string>;

  constructor(agentMap: AgentMap) {
    this.chunks = new Map(agentMap.chunks.map((chunk) => [chunk.id, chunk]));
    const chunksByPage = new Map<string, Chunk[]>();
    for (const chunk of agentMap.chunks) {
      const chunks = chunksByPage.get(chunk.pageId) ?? [];
      chunks.push(chunk);
      chunksByPage.set(chunk.pageId, chunks);
    }
    this.pages = new Map(agentMap.pages.map((page) => {
      const headings = headingEntries(page.headings);
      return [page.id, {
        page,
        headings,
        headingByPath: new Map(headings.map((entry) => [pathKey(entry.path), entry])),
        headingById: new Map(headings.map((entry) => [entry.heading.id, entry])),
        chunks: [...(chunksByPage.get(page.id) ?? [])].sort(compareChunks),
      }];
    }));
    this.targetKeys = new Set(
      agentMap.pages.flatMap((page) => [
        page.canonicalUrl,
        page.sourceUrl,
        page.repoPath,
      ]).filter((value): value is string => value !== undefined).map(targetKey),
    );
  }

  filterChunkIds(chunkIds: readonly string[], scopeRefs?: readonly string[]): string[] {
    const scope = this.resolveScope(scopeRefs);
    return chunkIds.filter((chunkId) => {
      const chunk = this.chunks.get(chunkId);
      return chunk !== undefined && scope.some((entry) => entry.pageId === chunk.pageId
        && (entry.headingPath === undefined || startsWithPath(chunk.headingPath, entry.headingPath)));
    });
  }

  filterPageIds(pageIds: readonly string[], scopeRefs?: readonly string[]): string[] {
    const scope = this.resolveScope(scopeRefs);
    return pageIds.filter((pageId) => scope.some((entry) => entry.pageId === pageId));
  }

  build(options: ContextNavigationOptions = {}): ContextNavigation {
    const scope = this.resolveScope(options.scopeRefs);
    const normalizedScopeRefs = options.scopeRefs === undefined || options.scopeRefs.length === 0
      ? []
      : scope.map((entry) => entry.ref);
    const requested = new Set(this.filterChunkIds(options.relevantChunkIds ?? [], options.scopeRefs));
    const pageOrder = new Map<string, number>();
    for (const [index, chunkId] of (options.relevantChunkIds ?? []).entries()) {
      const chunk = this.chunks.get(chunkId);
      if (chunk !== undefined && !pageOrder.has(chunk.pageId)) pageOrder.set(chunk.pageId, index);
    }

    const allBranches = [...this.pages.values()]
      .filter((index) => index.chunks.some((chunk) => requested.has(chunk.id)))
      .sort((left, right) =>
        (pageOrder.get(left.page.id) ?? Number.MAX_SAFE_INTEGER)
        - (pageOrder.get(right.page.id) ?? Number.MAX_SAFE_INTEGER)
        || compareStrings(left.page.id, right.page.id))
      .map((index) => this.buildBranch(index, requested, options.requirementValues ?? []));

    const offset = parseNavigationCursor(options.navigationCursor, allBranches.length);
    const branches = allBranches.slice(offset, offset + NAVIGATION_BRANCH_PAGE_SIZE);
    const nextOffset = offset + branches.length;

    return {
      scopeRefs: normalizedScopeRefs,
      branches,
      externalReferences: branches.flatMap((branch) => branch.externalReferences),
      complete: nextOffset >= allBranches.length,
      nextCursor: nextOffset >= allBranches.length ? undefined : formatNavigationCursor(nextOffset),
    };
  }

  private resolveScope(scopeRefs: readonly string[] | undefined): ScopeEntry[] {
    if (scopeRefs === undefined || scopeRefs.length === 0) return [...this.pages.values()].map((index) => ({
      ref: `agentdocs://pages/${index.page.id}.md`,
      pageId: index.page.id,
    }));
    return scopeRefs.map((ref) => {
      const match = /^agentdocs:\/\/pages\/([a-zA-Z0-9_-]+)\.md(?:#([a-zA-Z0-9_-]+))?$/.exec(ref);
      if (match === null) throw new ContextNavigationScopeError(`Invalid navigation scope ref "${ref}".`);
      const pageId = match[1]!;
      const index = this.pages.get(pageId);
      if (index === undefined) throw new ContextNavigationScopeError(`Navigation scope page "${pageId}" was not found.`);
      const targetId = match[2];
      if (targetId === undefined) return { ref: `agentdocs://pages/${pageId}.md`, pageId };
      const heading = index.headingById.get(targetId);
      if (heading !== undefined) return { ref, pageId, headingPath: heading.path };
      const chunk = index.chunks.find((candidate) => candidate.id === targetId);
      if (chunk !== undefined) return { ref, pageId, headingPath: chunk.headingPath };
      const codeBlock = index.page.codeBlocks.find((candidate) => candidate.id === targetId);
      const codeHeading = codeBlock?.sourceHeadingId === undefined
        ? undefined
        : index.headingById.get(codeBlock.sourceHeadingId);
      if (codeHeading !== undefined) return { ref, pageId, headingPath: codeHeading.path };
      throw new ContextNavigationScopeError(`Navigation scope target "${targetId}" was not found on page "${pageId}".`);
    });
  }

  private buildBranch(
    index: PageIndex,
    relevantChunkIds: Set<string>,
    requirementValues: readonly string[],
  ): ContextNavigation["branches"][number] {
    const chunks = index.chunks.filter((chunk) => relevantChunkIds.has(chunk.id));
    const selectedPaths = new Map<string, HeadingEntry>();
    for (const chunk of chunks) {
      for (let length = 1; length <= chunk.headingPath.length; length += 1) {
        const path = chunk.headingPath.slice(0, length);
        const entry = index.headingByPath.get(pathKey(path));
        if (entry !== undefined) selectedPaths.set(pathKey(path), entry);
      }
    }

    const headings = [...selectedPaths.values()]
      .sort((left, right) => left.index - right.index)
      .map((entry) => ({
        ref: `agentdocs://pages/${index.page.id}.md#${entry.heading.id}`,
        headingPath: entry.path,
        depth: entry.heading.depth,
        matchedFor: requirementValues.filter((value) =>
          containsTerms(`${index.page.title} ${entry.path.join(" ")}`, value)),
        evidenceKinds: evidenceKindsFor(index, entry, chunks),
        childHeadingCount: directChildCount(index.headings, entry),
      }));

    const selectedHeadingIds = new Set(
      [...selectedPaths.values()].map((entry) => entry.heading.id),
    );
    const externalReferences = index.page.links
      .filter((link) => link.kind === "external")
      .filter((link) => link.sourceHeadingId === undefined || selectedHeadingIds.has(link.sourceHeadingId))
      .filter((link) => !this.targetKeys.has(targetKey(link.resolvedHref ?? link.href)))
      .map((link) => externalReferenceFor(index, link));

    return {
      pageId: index.page.id,
      pageRef: `agentdocs://pages/${index.page.id}.md`,
      title: index.page.title,
      sourceUrl: index.page.canonicalUrl ?? index.page.sourceUrl,
      repoPath: index.page.repoPath,
      facets: facetsFor(index.page, chunks),
      headings,
      externalReferences,
    };
  }
}

type ScopeEntry = {
  ref: string;
  pageId: string;
  headingPath?: string[];
};

const NAVIGATION_BRANCH_PAGE_SIZE = 4;

function formatNavigationCursor(offset: number): string {
  return `agentdocs:navigation:v1:${offset.toString(36)}`;
}

function parseNavigationCursor(cursor: string | undefined, branchCount: number): number {
  if (cursor === undefined) return 0;
  const match = /^agentdocs:navigation:v1:([0-9a-z]+)$/.exec(cursor);
  if (match === null) throw new ContextNavigationScopeError(`Invalid navigation cursor "${cursor}".`);
  const offset = Number.parseInt(match[1]!, 36);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= branchCount) {
    throw new ContextNavigationScopeError(`Navigation cursor "${cursor}" is no longer valid.`);
  }
  return offset;
}

function headingEntries(headings: Heading[]): HeadingEntry[] {
  const stack: Heading[] = [];
  return headings.map((heading, index) => {
    stack[heading.depth - 1] = heading;
    stack.length = heading.depth;
    return { heading, path: stack.map((item) => item.text), index };
  });
}

function evidenceKindsFor(index: PageIndex, entry: HeadingEntry, chunks: Chunk[]): Array<"prose" | "code" | "links"> {
  const kinds = new Set<"prose" | "code" | "links">();
  if (chunks.some((chunk) => startsWithPath(chunk.headingPath, entry.path))) kinds.add("prose");
  if (index.page.codeBlocks.some((block) => {
    const source = block.sourceHeadingId === undefined ? undefined : index.headingById.get(block.sourceHeadingId);
    return source !== undefined && startsWithPath(source.path, entry.path);
  })) kinds.add("code");
  if (index.page.links.some((link) => {
    const source = link.sourceHeadingId === undefined ? undefined : index.headingById.get(link.sourceHeadingId);
    return source !== undefined && startsWithPath(source.path, entry.path);
  })) kinds.add("links");
  return [...kinds].sort(compareStrings);
}

function externalReferenceFor(index: PageIndex, link: Link): ContextNavigation["externalReferences"][number] {
  const heading = link.sourceHeadingId === undefined ? undefined : index.headingById.get(link.sourceHeadingId);
  return {
    status: "external_uningested",
    url: link.href,
    label: link.text || link.href,
    sourceRef: heading === undefined
      ? `agentdocs://pages/${index.page.id}.md`
      : `agentdocs://pages/${index.page.id}.md#${heading.heading.id}`,
    sourcePageId: index.page.id,
    headingPath: heading?.path ?? [],
  };
}

function facetsFor(page: DocPage, chunks: Chunk[]): Record<string, string[]> {
  const values = new Map<string, Set<string>>();
  for (const facet of [...page.facets, ...chunks.flatMap((chunk) => chunk.facets)]) {
    const set = values.get(facet.key) ?? new Set<string>();
    set.add(facet.value);
    values.set(facet.key, set);
  }
  return Object.fromEntries([...values.entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([key, set]) => [key, [...set].sort(compareStrings)]));
}

function directChildCount(headings: HeadingEntry[], entry: HeadingEntry): number {
  let count = 0;
  for (const candidate of headings) {
    if (candidate.index <= entry.index) continue;
    if (candidate.heading.depth <= entry.heading.depth) break;
    if (candidate.heading.depth === entry.heading.depth + 1) count += 1;
  }
  return count;
}

function startsWithPath(value: string[], prefix: string[]): boolean {
  return prefix.every((part, index) => value[index] === part);
}

function containsTerms(text: string, query: string): boolean {
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2);
  const normalized = text.toLowerCase();
  return terms.length > 0 && terms.every((term) => normalized.includes(term));
}

function pathKey(path: string[]): string {
  return path.join("\u0000");
}

function targetKey(value: string): string {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host.toLowerCase()}${url.pathname.replace(/\/$/, "")}${url.search}`;
  } catch {
    return value.replace(/#.*$/, "").replace(/\\/g, "/").replace(/\/$/, "");
  }
}

function compareChunks(left: Chunk, right: Chunk): number {
  return compareStrings(left.id, right.id);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
