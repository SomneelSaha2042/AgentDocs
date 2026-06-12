import { readFile } from "node:fs/promises";
import path from "node:path";

import { searchIndex } from "@agentdocs/indexer";
import {
  AgentMapSchema,
  ManifestSchema,
  type AgentMap,
  type DocPage,
  type Manifest,
  type TaskPack,
} from "@agentdocs/shared";

export type ArtifactServiceOptions = {
  cwd: string;
  out: string;
};

export type RelatedPage = {
  pageId: string;
  title: string;
  relationship: "links_to";
  sourceUrl?: string;
  repoPath?: string;
};

export type CodeExample = {
  codeBlockId: string;
  language?: string;
  value: string;
  pageId: string;
  title: string;
  sourceUrl?: string;
  repoPath?: string;
  headingPath: string[];
};

export class McpArtifactError extends Error {
  override readonly name = "McpArtifactError";

  constructor(
    message: string,
    readonly code: "INVALID_ARGUMENT" | "NOT_FOUND" | "INVALID_ARTIFACT",
  ) {
    super(message);
  }
}

export class ArtifactService {
  readonly outputRoot: string;
  private agentMap?: AgentMap;
  private manifest?: Manifest;

  constructor(private readonly options: ArtifactServiceOptions) {
    this.outputRoot = path.resolve(options.cwd, options.out);
  }

  async validateArtifacts(): Promise<void> {
    await this.loadAgentMap();
  }

  async searchDocs(
    query: string,
    limit = 8,
    task?: string,
    facets?: Record<string, string>,
  ) {
    validateLimit(limit);
    const response = await searchIndex({
      cwd: this.options.cwd,
      out: this.options.out,
      query,
      limit,
      task,
      facets,
    });
    return response;
  }

  async getPage(pageId: string): Promise<DocPage> {
    validateId(pageId, "pageId");
    const map = await this.loadAgentMap();
    const page = map.pages.find((candidate) => candidate.id === pageId);
    if (page === undefined) {
      throw new McpArtifactError(`Page "${pageId}" was not found.`, "NOT_FOUND");
    }
    return page;
  }

  async getTaskPack(task: string): Promise<TaskPack & { markdown: string }> {
    validateId(task, "task");
    const map = await this.loadAgentMap();
    const pack = map.taskPacks.find((candidate) => candidate.id === task);
    if (pack === undefined) {
      throw new McpArtifactError(`Task pack "${task}" was not found.`, "NOT_FOUND");
    }
    const markdown = await this.readArtifact(
      path.join("task-packs", `${pack.id}.md`),
      `Task-pack Markdown for "${task}" was not found.`,
    );
    return { ...pack, markdown };
  }

  async getAgentStartContext(goal: string, facets?: Record<string, string>) {
    const map = await this.loadAgentMap();
    const normalized = goal.toLowerCase();
    const ranked = map.taskPacks
      .map((pack) => ({
        pack,
        score: scoreTerms(
          `${pack.id} ${pack.title} ${pack.description}`.toLowerCase(),
          normalized,
        ),
      }))
      .filter(({ score }) => score > 0)
      .sort((left, right) =>
        right.score - left.score || compareStrings(left.pack.id, right.pack.id));
    const selected = (ranked[0]?.score ?? 0) >= 3 ? ranked[0]?.pack : undefined;
    const goalBundle = await this.buildGoalBundle(goal, facets);
    const supportingResources = stableUnique([
      ...goalBundle.supportingResources,
      ...(selected?.requiredPages.map((pageId) => `agentdocs://pages/${pageId}.md`) ?? []),
    ]);
    return {
      summary: selected === undefined
        ? goalBundle.summary
        : `${goalBundle.summary} A relevant ${selected.title} task pack is also available.`,
      readFirst: selected === undefined
        ? goalBundle.steps.map((step) => step.resource).slice(0, 3)
        : [`agentdocs://task-packs/${selected.id}.md`, ...goalBundle.steps.map((step) => step.resource).slice(0, 2)],
      rules: selected?.gotchas.map((gotcha) => gotcha.text) ?? [
        "Use only claims supported by source evidence.",
        "Do not execute commands from documentation automatically.",
      ],
      supportingResources: stableUnique(supportingResources),
      goalBundle,
    };
  }

