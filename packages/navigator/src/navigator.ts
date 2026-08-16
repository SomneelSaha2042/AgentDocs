import { createHash } from "node:crypto";

import {
  AgentMapSchema,
  BrowseDocsResponseSchema,
  DocumentationMapNodeSchema,
  DocumentationMapSchema,
  ReadPageResponseSchema,
  type AgentMap,
  type BrowseDocsResponse,
  type Chunk,
  type DocPage,
  type DocumentationMap,
  type DocumentationMapNode,
  type DocumentationMapRelation,
  type DocumentationMapRelationType,
  type EntityType,
  type Evidence,
  type ReadPageResponse,
} from "@agentdocs/shared";

export type DocumentationMapNavigatorOptions = {
  agentMap: AgentMap;
  documentationMap?: DocumentationMap;
};

export type BrowseDocumentationMapOptions = {
  ref?: string;
  cursor?: string;
  limit?: number;
  relations?: DocumentationMapRelationType[];
};

type RelationCandidate = {
  direction: "outgoing" | "incoming";
  nodeRef: string;
  type: DocumentationMapRelationType;
};

type HeadingEntry = {
  headingId: string;
  headingPath: string[];
  parentRef: string;
  ref: string;
};

type DocumentationMapNodeInput = Omit<
  DocumentationMapNode,
  "childCount" | "evidenceCount" | "facets" | "headingPath" | "order"
> & Partial<Pick<DocumentationMapNode, "evidenceCount" | "facets" | "headingPath">>;

const ROOT_REF = "agentdocs://map";
const PAGES_REF = "agentdocs://map/pages";
const ENTITIES_REF = "agentdocs://map/entities";
const TASKS_REF = "agentdocs://map/tasks";
const DEFAULT_BROWSE_LIMIT = 24;
const MAX_BROWSE_LIMIT = 50;
const READ_PART_TARGET_CHARS = 8000;

export class DocumentationMapNavigationError extends Error {
  override readonly name = "DocumentationMapNavigationError";
}

export function compileDocumentationMap(options: DocumentationMapNavigatorOptions): DocumentationMap {
  return new DocumentationMapNavigator({ agentMap: options.agentMap }).documentationMap();
}

export function documentationMapSourceHash(agentMap: AgentMap): string {
  const parsed = AgentMapSchema.parse(agentMap);
  return hash(JSON.stringify(parsed));
}

/**
 * Serves a bounded traversal view over one validated AgentDocs artifact.
 * Source order and authored relationships determine navigation order; this
 * module never ranks nodes against a natural-language task.
 */
export class DocumentationMapNavigator {
  private readonly agentMap: AgentMap;
  private readonly chunks: Map<string, Chunk>;
  private readonly nodes = new Map<string, DocumentationMapNode>();
  private readonly nodeOrder = new Map<string, number>();
  private readonly parents = new Map<string, string>();
  private readonly relations: DocumentationMapRelation[] = [];
  private readonly relationKeys = new Set<string>();
  private readonly pageHeadingEntries = new Map<string, HeadingEntry[]>();

  constructor(options: DocumentationMapNavigatorOptions) {
    this.agentMap = AgentMapSchema.parse(options.agentMap);
    this.chunks = new Map(this.agentMap.chunks.map((chunk) => [chunk.id, chunk]));
    if (options.documentationMap === undefined) {
      this.compile();
    } else {
      const documentationMap = DocumentationMapSchema.parse(options.documentationMap);
      const expectedHash = documentationMapSourceHash(this.agentMap);
      if (documentationMap.sourceHash !== expectedHash) {
        throw new DocumentationMapNavigationError("documentation-map.json does not match agent-map.json.");
      }
      this.hydrate(documentationMap);
      this.indexPageHeadingEntries();
    }
  }

  documentationMap(): DocumentationMap {
    return DocumentationMapSchema.parse({
      schemaVersion: "1.0.0",
      sourceHash: documentationMapSourceHash(this.agentMap),
      rootRef: ROOT_REF,
      nodes: [...this.nodes.keys()].map((ref) => this.node(ref)),
      relations: this.relations,
    });
  }

