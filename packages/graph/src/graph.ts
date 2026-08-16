import { createHash } from "node:crypto";

import {
  deterministicEntityId,
  extractDeterministicEntities,
} from "@agentdocs/normalizer";
import {
  AgentMapSchema,
  type AgentMap,
  type Chunk,
  type DocPage,
  type Edge,
  type EdgeType,
  type Entity,
  type EntityType,
  type Evidence,
} from "@agentdocs/shared";

export type BuildAgentMapOptions = {
  chunks: Chunk[];
  pages: DocPage[];
};

type EntityCandidate = {
  edgeType: EdgeType;
  id: string;
  name: string;
  type: EntityType;
};

export function buildAgentMap(options: BuildAgentMapOptions): AgentMap {
  const pages = [...options.pages].sort(comparePages);
  const chunks = [...options.chunks].sort(compareChunks);
  const entityMap = new Map<string, Entity>();
  const edgeMap = new Map<string, Edge>();

  for (const page of pages) {
    addLinkEdges(page, pages, edgeMap);
  }
  for (const chunk of chunks) {
    const page = pages.find((candidate) => candidate.id === chunk.pageId);
    if (page === undefined) {
      throw new Error(`Chunk ${chunk.id} references missing page ${chunk.pageId}.`);
    }
    const evidence = chunkEvidence(page, chunk);
    for (const candidate of extractionCandidates(chunk.text)) {
      addEntity(entityMap, candidate, page.id, evidence);
      addEdge(edgeMap, page.id, candidate.id, candidate.edgeType, evidence, 1);
    }
  }
  for (const page of pages) {
    for (const codeBlock of page.codeBlocks) {
      const evidence = evidenceForCodeBlock(page, codeBlock.id, codeBlock.value);
      const example: EntityCandidate = {
        id: `example_${hash(`${page.id}:${codeBlock.id}`).slice(0, 16)}`,
        name: `${page.title} example ${codeBlock.id}`,
        type: "example",
        edgeType: "related_to",
      };
      addEntity(entityMap, example, page.id, evidence);
      addEdge(edgeMap, page.id, example.id, "defines", evidence, 1);
      for (const candidate of codeBlockCandidates(codeBlock.value)) {
        addEntity(entityMap, candidate, page.id, evidence);
        addEdge(edgeMap, example.id, candidate.id, "example_for", evidence, 1);
      }
    }
  }

  const agentMap = AgentMapSchema.parse({
    schemaVersion: "0.2.0",
    pages,
    chunks,
    entities: [...entityMap.values()].map(sortEntity).sort(compareEntities),
    edges: [...edgeMap.values()].map(sortEdge).sort(compareEdges),
    taskPacks: [],
  });
  validateReferences(agentMap);
  return agentMap;
}

function addLinkEdges(
  page: DocPage,
  pages: DocPage[],
  edgeMap: Map<string, Edge>,
): void {
  // Resolve any captured target already present in the corpus, including
  // cross-origin links. This never fetches a URL: an external link only gets
  // an edge when a page with the same source/canonical URL was ingested.
  for (const link of page.links) {
    const target = resolveTargetPage(link.resolvedHref ?? link.href, pages);
    if (target === undefined) {
      continue;
    }
    const evidence: Evidence = {
      source: "link",
      pageId: page.id,
      headingId: link.sourceHeadingId,
      url: page.canonicalUrl ?? page.sourceUrl,
      repoPath: page.repoPath,
      quote: link.text.length > 0 ? `${link.text}: ${link.href}` : link.href,
    };
    addEdge(edgeMap, page.id, target.id, "links_to", evidence, 1);
  }
}

function extractionCandidates(value: string): EntityCandidate[] {
  const extraction = extractDeterministicEntities(value);
  return [
    ...toCandidates("package", "requires", extraction.packages),
    ...toCandidates("package", "uses", extraction.imports.filter(isExternalImport)),
    ...toCandidates("env_var", "uses", extraction.envVars),
    ...toCandidates("cli_command", "uses", extraction.cliCommands),
    ...toCandidates("api", "uses", extraction.httpRoutes),
    ...toCandidates("concept", "related_to", extraction.deprecatedMarkers),
    ...toCandidates("version", "versioned_as", extraction.versionHints),
    ...toCandidates("concept", "related_to", extraction.warnings),
  ];
}

function codeBlockCandidates(value: string): EntityCandidate[] {
  const extracted = extractDeterministicEntities(value);
  return [
    ...toCandidates("package", "requires", extracted.packages),
    ...toCandidates("package", "uses", extracted.imports.filter(isExternalImport)),
    ...toCandidates("env_var", "uses", extracted.envVars),
    ...toCandidates("cli_command", "uses", extracted.cliCommands),
    ...toCandidates("api", "uses", extracted.httpRoutes),
  ];
}

function isExternalImport(value: string): boolean {
  return !value.startsWith(".")
    && !value.startsWith("/")
    && !value.startsWith("#")
    && !/^[a-z][a-z0-9+.-]*:/i.test(value);
}

function toCandidates(
  type: EntityType,
  edgeType: EdgeType,
  values: string[],
): EntityCandidate[] {
  return values.map((name) => ({
    id: deterministicEntityId(type, name),
    name,
    type,
    edgeType,
  }));
}

