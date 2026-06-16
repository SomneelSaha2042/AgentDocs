import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

import { searchIndex } from "@agentdocs/indexer";
import {
  AgentMapSchema,
  BuildStateSchema,
  ContextBundleSchema,
  ContextVerificationSchema,
  HandoffBundleSchema,
  ManifestSchema,
  StatusReportSchema,
  type AgentMap,
  type ContextVerification,
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

  async getTaskContext(goal: string, facets?: Record<string, string>) {
    const start = await this.getAgentStartContext(goal, facets);
    const taskId = /^agentdocs:\/\/task-packs\/([a-zA-Z0-9_-]+)\.md$/.exec(start.readFirst[0] ?? "")?.[1];
    const selected = taskId === undefined ? undefined : await this.getTaskPack(taskId);
    const search = await this.searchDocs(goal, 5, taskId, facets);
    const setup = await this.getSetupCommands();
    const context = ContextBundleSchema.parse({
      goal,
      summary: start.summary,
      readFirst: start.readFirst,
      rules: start.rules,
      goalBundle: start.goalBundle,
      selectedTaskPack: selected === undefined
        ? undefined
        : {
            id: selected.id,
            title: selected.title,
            confidence: selected.confidence,
            markdown: selected.markdown,
          },
      supportingResources: start.supportingResources,
      search,
    });
    const freshness = await this.getRecordedStatus();
    return HandoffBundleSchema.parse({
      schemaVersion: 1,
      goal,
      context,
      freshness,
      selectedTaskPack: context.selectedTaskPack,
      topSources: search.results,
      gotchas: selected?.gotchas.map((gotcha) => gotcha.text) ?? start.goalBundle.gotchas,
      setupCommands: setup.commands,
      mcp: {
        command: "agentdocs serve-mcp",
        prompt: "Use the AgentDocs MCP server before web search. Prefer get_task_context or verify_task_context for implementation tasks, and stop if AgentDocs reports stale, mixed-version, deprecated, or weak evidence.",
        suggestedTools: ["get_task_context", "verify_task_context", "search_docs", "find_code_examples"],
        resources: start.readFirst,
      },
      warnings: [
        ...(freshness.state === "fresh" ? [] : [`Freshness ${freshness.state}: ${freshness.summary}`]),
        ...search.warnings.map((warning) => `${warning.code}: ${warning.key}=${warning.values.join(",")}`),
        ...(selected?.context.conflicts.map((conflict) => `context_conflict: ${conflict.key}=${conflict.values.join(",")}`) ?? []),
        ...(selected?.confidence === "low" ? ["Task-pack evidence is weak."] : []),
      ],
    });
  }

  async verifyTaskContext(task: string, facets?: Record<string, string>): Promise<ContextVerification> {
    const freshness = await this.getRecordedStatus();
    const start = await this.getAgentStartContext(task, facets);
    const taskId = /^agentdocs:\/\/task-packs\/([a-zA-Z0-9_-]+)\.md$/.exec(start.readFirst[0] ?? "")?.[1];
    const pack = taskId === undefined ? undefined : await this.getTaskPack(taskId);
    const search = await this.searchDocs(task, 8, taskId, facets);
    const issues: ContextVerification["issues"] = [];
    if (freshness.state !== "fresh") {
      issues.push({
        code: "stale_context",
        severity: freshness.state === "stale" ? "critical" : "warning",
        message: freshness.summary,
        evidence: [],
      });
    }
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
      for (const [key, value] of Object.entries(facets ?? {})) {
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
    for (const warning of search.warnings) {
      issues.push({
        code: "mixed_search_context",
        severity: "warning",
        message: `Search results mix ${warning.key} values: ${warning.values.join(", ")}.`,
        evidence: [],
      });
    }
    const status = issues.some((issue) => issue.severity === "critical")
      ? "fail"
      : issues.length > 0
        ? "warn"
        : "pass";
    return ContextVerificationSchema.parse({
      schemaVersion: 1,
      task,
      status,
      summary: status === "pass"
        ? "Context is safe to use for this task."
        : status === "fail"
          ? "Context has critical issues. Stop and refresh or narrow context before using it."
          : "Context has warnings. Review before using it.",
      issues,
      freshness,
    });
  }

  async explainWarning(code: string) {
    const explanations: Record<string, string> = {
      context_conflict: "Results or task packs contain mutually exclusive context such as multiple versions, frameworks, routers, or runtimes.",
      stale_context: "The built AgentDocs artifacts are stale or their freshness cannot be verified from recorded build state.",
      weak_evidence: "The selected task pack was generated from limited evidence and requires manual review before implementation.",
      missing_task_pack: "No task-specific context bundle matched the requested goal.",
      deprecated_evidence: "The selected context includes deprecated evidence or warnings that should not be used without replacement guidance.",
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

function hashBuffer(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