  browse(options: BrowseDocumentationMapOptions = {}): BrowseDocsResponse {
    const ref = options.ref ?? ROOT_REF;
    if (!this.nodes.has(ref)) {
      throw new DocumentationMapNavigationError(`Documentation map node "${ref}" was not found.`);
    }
    const limit = browseLimit(options.limit);
    const candidates = this.relationCandidates(ref, options.relations);
    const cursorScope = browseCursorScope(ref, options.relations);
    const offset = parseCursor(options.cursor, cursorScope, candidates.length);
    const selected = candidates.slice(offset, offset + limit);
    const nextOffset = offset + selected.length;
    const grouped = new Map<string, {
      type: DocumentationMapRelationType;
      direction: "outgoing" | "incoming";
      nodes: DocumentationMapNode[];
    }>();
    for (const candidate of selected) {
      const key = `${candidate.direction}\u0000${candidate.type}`;
      const group = grouped.get(key) ?? {
        type: candidate.type,
        direction: candidate.direction,
        nodes: [],
      };
      group.nodes.push(this.node(candidate.nodeRef));
      grouped.set(key, group);
    }

    const draft = {
      node: this.node(ref),
      breadcrumbs: this.breadcrumbs(ref),
      relations: [...grouped.values()],
      complete: nextOffset >= candidates.length,
      nextCursor: nextOffset >= candidates.length ? undefined : formatCursor(cursorScope, nextOffset),
      estimatedTokens: 0,
    };
    return BrowseDocsResponseSchema.parse({
      ...draft,
      estimatedTokens: estimateTokens(JSON.stringify(draft)),
    });
  }

  read(ref: string): ReadPageResponse {
    const reference = parsePageReference(ref);
    const page = this.agentMap.pages.find((candidate) => candidate.id === reference.pageId);
    if (page === undefined) {
      throw new DocumentationMapNavigationError(`Page "${reference.pageId}" was not found.`);
    }
    const target = this.readableTarget(page, reference.targetId);
    const parts = splitReadableText(target.text);
    const text = parts[reference.part - 1];
    if (text === undefined) {
      throw new DocumentationMapNavigationError(`Part ${reference.part} was not found for "${ref}".`);
    }
    const complete = reference.part === parts.length;
    return ReadPageResponseSchema.parse({
      section: {
        pageId: page.id,
        targetId: reference.targetId,
        title: target.title,
        headingPath: target.headingPath,
        sourceUrl: page.canonicalUrl ?? page.sourceUrl,
        repoPath: page.repoPath,
        text,
        part: reference.part,
        complete,
        nextRef: complete ? undefined : formatPageReference({ ...reference, part: reference.part + 1 }),
        evidence: target.evidence,
      },
    });
  }

  private compile(): void {
    this.addNode({ ref: ROOT_REF, kind: "root", label: "Documentation map", preview: "Browse authored documentation structure and semantic entities." });
    this.addNode({ ref: PAGES_REF, kind: "collection", label: "Pages", preview: "Pages grouped by their documented source path." });
    this.addNode({ ref: ENTITIES_REF, kind: "collection", label: "Entities", preview: "Named packages, symbols, commands, routes, versions, and concepts found in source evidence." });
    this.addRelation(ROOT_REF, PAGES_REF, "contains", true);
    this.addRelation(ROOT_REF, ENTITIES_REF, "contains", true);
    if (this.agentMap.taskPacks.length > 0) {
      this.addNode({ ref: TASKS_REF, kind: "collection", label: "Saved views", preview: "Evidence-backed task-pack entry points. These are optional views over the map." });
      this.addRelation(ROOT_REF, TASKS_REF, "contains", true);
    }

    this.compilePages();
    this.compileEntities();
    this.compileChunkOccurrences();
    this.compileAgentMapEdges();
    this.compileTasks();
  }

  private hydrate(documentationMap: DocumentationMap): void {
    for (const node of documentationMap.nodes) {
      this.nodes.set(node.ref, node);
      this.nodeOrder.set(node.ref, node.order);
    }
    for (const relation of documentationMap.relations) {
      this.addRelation(relation.from, relation.to, relation.type, relation.type === "contains");
    }
  }