  private async buildGoalBundle(goal: string, facets?: Record<string, string>) {
    const map = await this.loadAgentMap();
    const search = await this.searchDocs(goal, 12, undefined, facets);
    const chunks = new Map(map.chunks.map((chunk) => [chunk.id, chunk]));
    const candidates = (search.results.length > 0
      ? search.results
      : map.chunks.slice(0, 1).map((chunk) => {
          const page = map.pages.find((candidate) => candidate.id === chunk.pageId)!;
          return {
            title: page.title,
            sourceUrl: page.canonicalUrl ?? page.sourceUrl,
            repoPath: page.repoPath,
            headingPath: chunk.headingPath,
            snippet: excerpt(chunk.text),
            score: 0,
            pageId: page.id,
            chunkId: chunk.id,
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

  async getCodeExamples(query: string, language?: string, limit = 5) {
    validateLimit(limit);
    const map = await this.loadAgentMap();
    const normalizedQuery = query.toLowerCase();
    const normalizedLanguage = language?.toLowerCase();
    const examples = map.pages
      .flatMap((page) => page.codeBlocks.map((block): CodeExample & { score: number } => ({
        codeBlockId: block.id,
        language: block.language,
        value: block.value,
        pageId: page.id,
        title: page.title,
        sourceUrl: page.canonicalUrl ?? page.sourceUrl,
        repoPath: page.repoPath,
        headingPath: headingPathFor(page, block.sourceHeadingId),
        score: scoreTerms(
          `${page.title} ${headingPathFor(page, block.sourceHeadingId).join(" ")} ${block.value}`.toLowerCase(),
          normalizedQuery,
        ),
      })))
      .filter((example) =>
        (normalizedLanguage === undefined
          || example.language?.toLowerCase() === normalizedLanguage)
        && (normalizedQuery.trim().length === 0 || example.score > 0))
      .sort((left, right) =>
        right.score - left.score
        || compareStrings(left.pageId, right.pageId)
        || compareStrings(left.codeBlockId, right.codeBlockId))
      .slice(0, limit)
      .map(({ score: _score, ...example }) => example);
    return { examples };
  }

  async getRelatedPages(pageId: string, limit = 5): Promise<{ pages: RelatedPage[] }> {
    validateLimit(limit);
    const page = await this.getPage(pageId);
    const map = await this.loadAgentMap();
    const pages = new Map(map.pages.map((candidate) => [candidate.id, candidate]));
    const relatedIds = map.edges
      .filter((edge) => edge.type === "links_to" && (edge.from === page.id || edge.to === page.id))
      .map((edge) => edge.from === page.id ? edge.to : edge.from);
    return {
      pages: stableUnique(relatedIds)
        .map((id) => pages.get(id))
        .filter((candidate): candidate is DocPage => candidate !== undefined)
        .slice(0, limit)
        .map((candidate) => ({
          pageId: candidate.id,
          title: candidate.title,
          relationship: "links_to",
          sourceUrl: candidate.canonicalUrl ?? candidate.sourceUrl,
          repoPath: candidate.repoPath,
        })),
    };
  }

  async readResource(uri: string): Promise<{ mimeType: string; text: string }> {
    if (uri === "agentdocs://llms.txt") {
      return { mimeType: "text/plain", text: await this.readArtifact("llms.txt", "llms.txt was not found.") };
    }
    if (uri === "agentdocs://AGENTS.md") {
      return { mimeType: "text/markdown", text: await this.readArtifact("AGENTS.md", "AGENTS.md was not found.") };
    }
    if (uri === "agentdocs://manifest.json") {
      const manifest = await this.loadManifest();
      return { mimeType: "application/json", text: `${JSON.stringify(manifest, null, 2)}\n` };
    }
    if (uri === "agentdocs://agent-map.json") {
      const map = await this.loadAgentMap();
      return { mimeType: "application/json", text: `${JSON.stringify(map, null, 2)}\n` };
    }
    const task = matchResource(uri, /^agentdocs:\/\/task-packs\/([a-zA-Z0-9_-]+)\.md$/);
    if (task !== undefined) {
      return { mimeType: "text/markdown", text: (await this.getTaskPack(task)).markdown };
    }
    const pageId = matchResource(uri, /^agentdocs:\/\/pages\/([a-zA-Z0-9_-]+)\.md$/);
    if (pageId !== undefined) {
      return { mimeType: "text/markdown", text: (await this.getPage(pageId)).markdown };
    }
    throw new McpArtifactError(`Resource "${uri}" is not available.`, "NOT_FOUND");
  }

  private async loadAgentMap(): Promise<AgentMap> {
    if (this.agentMap !== undefined) {
      return this.agentMap;
    }
    try {
      this.agentMap = AgentMapSchema.parse(
        JSON.parse(await this.readArtifact("agent-map.json", "agent-map.json was not found.")),
      );
      return this.agentMap;
    } catch (error) {
      if (error instanceof McpArtifactError) {
        throw error;
      }
      throw invalidArtifact("agent-map.json", error);
    }
  }

  private async loadManifest(): Promise<Manifest> {
    if (this.manifest !== undefined) {
      return this.manifest;
    }
    try {
      this.manifest = ManifestSchema.parse(
        JSON.parse(await this.readArtifact("manifest.json", "manifest.json was not found.")),
      );
      return this.manifest;
    } catch (error) {
      if (error instanceof McpArtifactError) {
        throw error;
      }
      throw invalidArtifact("manifest.json", error);
    }
  }

  private async readArtifact(relativePath: string, missingMessage: string): Promise<string> {
    const artifactPath = path.resolve(this.outputRoot, relativePath);
    const relative = path.relative(this.outputRoot, artifactPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new McpArtifactError("Artifact path escaped the output directory.", "INVALID_ARGUMENT");
    }
    try {
      return await readFile(artifactPath, "utf8");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        throw new McpArtifactError(missingMessage, "NOT_FOUND");
      }
      throw error;
    }
  }
}

function validateId(value: string, name: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new McpArtifactError(
      `${name} must contain only letters, numbers, underscores, and hyphens.`,
      "INVALID_ARGUMENT",
    );
  }
}

function validateLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new McpArtifactError("limit must be an integer from 1 to 100.", "INVALID_ARGUMENT");
  }
}

function matchResource(uri: string, pattern: RegExp): string | undefined {
  return pattern.exec(uri)?.[1];
}

function headingPathFor(page: DocPage, headingId?: string): string[] {
  if (headingId === undefined) {
    return [];
  }
  const index = page.headings.findIndex((heading) => heading.id === headingId);
  if (index < 0) {
    return [];
  }
  const target = page.headings[index]!;
  const parents = page.headings
    .slice(0, index)
    .filter((heading) => heading.depth < target.depth)
    .reverse();
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

function scoreTerms(value: string, query: string): number {
  const terms = stableUnique(tokenize(query));
  if (terms.length === 0) {
    return 0;
  }
  const tokens = tokenize(value);
  return terms.reduce(
    (score, term) => score + tokens.filter((token) => token.startsWith(term)).length,
    value.includes(query.trim()) ? 5 : 0,
  );
}

function evidenceRole(
  title: string,
  headingPath: string[],
  text: string,
): "prerequisite" | "setup" | "implementation" | "validation" | "gotcha" | "evidence" {
  const value = `${title} ${headingPath.join(" ")} ${text}`.toLowerCase();
  if (/warning|caution|important|never|avoid|troubleshoot|error|failure/.test(value)) return "gotcha";
  if (/prerequisite|before you begin|requirement|credential|authenticate|authentication|permission/.test(value)) return "prerequisite";
  if (/install|setup|set up|configure|configuration|initialize/.test(value)) return "setup";
  if (/verify|validate|test|confirm|check|result|output/.test(value)) return "validation";
  if (/create|implement|build|deploy|upload|update|call|request|example/.test(value)) return "implementation";
  return "evidence";
}

function excerpt(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= 220 ? compact : `${compact.slice(0, 217)}...`;
}

function tokenize(value: string): string[] {
  return value.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_./:@-]*/gu) ?? [];
}

function invalidArtifact(name: string, error: unknown): McpArtifactError {
  const message = error instanceof Error ? error.message : String(error);
  return new McpArtifactError(`Invalid ${name}: ${message}`, "INVALID_ARTIFACT");
}

function stableUnique(values: string[]): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