function addEntity(
  entityMap: Map<string, Entity>,
  candidate: EntityCandidate,
  pageId: string,
  evidence: Evidence,
): void {
  const current = entityMap.get(candidate.id);
  if (current === undefined) {
    entityMap.set(candidate.id, {
      id: candidate.id,
      type: candidate.type,
      name: candidate.name,
      aliases: [],
      sourcePageIds: [pageId],
      evidence: [evidence],
    });
    return;
  }
  current.sourcePageIds = stableUnique([...current.sourcePageIds, pageId]);
  current.evidence = stableEvidence([...current.evidence, evidence]);
}

function addEdge(
  edgeMap: Map<string, Edge>,
  from: string,
  to: string,
  type: EdgeType,
  evidence: Evidence,
  confidence: number,
): void {
  const key = `${from}\0${type}\0${to}`;
  const current = edgeMap.get(key);
  if (current === undefined) {
    edgeMap.set(key, { from, to, type, evidence: [evidence], confidence });
    return;
  }
  current.evidence = stableEvidence([...current.evidence, evidence]);
}

function chunkEvidence(page: DocPage, chunk: Chunk): Evidence {
  const headingText = chunk.headingPath.at(-1);
  const matchingHeadings = page.headings.filter(
    (candidate) => candidate.text === headingText,
  );
  const heading = matchingHeadings.length === 1 ? matchingHeadings[0] : undefined;
  return {
    source: heading === undefined ? "page" : "heading",
    pageId: page.id,
    headingId: heading?.id,
    url: page.canonicalUrl ?? page.sourceUrl,
    repoPath: page.repoPath,
    quote: chunk.text,
  };
}

function validateReferences(agentMap: AgentMap): void {
  const entityIds = new Set(agentMap.entities.map((entity) => entity.id));
  for (const chunk of agentMap.chunks) {
    for (const entityId of chunk.entityIds) {
      if (!entityIds.has(entityId)) {
        throw new Error(`Chunk ${chunk.id} references missing entity ${entityId}.`);
      }
    }
  }
  const nodeIds = new Set([
    ...agentMap.pages.map((page) => page.id),
    ...agentMap.entities.map((entity) => entity.id),
  ]);
  for (const edge of agentMap.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new Error(
        `Edge ${edge.from} ${edge.type} ${edge.to} references a missing node.`,
      );
    }
  }
}

function evidenceForCodeBlock(
  page: DocPage,
  codeBlockId: string,
  value: string,
): Evidence {
  return {
    source: "code_block",
    pageId: page.id,
    codeBlockId,
    url: page.canonicalUrl ?? page.sourceUrl,
    repoPath: page.repoPath,
    quote: value,
  };
}

function resolveTargetPage(value: string, pages: DocPage[]): DocPage | undefined {
  const aliases = new Set(referenceAliases(value));
  return pages.find((page) =>
    [page.canonicalUrl, page.sourceUrl, page.repoPath]
      .filter((candidate): candidate is string => candidate !== undefined)
      .some((candidate) =>
        referenceAliases(candidate).some((alias) => aliases.has(alias)),
      ),
  );
}

function normalizeReference(value: string): string {
  const withoutHash = value.split("#", 1)[0] ?? value;
  return withoutHash.length > 1 ? withoutHash.replace(/\/+$/, "") : withoutHash;
}

function referenceAliases(value: string): string[] {
  const normalized = normalizeReference(value);
  if (normalized.includes("://")) {
    return [normalized];
  }
  const withoutMarkdownExtension = normalized.replace(/\.(?:md|mdx)$/i, "");
  const withoutIndex = withoutMarkdownExtension.replace(/\/index$/i, "");
  return [...new Set([normalized, withoutMarkdownExtension, withoutIndex])];
}

function sortEntity(entity: Entity): Entity {
  return {
    ...entity,
    aliases: stableUnique(entity.aliases),
    sourcePageIds: stableUnique(entity.sourcePageIds),
    evidence: stableEvidence(entity.evidence),
  };
}

function sortEdge(edge: Edge): Edge {
  return { ...edge, evidence: stableEvidence(edge.evidence) };
}

function stableEvidence(evidence: Evidence[]): Evidence[] {
  const byValue = new Map(evidence.map((item) => [JSON.stringify(item), item]));
  return [...byValue.values()].sort((left, right) =>
    compareStrings(JSON.stringify(left), JSON.stringify(right)),
  );
}

function stableUnique(values: string[]): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function comparePages(left: DocPage, right: DocPage): number {
  return compareStrings(pageSource(left), pageSource(right));
}

function compareChunks(left: Chunk, right: Chunk): number {
  return compareStrings(left.pageId, right.pageId)
    || (left.sourceOrder ?? 0) - (right.sourceOrder ?? 0)
    || compareStrings(left.id, right.id);
}

function compareEntities(left: Entity, right: Entity): number {
  return (
    compareStrings(left.type, right.type) ||
    compareStrings(left.name, right.name) ||
    compareStrings(left.id, right.id)
  );
}

function compareEdges(left: Edge, right: Edge): number {
  return (
    compareStrings(left.from, right.from) ||
    compareStrings(left.type, right.type) ||
    compareStrings(left.to, right.to)
  );
}

function pageSource(page: DocPage): string {
  return page.canonicalUrl ?? page.sourceUrl ?? page.repoPath ?? page.id;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