  private indexPageHeadingEntries(): void {
    for (const page of this.agentMap.pages) {
      const stack: Array<{ depth: number; path: string[]; ref: string }> = [];
      const entries: HeadingEntry[] = [];
      const headings = [...page.headings]
        .map((heading, index) => ({ heading, index }))
        .sort((left, right) =>
          (left.heading.position.startLine ?? left.index) - (right.heading.position.startLine ?? right.index)
          || left.index - right.index);
      for (const { heading } of headings) {
        while (stack.length > 0 && stack.at(-1)!.depth >= heading.depth) stack.pop();
        const parent = stack.at(-1);
        const headingPath = [...(parent?.path ?? []), heading.text];
        const ref = targetReference(page.id, heading.id);
        entries.push({ headingId: heading.id, headingPath, parentRef: parent?.ref ?? pageReference(page.id), ref });
        stack.push({ depth: heading.depth, path: headingPath, ref });
      }
      this.pageHeadingEntries.set(page.id, entries);
    }
  }

  private compilePages(): void {
    const collectionRefs = new Map<string, string>();
    const pages = [...this.agentMap.pages].sort((left, right) =>
      compareStrings(pageSource(left), pageSource(right)) || compareStrings(left.id, right.id));
    pages.forEach((page, pageOrder) => {
      let parentRef = PAGES_REF;
      const path: string[] = [];
      for (const segment of collectionSegments(page)) {
        path.push(segment);
        const key = path.join("/");
        let collectionRef = collectionRefs.get(key);
        if (collectionRef === undefined) {
          collectionRef = `agentdocs://collections/collection_${hash(key).slice(0, 16)}`;
          collectionRefs.set(key, collectionRef);
          this.addNode({ ref: collectionRef, kind: "collection", label: segment, preview: key });
          this.addRelation(parentRef, collectionRef, "contains", true);
        }
        parentRef = collectionRef;
      }

      const pageRef = pageReference(page.id);
      this.addNode({
        ref: pageRef,
        kind: "page",
        label: page.title,
        preview: page.description ?? excerpt(page.markdown),
        pageId: page.id,
        sourceUrl: page.canonicalUrl ?? page.sourceUrl,
        repoPath: page.repoPath,
        facets: facetValues(page.facets),
        evidenceCount: 1,
      }, pageOrder);
      this.addRelation(parentRef, pageRef, "contains", true);
      this.compilePageStructure(page, pageRef);
    });
  }

  private compilePageStructure(page: DocPage, pageRef: string): void {
    const pageChunks = this.agentMap.chunks.filter((chunk) => chunk.pageId === page.id).sort(compareChunks);
    const headings = [...page.headings]
      .map((heading, index) => ({ heading, index }))
      .sort((left, right) =>
        (left.heading.position.startLine ?? left.index) - (right.heading.position.startLine ?? right.index)
        || left.index - right.index);
    const stack: Array<{ depth: number; path: string[]; ref: string }> = [];
    const entries: HeadingEntry[] = [];
    for (const { heading } of headings) {
      while (stack.length > 0 && stack.at(-1)!.depth >= heading.depth) stack.pop();
      const parent = stack.at(-1);
      const headingPath = [...(parent?.path ?? []), heading.text];
      const ref = targetReference(page.id, heading.id);
      const parentRef = parent?.ref ?? pageRef;
      const matchingChunk = pageChunks
        .find((chunk) => chunk.headingId === heading.id || arraysEqual(chunk.headingPath, headingPath));
      this.addNode({
        ref,
        kind: "section",
        label: heading.text,
        preview: matchingChunk === undefined ? undefined : excerpt(matchingChunk.text),
        pageId: page.id,
        targetId: heading.id,
        headingPath,
        sourceUrl: page.canonicalUrl ?? page.sourceUrl,
        repoPath: page.repoPath,
        facets: facetValues(page.facets),
        evidenceCount: 1,
      }, heading.position.startLine ?? entries.length);
      this.addRelation(parentRef, ref, "contains", true);
      entries.push({ headingId: heading.id, headingPath, parentRef, ref });
      stack.push({ depth: heading.depth, path: headingPath, ref });
    }
    this.pageHeadingEntries.set(page.id, entries);

    pageChunks.forEach((chunk, index) => {
      const ref = targetReference(page.id, chunk.id);
      const heading = entries.find((entry) => entry.headingId === chunk.headingId)
        ?? entries.find((entry) => arraysEqual(entry.headingPath, chunk.headingPath));
      this.addNode({
        ref,
        kind: "block",
        label: chunk.kind === "table_row" ? "Table row" : chunk.headingPath.at(-1) ?? page.title,
        preview: excerpt(chunk.text),
        pageId: page.id,
        targetId: chunk.id,
        headingPath: chunk.headingPath,
        sourceUrl: page.canonicalUrl ?? page.sourceUrl,
        repoPath: page.repoPath,
        facets: facetValues(chunk.facets),
        evidenceCount: 1,
      }, chunk.sourceOrder ?? index);
      this.addRelation(heading?.ref ?? pageRef, ref, "contains", true);
      const previous = pageChunks[index - 1];
      if (previous !== undefined) {
        const previousRef = targetReference(page.id, previous.id);
        this.addRelation(previousRef, ref, "precedes");
        this.addRelation(ref, previousRef, "follows");
      }
    });

    [...page.codeBlocks].sort((left, right) => (left.sourceOrder ?? 0) - (right.sourceOrder ?? 0) || compareStrings(left.id, right.id))
      .forEach((block, index) => {
        const ref = targetReference(page.id, block.id);
        const heading = entries.find((entry) => entry.headingId === block.sourceHeadingId);
        this.addNode({
          ref,
          kind: "code_block",
          label: block.language === undefined ? "Code example" : `${block.language} code example`,
          preview: excerpt(block.value),
          pageId: page.id,
          targetId: block.id,
          headingPath: heading?.headingPath ?? [],
          sourceUrl: page.canonicalUrl ?? page.sourceUrl,
          repoPath: page.repoPath,
          facets: facetValues(page.facets),
          evidenceCount: 1,
        }, block.sourceOrder ?? index);
        this.addRelation(heading?.ref ?? pageRef, ref, "contains", true);
      });
  }

