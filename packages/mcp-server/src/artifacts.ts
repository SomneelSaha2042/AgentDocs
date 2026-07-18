import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

import { searchIndex } from "@agentdocs/indexer";
import {
  AgentMapSchema,
  BuildStateSchema,
  ManifestSchema,
  StatusReportSchema,
  TaskContextAssembler,
  type AgentMap,
  type ContextVerification,
  type HandoffBundle,
  type DocPage,
  type Manifest,
  type StatusReport,
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

  async queryDocs(
    goal: string,
    task?: string,
    facets?: Record<string, string>,
    limit = 5,
  ) {
    validateContextLimit(limit);
    const freshness = await this.getRecordedStatus();
    const input = await this.buildContextInput({ goal, task, facets, limit, freshness });
    return input.decision.query;
  }

  async readPage(options: {
    pageId?: string;
    chunkId?: string;
    heading?: string;
    maxChars?: number;
    fullPage?: boolean;
  }) {
    if (options.pageId !== undefined) validateId(options.pageId, "pageId");
    if (options.chunkId !== undefined) validateId(options.chunkId, "chunkId");
    if (options.pageId === undefined && options.chunkId === undefined) {
      throw new McpArtifactError("pageId or chunkId is required.", "INVALID_ARGUMENT");
    }
    const maxChars = options.maxChars ?? 4000;
    if (!Number.isInteger(maxChars) || maxChars < 1 || maxChars > 50000) {
      throw new McpArtifactError("maxChars must be an integer from 1 to 50000.", "INVALID_ARGUMENT");
    }
    try {
      const map = await this.loadAgentMap();
      return new TaskContextAssembler({ agentMap: map }).readPage(options);
    } catch (error) {
      if (error instanceof Error && /was not found/.test(error.message)) {
        throw new McpArtifactError(error.message, "NOT_FOUND");
      }
      if (error instanceof Error && /is required/.test(error.message)) {
        throw new McpArtifactError(error.message, "INVALID_ARGUMENT");
      }
      throw error;
    }
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
    const input = await this.buildContextInput({ goal, facets });
    const decision = input.decision;
    return {
      summary: decision.summary,
      readFirst: decision.readFirst,
      rules: decision.rules,
      supportingResources: decision.supportingResources,
      goalBundle: decision.goalBundle,
    };
  }

  async listAvailableTasks() {
    const map = await this.loadAgentMap();
    return {
      tasks: map.taskPacks.map((pack) => ({
        id: pack.id,
        title: pack.title,
        confidence: pack.confidence,
        requiredPages: pack.requiredPages,
        resources: [`agentdocs://task-packs/${pack.id}.md`],
        warnings: [
          ...(pack.confidence === "low" ? ["Evidence is weak."] : []),
          ...pack.context.conflicts.map((conflict) =>
            `Conflicting ${conflict.key} context: ${conflict.values.join(", ")}.`),
        ],
      })),
    };
  }

  async getContextBundle(goal: string, facets?: Record<string, string>) {
    const { assembler, decision, search } = await this.buildContextInput({ goal, facets });
    const selected = decision.selectedTaskPack === undefined
      ? undefined
      : await this.getTaskPack(decision.selectedTaskPack.id);
    return assembler.buildContextBundle({
      goal,
      facets,
      search,
      selectedTaskPackMarkdown: selected?.markdown,
    });
  }

  async getTaskContext(
    goal: string,
    facets?: Record<string, string>,
    options: {
      freshness?: StatusReport;
      mcpCommand?: string;
      setupCommands?: string[];
    } = {},
  ): Promise<HandoffBundle> {
    const { assembler, decision, search } = await this.buildContextInput({
      goal,
      facets,
      freshness: options.freshness,
    });
    const selected = decision.selectedTaskPack === undefined
      ? undefined
      : await this.getTaskPack(decision.selectedTaskPack.id);
    const setup = options.setupCommands === undefined ? await this.getSetupCommands() : { commands: options.setupCommands };
    const freshness = options.freshness ?? await this.getRecordedStatus();
    return assembler.buildHandoffBundle({
      goal,
      facets,
      search,
      freshness,
      selectedTaskPackMarkdown: selected?.markdown,
      setupCommands: setup.commands,
      mcp: {
        command: options.mcpCommand ?? "agentdocs serve-mcp --tools query_docs,read_page",
        prompt: "Use the AgentDocs MCP server before web search. Call query_docs once first. If readiness is INSPECT, read one cited source before writing; if STOP, resolve the warning before implementing.",
        suggestedTools: ["query_docs", "read_page"],
      },
    });
  }

  async verifyTaskContext(
    task: string,
    facets?: Record<string, string>,
    freshnessOverride?: StatusReport,
  ): Promise<ContextVerification> {
    const freshness = freshnessOverride ?? await this.getRecordedStatus();
    const input = await this.buildContextInput({ goal: task, facets, freshness });
    return input.decision.verification;
  }

  private async buildContextInput(options: {
    goal: string;
    task?: string;
    facets?: Record<string, string>;
    freshness?: StatusReport;
    limit?: number;
  }) {
    const map = await this.loadAgentMap();
    const assembler = new TaskContextAssembler({ agentMap: map });
    const decision = await assembler.resolveContextDecision({
      goal: options.goal,
      task: options.task,
      facets: options.facets,
      freshness: options.freshness,
      limit: options.limit,
      search: ({ query, limit, task, facets }) => this.searchDocs(query, limit, task, facets),
    });
    return { assembler, decision, search: decision.search };
  }

  async explainWarning(code: string) {
    const explanations: Record<string, string> = {
      context_conflict: "Results or task packs contain mutually exclusive context such as multiple versions, frameworks, routers, or runtimes.",
      stale_context: "The built AgentDocs artifacts are stale or their freshness cannot be verified from recorded build state.",
      weak_evidence: "The selected task pack was generated from limited evidence and requires manual review before implementation.",
      missing_task_pack: "No task-specific context bundle matched the requested goal.",
      deprecated_evidence: "The selected context includes deprecated evidence or warnings that should not be used without replacement guidance.",
      no_canonical_code_examples: "The selected context has source-backed prose but no canonical code example for the goal.",
      missing_source_steps: "The selected context did not produce source-backed implementation steps for the goal.",
    };
    return {
      code,
      explanation: explanations[code] ?? "Unknown warning code. Inspect task-pack evidence and source pages before using this context.",
    };
  }

  async getSetupCommands() {
    const map = await this.loadAgentMap();
    const commands = stableUnique(map.entities
      .filter((entity) => entity.type === "cli_command")
      .map((entity) => entity.name)
      .filter((command) => /^(?:npm\s+(?:install|i)|yarn\s+add|pnpm\s+add|bun\s+add|pip(?:3)?\s+install|python\s+-m\s+pip\s+install|cargo\s+add|go\s+get)\b/i.test(command)));
    return { commands };
  }

  async getVersionPolicy() {
    const map = await this.loadAgentMap();
    const manifest = await this.loadManifest().catch(() => undefined);
    const versions = stableUnique(map.entities
      .filter((entity) => entity.type === "version")
      .map((entity) => entity.name));
    return {
      preferredVersion: manifest?.project.version,
      versionEvidence: versions,
      policy: manifest?.project.version !== undefined
        ? `Prefer configured version ${manifest.project.version}.`
        : versions.length > 0
          ? `Version evidence found: ${versions.join(", ")}. Verify task context before mixing versions.`
          : "Unknown. No version policy evidence found.",
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

  private async getRecordedStatus(): Promise<StatusReport> {
    const checkedAt = new Date().toISOString();
    let state;
    try {
      state = BuildStateSchema.parse(
        JSON.parse(await this.readArtifact("state/build-state.json", "build-state.json was not found.")),
      );
    } catch {
      return StatusReportSchema.parse({
        schemaVersion: 1,
        checkedAt,
        state: "unknown",
        outputDir: this.options.out,
        summary: "Freshness is unknown because build-state.json is missing or invalid.",
        sources: [],
        artifacts: [],
        recommendations: ['Run "agentdocs status" or "agentdocs build" outside MCP for live source checks.'],
      });
    }
    const sources = state.sources.map((source) => {
      const expired = source.expiresAt !== undefined && Date.parse(source.expiresAt) <= Date.parse(checkedAt);
      return {
        id: source.id,
        type: source.type,
        value: source.value,
        state: expired ? "stale" as const : "fresh" as const,
        reason: expired ? "Website source TTL has expired." : "Recorded source was fresh when artifacts were built.",
        fileCount: source.fileCount,
        collectedAt: source.collectedAt,
        expiresAt: source.expiresAt,
      };
    });
    const artifacts = await Promise.all(state.artifacts.map(async (artifact) => {
      try {
        const current = await this.readArtifactBuffer(artifact.path, `${artifact.path} was not found.`);
        const hash = hashBuffer(current);
        return {
          path: artifact.path,
          state: hash === artifact.hash ? "fresh" as const : "stale" as const,
          reason: hash === artifact.hash ? "Artifact matches recorded build hash." : "Artifact hash changed since build.",
        };
      } catch {
        return { path: artifact.path, state: "missing" as const, reason: "Artifact is missing." };
      }
    }));
    const reportState = sources.some((source) => source.state === "stale")
      || artifacts.some((artifact) => artifact.state === "stale" || artifact.state === "missing")
      ? "stale"
      : "fresh";
    return StatusReportSchema.parse({
      schemaVersion: 1,
      checkedAt,
      state: reportState,
      outputDir: this.options.out,
      summary: reportState === "fresh"
        ? "Recorded AgentDocs artifacts are fresh."
        : "Recorded AgentDocs artifacts are stale.",
      sources,
      artifacts,
      recommendations: reportState === "fresh"
        ? ["No rebuild required from recorded artifact state."]
        : ['Run "agentdocs status" for live source checks, then "agentdocs rebuild --changed".'],
    });
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
    return (await this.readArtifactBuffer(relativePath, missingMessage)).toString("utf8");
  }

  private async readArtifactBuffer(relativePath: string, missingMessage: string): Promise<Buffer> {
    const artifactPath = path.resolve(this.outputRoot, relativePath);
    const relative = path.relative(this.outputRoot, artifactPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new McpArtifactError("Artifact path escaped the output directory.", "INVALID_ARGUMENT");
    }
    try {
      return await readFile(artifactPath);
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

function validateContextLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > 3) {
    throw new McpArtifactError("limit must be an integer from 1 to 3.", "INVALID_ARGUMENT");
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

function hashBuffer(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