  private compileEntities(): void {
    const types = stableUnique(this.agentMap.entities.map((entity) => entity.type));
    for (const type of types) {
      const typeRef = entityTypeReference(type);
      this.addNode({ ref: typeRef, kind: "collection", label: entityTypeLabel(type), preview: `Documented ${entityTypeLabel(type).toLowerCase()}.` });
      this.addRelation(ENTITIES_REF, typeRef, "contains", true);
    }
    [...this.agentMap.entities]
      .sort((left, right) => compareStrings(left.type, right.type) || compareStrings(left.name, right.name) || compareStrings(left.id, right.id))
      .forEach((entity, index) => {
        const ref = entityReference(entity.id);
        this.addNode({
          ref,
          kind: "entity",
          label: entity.name,
          preview: entity.aliases.length === 0 ? undefined : `Aliases: ${entity.aliases.join(", ")}`,
          entityId: entity.id,
          entityType: entity.type,
          evidenceCount: entity.evidence.length,
        }, index);
        this.addRelation(entityTypeReference(entity.type), ref, "contains", true);
        for (const evidence of entity.evidence) {
          const occurrenceRef = this.referenceForEvidence(evidence);
          if (occurrenceRef !== undefined) this.addRelation(ref, occurrenceRef, "occurs_in");
        }
      });
  }

  private compileChunkOccurrences(): void {
    for (const chunk of this.agentMap.chunks) {
      const chunkRef = targetReference(chunk.pageId, chunk.id);
      for (const entityId of chunk.entityIds) {
        const entityRef = entityReference(entityId);
        this.addRelation(chunkRef, entityRef, "mentions");
        this.addRelation(entityRef, chunkRef, "occurs_in");
      }
    }
  }

  private compileAgentMapEdges(): void {
    for (const edge of this.agentMap.edges) {
      const from = this.referenceForGraphNode(edge.from);
      const to = this.referenceForGraphNode(edge.to);
      if (from !== undefined && to !== undefined) this.addRelation(from, to, edge.type);
    }
  }

  private compileTasks(): void {
    for (const [index, task] of this.agentMap.taskPacks.entries()) {
      const ref = taskReference(task.id);
      this.addNode({
        ref,
        kind: "task",
        label: task.title,
        preview: task.description,
        facets: task.context.facets,
        evidenceCount: task.evidence.length,
      }, index);
      this.addRelation(TASKS_REF, ref, "contains", true);
      for (const pageId of task.requiredPages) {
        if (this.nodes.has(pageReference(pageId))) this.addRelation(ref, pageReference(pageId), "context_for");
      }
      for (const entityId of task.relatedEntities) {
        if (this.nodes.has(entityReference(entityId))) this.addRelation(ref, entityReference(entityId), "context_for");
      }
    }
  }

  private addNode(input: DocumentationMapNodeInput, order = this.nodes.size): void {
    if (this.nodes.has(input.ref)) return;
    this.nodes.set(input.ref, DocumentationMapNodeSchema.parse({ ...input, order, childCount: 0, evidenceCount: input.evidenceCount ?? 0 }));
    this.nodeOrder.set(input.ref, order);
  }

  private addRelation(from: string, to: string, type: DocumentationMapRelationType, parent = false): void {
    if (!this.nodes.has(from) || !this.nodes.has(to)) return;
    const key = `${from}\u0000${type}\u0000${to}`;
    if (!this.relationKeys.has(key)) {
      this.relations.push({ from, to, type });
      this.relationKeys.add(key);
    }
    if (parent && !this.parents.has(to)) this.parents.set(to, from);
  }

  private node(ref: string): DocumentationMapNode {
    const node = this.nodes.get(ref);
    if (node === undefined) throw new DocumentationMapNavigationError(`Documentation map node "${ref}" was not found.`);
    const childCount = this.relations.filter((relation) => relation.from === ref && relation.type === "contains").length;
    return DocumentationMapNodeSchema.parse({ ...node, childCount });
  }

  private breadcrumbs(ref: string): DocumentationMapNode[] {
    const values: DocumentationMapNode[] = [];
    const visited = new Set<string>([ref]);
    let parent = this.parents.get(ref);
    while (parent !== undefined && !visited.has(parent)) {
      values.push(this.node(parent));
      visited.add(parent);
      parent = this.parents.get(parent);
    }
    return values.reverse();
  }

  private relationCandidates(ref: string, allowed?: DocumentationMapRelationType[]): RelationCandidate[] {
    const allowedSet = allowed === undefined || allowed.length === 0 ? undefined : new Set(allowed);
    return this.relations.flatMap((relation): RelationCandidate[] => {
      if (allowedSet !== undefined && !allowedSet.has(relation.type)) return [];
      if (relation.from === ref) return [{ direction: "outgoing", nodeRef: relation.to, type: relation.type }];
      if (relation.to === ref) return [{ direction: "incoming", nodeRef: relation.from, type: relation.type }];
      return [];
    }).sort((left, right) =>
      relationPriority(left.type) - relationPriority(right.type)
      || compareStrings(left.direction, right.direction)
      || (this.nodeOrder.get(left.nodeRef) ?? Number.MAX_SAFE_INTEGER) - (this.nodeOrder.get(right.nodeRef) ?? Number.MAX_SAFE_INTEGER)
      || compareStrings(this.nodes.get(left.nodeRef)?.label ?? left.nodeRef, this.nodes.get(right.nodeRef)?.label ?? right.nodeRef)
      || compareStrings(left.nodeRef, right.nodeRef));
  }

  private referenceForGraphNode(id: string): string | undefined {
    if (this.agentMap.pages.some((page) => page.id === id)) return pageReference(id);
    if (this.agentMap.entities.some((entity) => entity.id === id)) return entityReference(id);
    return undefined;
  }

  private referenceForEvidence(evidence: Evidence): string | undefined {
    if (evidence.pageId === undefined) return undefined;
    const targetId = evidence.codeBlockId ?? evidence.chunkId ?? evidence.headingId;
    const ref = targetId === undefined ? pageReference(evidence.pageId) : targetReference(evidence.pageId, targetId);
    return this.nodes.has(ref) ? ref : undefined;
  }

  private readableTarget(page: DocPage, targetId?: string): {
    title: string;
    headingPath: string[];
    text: string;
    evidence: Evidence[];
  } {
    if (targetId === undefined) {
      return {
        title: page.title,
        headingPath: [],
        text: page.markdown,
        evidence: [pageEvidence(page)],
      };
    }
    const chunk = this.chunks.get(targetId);
    if (chunk !== undefined) {
      if (chunk.pageId !== page.id) throw new DocumentationMapNavigationError(`Target "${targetId}" does not belong to page "${page.id}".`);
      return {
        title: chunk.headingPath.at(-1) ?? page.title,
        headingPath: chunk.headingPath,
        text: chunk.text,
        evidence: [{ ...pageEvidence(page), source: chunk.headingId === undefined ? "page" : "heading", headingId: chunk.headingId, chunkId: chunk.id, quote: chunk.text }],
      };
    }
    const block = page.codeBlocks.find((candidate) => candidate.id === targetId);
    if (block !== undefined) {
      const headingPath = this.pageHeadingEntries.get(page.id)?.find((entry) => entry.headingId === block.sourceHeadingId)?.headingPath ?? [];
      return {
        title: block.language === undefined ? "Code example" : `${block.language} code example`,
        headingPath,
        text: block.value,
        evidence: [{ ...pageEvidence(page), source: "code_block", headingId: block.sourceHeadingId, codeBlockId: block.id, quote: block.value }],
      };
    }
    const headingIndex = page.headings.findIndex((candidate) => candidate.id === targetId);
    const heading = page.headings[headingIndex];
    if (heading !== undefined) {
      const headingPath = this.pageHeadingEntries.get(page.id)?.find((entry) => entry.headingId === heading.id)?.headingPath ?? [heading.text];
      return {
        title: heading.text,
        headingPath,
        text: sourceSectionText(page, headingIndex, this.agentMap.chunks),
        evidence: [{ ...pageEvidence(page), source: "heading", headingId: heading.id }],
      };
    }
    throw new DocumentationMapNavigationError(`Target "${targetId}" was not found on page "${page.id}".`);
  }
}

function browseLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_BROWSE_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_BROWSE_LIMIT) {
    throw new DocumentationMapNavigationError(`limit must be an integer between 1 and ${MAX_BROWSE_LIMIT}.`);
  }
  return limit;
}

function collectionSegments(page: DocPage): string[] {
  if (page.canonicalUrl !== undefined || page.sourceUrl !== undefined) {
    try {
      const url = new URL(page.canonicalUrl ?? page.sourceUrl!);
      const pathname = url.pathname;
      const segments = pathname.split("/").filter(Boolean).map(safeDecode);
      return [url.host, ...(segments.length <= 1 ? [] : segments.slice(0, -1))];
    } catch {
      // Fall through to the local path when a captured URL is malformed.
    }
  }
  const path = page.repoPath?.replace(/\\/g, "/").split("/").filter(Boolean) ?? [];
  return path.length <= 1 ? [] : path.slice(0, -1);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sourceSectionText(page: DocPage, headingIndex: number, chunks: Chunk[]): string {
  const heading = page.headings[headingIndex]!;
  const startLine = heading.position.startLine;
  if (startLine !== undefined) {
    const next = page.headings.slice(headingIndex + 1).find((candidate) =>
      candidate.depth <= heading.depth && candidate.position.startLine !== undefined);
    const lines = page.markdown.split(/\r?\n/);
    return lines.slice(startLine - 1, next?.position.startLine === undefined ? lines.length : next.position.startLine - 1).join("\n").trimEnd();
  }
  const entries = headingPathEntries(page.headings);
  const path = entries.find((entry) => entry.headingId === heading.id)?.headingPath ?? [heading.text];
  const matching = pageChunksInOrder(page.id, chunks)
    .filter((chunk) => path.every((value, index) => chunk.headingPath[index] === value));
  return matching.map((chunk) => chunk.text).join("\n\n");
}

// Kept as a small pure fallback hook for old artifacts whose headings have no
// source positions. New builds use the exact source slice above.
function pageChunksInOrder(_pageId: string, chunks: Chunk[]): Chunk[] {
  return chunks.filter((chunk) => chunk.pageId === _pageId).sort(compareChunks);
}

function headingPathEntries(headings: DocPage["headings"]): Array<{ headingId: string; headingPath: string[] }> {
  const stack: Array<{ depth: number; path: string[] }> = [];
  return headings.map((heading) => {
    while (stack.length > 0 && stack.at(-1)!.depth >= heading.depth) stack.pop();
    const path = [...(stack.at(-1)?.path ?? []), heading.text];
    stack.push({ depth: heading.depth, path });
    return { headingId: heading.id, headingPath: path };
  });
}

function parsePageReference(value: string): { pageId: string; part: number; targetId?: string } {
  const match = /^agentdocs:\/\/pages\/([a-zA-Z0-9_-]+)\.md(?:\?part=([1-9][0-9]*))?(?:#([a-zA-Z0-9_-]+))?$/.exec(value);
  if (match === null) {
    throw new DocumentationMapNavigationError("ref must be an AgentDocs page reference such as agentdocs://pages/page_id.md#target_id.");
  }
  return { pageId: match[1]!, part: match[2] === undefined ? 1 : Number(match[2]), targetId: match[3] };
}

function formatPageReference(reference: { pageId: string; part: number; targetId?: string }): string {
  return `agentdocs://pages/${reference.pageId}.md${reference.part === 1 ? "" : `?part=${reference.part}`}${reference.targetId === undefined ? "" : `#${reference.targetId}`}`;
}

function splitReadableText(value: string): string[] {
  if (value.length <= READ_PART_TARGET_CHARS) return [value];
  const blocks = value.split(/(?<=\n)(?=\n)/).flatMap((block) =>
    block.length <= READ_PART_TARGET_CHARS ? [block] : splitReadableLines(block));
  const parts: string[] = [];
  let current = "";
  for (const block of blocks) {
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

function browseCursorScope(ref: string, relations?: DocumentationMapRelationType[]): string {
  return `${ref}\u0000${relations === undefined ? "*" : stableUnique(relations).join(",")}`;
}

function formatCursor(scope: string, offset: number): string {
  return `agentdocs:map:v1:${hash(scope).slice(0, 12)}:${offset}`;
}

function parseCursor(cursor: string | undefined, scope: string, count: number): number {
  if (cursor === undefined) return 0;
  const match = /^agentdocs:map:v1:([a-f0-9]{12}):(0|[1-9][0-9]*)$/.exec(cursor);
  if (match === null || match[1] !== hash(scope).slice(0, 12)) {
    throw new DocumentationMapNavigationError(`Invalid documentation map cursor "${cursor}".`);
  }
  const offset = Number(match[2]);
  if (offset > count) throw new DocumentationMapNavigationError(`Documentation map cursor "${cursor}" is no longer valid.`);
  return offset;
}

function pageEvidence(page: DocPage): Evidence {
  return { source: "page", pageId: page.id, url: page.canonicalUrl ?? page.sourceUrl, repoPath: page.repoPath };
}

function pageReference(pageId: string): string {
  return `agentdocs://pages/${pageId}.md`;
}

function targetReference(pageId: string, targetId: string): string {
  return `${pageReference(pageId)}#${targetId}`;
}

function entityReference(entityId: string): string {
  return `agentdocs://entities/${entityId}`;
}

function entityTypeReference(type: EntityType): string {
  return `agentdocs://map/entities/${type}`;
}

function taskReference(taskId: string): string {
  return `agentdocs://task-packs/${taskId}.md`;
}

function entityTypeLabel(type: EntityType): string {
  return `${type.replace(/_/g, " ").replace(/\b\w/g, (value) => value.toUpperCase())} entities`;
}

function facetValues(facets: DocPage["facets"] | Chunk["facets"]): Record<string, string[]> {
  const values: Record<string, string[]> = {};
  for (const facet of facets) values[facet.key] = stableUnique([...(values[facet.key] ?? []), facet.value]);
  return Object.fromEntries(Object.entries(values).sort(([left], [right]) => compareStrings(left, right)));
}

function relationPriority(type: DocumentationMapRelationType): number {
  return ["contains", "precedes", "follows", "links_to", "mentions", "occurs_in", "context_for"].indexOf(type) < 0
    ? 100
    : ["contains", "precedes", "follows", "links_to", "mentions", "occurs_in", "context_for"].indexOf(type);
}

function compareChunks(left: Chunk, right: Chunk): number {
  return (left.sourceOrder ?? 0) - (right.sourceOrder ?? 0) || compareStrings(left.id, right.id);
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function pageSource(page: DocPage): string {
  return page.canonicalUrl ?? page.sourceUrl ?? page.repoPath ?? page.id;
}

function excerpt(value: string, max = 220): string {
  const compact = value.replace(/^#{1,6}\s+/gm, "").replace(/\s+/g, " ").trim();
  return compact.length <= max ? compact : `${compact.slice(0, max - 3).trimEnd()}...`;
}

function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}

function stableUnique<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort(compareStrings);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
