import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { ArtifactService } from "@agentdocs/mcp-server";
import {
  AgentSetupSnippetSchema,
  BuildStateSchema,
  ContextVerificationSchema,
  HandoffBundleSchema,
  StatusReportSchema,
  type AgentDocsConfig,
  type AgentSetupSnippet,
  type BuildState,
  type ContextVerification,
  type HandoffBundle,
  type SourceLimitConfig,
  type StatusReport,
} from "@agentdocs/shared";
import { minimatch } from "minimatch";

import { buildContextBundle } from "./context.js";

export const PERSISTENT_AGENT_PROMPT =
  "Use the AgentDocs MCP server before web search. Prefer get_task_context or verify_task_context for implementation tasks, and stop if AgentDocs reports stale, mixed-version, deprecated, or weak evidence.";

type ConfiguredSource = AgentDocsConfig["sources"][number];

type SourceFingerprint = BuildState["sources"][number];

type WorkflowContext = {
  config?: AgentDocsConfig;
  configPath: string;
  cwd: string;
  out: string;
};

const ARTIFACT_PATHS = [
  "AGENTS.md",
  "agent-brief.md",
  "agent-map.json",
  "chunks.jsonl",
  "index.sqlite",
  "llms.txt",
  "manifest.json",
];

export function mcpCommand(out: string): string {
  return `agentdocs --out ${quoteArgument(out)} serve-mcp`;
}

export function setupSnippets(out: string, client?: AgentSetupSnippet["client"]): AgentSetupSnippet[] {
  const args = ["--out", out, "serve-mcp"];
  const json = `${JSON.stringify({ mcpServers: { agentdocs: { command: "agentdocs", args } } }, null, 2)}\n`;
  const snippets = [
    AgentSetupSnippetSchema.parse({
      client: "codex",
      title: "Codex MCP config",
      format: "toml",
      contents: `[mcp_servers.agentdocs]\ncommand = "agentdocs"\nargs = ["--out", ${JSON.stringify(out)}, "serve-mcp"]\n`,
      prompt: PERSISTENT_AGENT_PROMPT,
    }),
    AgentSetupSnippetSchema.parse({
      client: "claude",
      title: "Claude MCP config",
      format: "json",
      contents: json,
      prompt: PERSISTENT_AGENT_PROMPT,
    }),
    AgentSetupSnippetSchema.parse({
      client: "cursor",
      title: "Cursor MCP config",
      format: "json",
      contents: json,
      prompt: PERSISTENT_AGENT_PROMPT,
    }),
    AgentSetupSnippetSchema.parse({
      client: "generic",
      title: "Generic MCP command",
      format: "shell",
      contents: `${mcpCommand(out)}\n`,
      prompt: PERSISTENT_AGENT_PROMPT,
    }),
  ];
  return client === undefined ? snippets : snippets.filter((snippet) => snippet.client === client);
}

export function formatSetupSnippets(snippets: AgentSetupSnippet[]): string {
  return `${snippets.map((snippet) => {
    const fence = snippet.format === "toml"
      ? "toml"
      : snippet.format === "json"
        ? "json"
        : "bash";
    return `## ${snippet.title}\n\n\`\`\`${fence}\n${snippet.contents.trimEnd()}\n\`\`\`\n\nAgent prompt:\n${snippet.prompt}`;
  }).join("\n\n")}\n`;
}

export async function writeWorkflowBuildArtifacts(context: WorkflowContext): Promise<BuildState> {
  const outputRoot = path.resolve(context.cwd, context.out);
  const hasWebsiteSource = context.config?.sources.some((source) => source.type === "website") ?? false;
  const generatedAt = hasWebsiteSource ? new Date().toISOString() : "1970-01-01T00:00:00.000Z";
  await writeAgentBrief(context);
  const state = BuildStateSchema.parse({
    schemaVersion: 1,
    generatedAt,
    outputDir: context.out,
    configHash: await optionalConfigHash(context.configPath),
    sources: await fingerprintConfiguredSources(context, generatedAt),
    artifacts: await fingerprintArtifacts(outputRoot),
  });
  const statePath = path.join(outputRoot, "state", "build-state.json");
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return state;
}

export async function readStatusReport(context: WorkflowContext): Promise<StatusReport> {
  const outputRoot = path.resolve(context.cwd, context.out);
  const checkedAt = new Date().toISOString();
  let previous: BuildState | undefined;
  try {
    previous = BuildStateSchema.parse(
      JSON.parse(await readFile(path.join(outputRoot, "state", "build-state.json"), "utf8")),
    );
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      previous = undefined;
    }
  }

  if (previous === undefined) {
    const artifacts = await currentArtifactStates(outputRoot, []);
    return StatusReportSchema.parse({
      schemaVersion: 1,
      checkedAt,
      state: "unknown",
      outputDir: context.out,
      summary: "Freshness is unknown because .agentdocs/state/build-state.json is missing or invalid.",
      sources: [],
      artifacts,
      recommendations: ['Run "agentdocs build" to create build-state.json.'],
    });
  }

  const currentConfigHash = await optionalConfigHash(context.configPath);
  const configChanged = previous.configHash !== currentConfigHash;
  const currentSources = await fingerprintConfiguredSources(context, checkedAt);
  const previousSources = new Map(previous.sources.map((source) => [source.id, source]));
  const sources = currentSources.map((source) => {
    const publicSource = publicSourceStatusFields(source);
    const old = previousSources.get(source.id);
    if (old === undefined) {
      return { ...publicSource, state: "stale" as const, reason: "Source was not present in the last build." };
    }
    if (source.type === "website" && old.expiresAt !== undefined && Date.parse(old.expiresAt) <= Date.parse(checkedAt)) {
      return { ...publicSource, collectedAt: old.collectedAt, expiresAt: old.expiresAt, state: "stale" as const, reason: "Website source TTL has expired." };
    }
    if (source.hash !== old.hash) {
      return { ...publicSource, collectedAt: old.collectedAt, expiresAt: old.expiresAt, state: "stale" as const, reason: "Source fingerprint changed since the last build." };
    }
    return { ...publicSource, collectedAt: old.collectedAt, expiresAt: old.expiresAt, state: "fresh" as const, reason: "Source matches the last build fingerprint." };
  });
  const removedSources = previous.sources
    .filter((source) => !currentSources.some((current) => current.id === source.id))
    .map((source) => ({
      id: source.id,
      type: source.type,
      value: source.value,
      state: "stale" as const,
      reason: "Source was removed from the current config.",
      fileCount: source.fileCount,
      collectedAt: source.collectedAt,
      expiresAt: source.expiresAt,
    }));
  const artifacts = await currentArtifactStates(outputRoot, previous.artifacts);
  const recommendations = [
    configChanged ? 'Run "agentdocs rebuild --changed" because the config changed.' : undefined,
    [...sources, ...removedSources].some((source) => source.state !== "fresh")
      ? 'Run "agentdocs rebuild --changed" to refresh stale sources.'
      : undefined,
    artifacts.some((artifact) => artifact.state === "missing" || artifact.state === "stale")
      ? 'Run "agentdocs build" to regenerate stale or missing artifacts.'
      : undefined,
  ].filter((item): item is string => item !== undefined);
  const state = configChanged
    || sources.some((source) => source.state !== "fresh")
    || removedSources.length > 0
    || artifacts.some((artifact) => artifact.state === "missing" || artifact.state === "stale")
    ? "stale"
    : artifacts.some((artifact) => artifact.state === "unknown")
      ? "unknown"
      : "fresh";
  return StatusReportSchema.parse({
    schemaVersion: 1,
    checkedAt,
    state,
    outputDir: context.out,
    summary: state === "fresh"
      ? "AgentDocs artifacts are fresh."
      : state === "stale"
        ? "AgentDocs artifacts are stale."
        : "AgentDocs artifact freshness is unknown.",
    sources: [...sources, ...removedSources],
    artifacts,
    recommendations: recommendations.length === 0 ? ["No rebuild required."] : recommendations,
  });
}

export function formatStatusReport(report: StatusReport): string {
  const sources = report.sources.length === 0
    ? "- No configured sources could be checked."
    : report.sources.map((source) => `- ${source.state.toUpperCase()}: ${source.value} (${source.reason})`).join("\n");
  const artifacts = report.artifacts.length === 0
    ? "- No artifacts recorded in build state."
    : report.artifacts.map((artifact) => `- ${artifact.state.toUpperCase()}: ${artifact.path} (${artifact.reason})`).join("\n");
  return `AgentDocs status: ${report.state.toUpperCase()}\n${report.summary}\n\nSources:\n${sources}\n\nArtifacts:\n${artifacts}\n\nRecommendations:\n${report.recommendations.map((item) => `- ${item}`).join("\n")}\n`;
}

export async function buildHandoffBundle(context: WorkflowContext, goal: string): Promise<HandoffBundle> {
  const service = new ArtifactService({ cwd: context.cwd, out: context.out });
  const bundle = await buildContextBundle({ cwd: context.cwd, goal, out: context.out });
  const freshness = await readStatusReport(context);
  const setup = await service.getSetupCommands();
  const taskPack = bundle.selectedTaskPack === undefined
    ? undefined
    : await service.getTaskPack(bundle.selectedTaskPack.id);
  const warnings = [
    freshness.state === "fresh" ? undefined : `Freshness ${freshness.state}: ${freshness.summary}`,
    ...bundle.goalBundle.warnings.map((warning) => `${warning.code}: ${warning.key}=${warning.values.join(",")}`),
    ...(taskPack?.context.conflicts.map((conflict) => `context_conflict: ${conflict.key}=${conflict.values.join(",")}`) ?? []),
    taskPack?.confidence === "low" ? "Task-pack evidence is weak." : undefined,
  ].filter((item): item is string => item !== undefined);
  return HandoffBundleSchema.parse({
    schemaVersion: 1,
    goal,
    context: bundle,
    freshness,
    selectedTaskPack: bundle.selectedTaskPack,
    topSources: bundle.search.results.slice(0, 5),
    gotchas: taskPack?.gotchas.map((gotcha) => gotcha.text) ?? bundle.goalBundle.gotchas,
    setupCommands: setup.commands,
    mcp: {
      command: mcpCommand(context.out),
      prompt: PERSISTENT_AGENT_PROMPT,
      suggestedTools: ["get_task_context", "verify_task_context", "search_docs", "find_code_examples"],
      resources: bundle.readFirst,
    },
    warnings,
  });
}

export function formatHandoffBundle(bundle: HandoffBundle): string {
  const sources = bundle.topSources.length === 0
    ? "- No matching source pages found."
    : bundle.topSources.map((source) => `- ${source.title}${source.headingPath.length === 0 ? "" : ` > ${source.headingPath.join(" > ")}`}\n  ${source.sourceUrl ?? source.repoPath ?? source.pageId}`).join("\n");
  const gotchas = bundle.gotchas.length === 0
    ? "- No task-specific gotchas found."
    : bundle.gotchas.map((gotcha) => `- ${gotcha}`).join("\n");
  const warnings = bundle.warnings.length === 0
    ? "- No context warnings."
    : bundle.warnings.map((warning) => `- ${warning}`).join("\n");
  return `AgentDocs handoff: ${bundle.goal}\n\nFreshness: ${bundle.freshness?.state.toUpperCase() ?? "UNKNOWN"}\n${bundle.context.summary}\n\nRead first:\n${bundle.context.readFirst.map((resource) => `- ${resource}`).join("\n")}\n\nTop source pages:\n${sources}\n\nGotchas:\n${gotchas}\n\nMCP:\n- Command: ${bundle.mcp.command}\n- Tools: ${bundle.mcp.suggestedTools.join(", ")}\n- Prompt: ${bundle.mcp.prompt}\n\nWarnings:\n${warnings}\n`;
}

export async function verifyContext(
  context: WorkflowContext,
  task: string,
  facets?: Record<string, string>,
): Promise<ContextVerification> {
  const service = new ArtifactService({ cwd: context.cwd, out: context.out });
  const freshness = await readStatusReport(context);
  const start = await service.getAgentStartContext(task, facets);
  const taskId = /^agentdocs:\/\/task-packs\/([a-zA-Z0-9_-]+)\.md$/.exec(start.readFirst[0] ?? "")?.[1];
  const pack = taskId === undefined ? undefined : await service.getTaskPack(taskId);
  const search = await service.searchDocs(task, 8, taskId, facets);
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

export function formatContextVerification(result: ContextVerification): string {
  const issues = result.issues.length === 0
    ? "- No issues found."
    : result.issues.map((issue) => `- ${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`).join("\n");
  return `Context verification: ${result.status.toUpperCase()}\n${result.summary}\n\nIssues:\n${issues}\n`;
}

async function writeAgentBrief(context: WorkflowContext): Promise<void> {
  const outputRoot = path.resolve(context.cwd, context.out);
  const service = new ArtifactService({ cwd: context.cwd, out: context.out });
  const tasks = await service.listAvailableTasks();
  const versionPolicy = await service.getVersionPolicy();
  const contents = `# AgentDocs Brief

## Project

${context.config?.name ?? "Unknown project"}${context.config?.version === undefined ? "" : ` (${context.config.version})`}

## First Steps

- Start the MCP server with: \`${mcpCommand(context.out)}\`
- Use \`get_task_context\` before reading broad search results.
- Use \`verify_task_context\` before implementing with retrieved context.

## Persistent Agent Prompt

${PERSISTENT_AGENT_PROMPT}

## Preferred Context

${Object.entries(context.config?.context.preferred ?? {}).map(([key, value]) => `- ${key}=${value}`).join("\n") || "Unknown"}

## Task Packs

${tasks.tasks.map((task) => `- ${task.id}: ${task.title} (${task.confidence})`).join("\n") || "No task packs generated."}

## Version Policy

${versionPolicy.policy}
`;
  await writeFile(path.join(outputRoot, "agent-brief.md"), contents, "utf8");
}

async function fingerprintConfiguredSources(
  context: WorkflowContext,
  collectedAt: string,
): Promise<SourceFingerprint[]> {
  const ttlHours = context.config?.freshness.websiteTtlHours ?? 24;
  const sources = context.config?.sources ?? [];
  return Promise.all(sources.map(async (source, index) => {
    if (source.type === "website") {
      const expiresAt = new Date(Date.parse(collectedAt) + ttlHours * 60 * 60 * 1000).toISOString();
      return {
        id: sourceId(source, index),
        type: source.type,
        value: source.url,
        hash: hashJson({
          type: source.type,
          url: source.url,
          include: source.include ?? [],
          exclude: source.exclude ?? [],
          sitemap: source.sitemap,
          facets: source.facets ?? {},
        }),
        collectedAt,
        expiresAt,
      };
    }
    if (source.type === "local_markdown" || source.type === "repo") {
      const allFiles = await markdownFilesForSource(context.cwd, context.out, source);
      const files = await selectMarkdownFilesWithinLimits(allFiles, source.limits);
      const entries = await Promise.all(files.map(async (file) => ({
        path: toPosixPath(path.relative(context.cwd, file)),
        hash: hashBuffer(await readFile(file)),
      })));
      return {
        id: sourceId(source, index),
        type: source.type,
        value: source.path,
        hash: hashJson({
          type: source.type,
          path: source.path,
          include: source.include ?? [],
          exclude: source.exclude ?? [],
          limits: source.limits ?? {},
          entries,
        }),
        fileCount: allFiles.length,
        selectedFileCount: entries.length,
        limits: source.limits,
        collectedAt,
      };
    }
    return {
      id: sourceId(source, index),
      type: source.type,
      value: source.path,
      hash: hashJson(source),
      collectedAt,
    };
  }));
}

async function markdownFilesForSource(
  cwd: string,
  out: string,
  source: Extract<ConfiguredSource, { type: "local_markdown" | "repo" }>,
): Promise<string[]> {
  const root = path.resolve(cwd, source.path);
  const outputRoot = path.resolve(cwd, out);
  const rootStats = await stat(root);
  const files = await discoverMarkdownFiles(root, outputRoot);
  const base = rootStats.isDirectory() ? root : path.dirname(root);
  return files.filter((file) => {
    const relative = toPosixPath(path.relative(base, file));
    const included = source.include === undefined || source.include.length === 0
      || source.include.some((pattern) => minimatch(relative, pattern));
    const excluded = source.exclude?.some((pattern) => minimatch(relative, pattern)) ?? false;
    return included && !excluded;
  });
}

async function selectMarkdownFilesWithinLimits(
  files: string[],
  limits: SourceLimitConfig | undefined,
): Promise<string[]> {
  const selected: string[] = [];
  let selectedBytes = 0;
  for (const file of files) {
    if (limits?.maxFiles !== undefined && selected.length >= limits.maxFiles) break;
    if (limits?.maxPages !== undefined && selected.length >= limits.maxPages) break;
    const size = (await stat(file)).size;
    if (limits?.maxBytes !== undefined && selectedBytes + size > limits.maxBytes) break;
    selected.push(file);
    selectedBytes += size;
  }
  return selected;
}

async function discoverMarkdownFiles(sourcePath: string, excludedDirectory: string): Promise<string[]> {
  const stats = await stat(sourcePath);
  if (stats.isFile()) return isMarkdownFile(sourcePath) ? [sourcePath] : [];
  if (!stats.isDirectory() || isWithin(excludedDirectory, sourcePath)) return [];
  const files: string[] = [];
  for (const entry of await readdir(sourcePath, { withFileTypes: true })) {
    const entryPath = path.join(sourcePath, entry.name);
    if (entry.isDirectory()) files.push(...await discoverMarkdownFiles(entryPath, excludedDirectory));
    else if (entry.isFile() && isMarkdownFile(entryPath)) files.push(entryPath);
  }
  return files.sort(compareStrings);
}

async function fingerprintArtifacts(outputRoot: string): Promise<BuildState["artifacts"]> {
  const taskPackPaths = await listTaskPackPaths(outputRoot);
  const paths = [...ARTIFACT_PATHS, ...taskPackPaths];
  const artifacts = [];
  for (const relativePath of paths.sort(compareStrings)) {
    try {
      artifacts.push({ path: relativePath, hash: hashBuffer(await readFile(path.join(outputRoot, ...relativePath.split("/")))) });
    } catch {
      // Optional artifacts are reported by status rather than recorded in state.
    }
  }
  return artifacts;
}

async function currentArtifactStates(
  outputRoot: string,
  previous: BuildState["artifacts"],
): Promise<StatusReport["artifacts"]> {
  const paths = previous.length === 0 ? ARTIFACT_PATHS : previous.map((artifact) => artifact.path);
  const states = [];
  for (const artifact of paths.map((item) => previous.find((candidate) => candidate.path === item) ?? { path: item, hash: "" })) {
    try {
      const current = hashBuffer(await readFile(path.join(outputRoot, ...artifact.path.split("/"))));
      states.push({
        path: artifact.path,
        state: artifact.hash === "" ? "unknown" as const : current === artifact.hash ? "fresh" as const : "stale" as const,
        reason: artifact.hash === "" ? "Artifact was not recorded in build state." : current === artifact.hash ? "Artifact matches the last build hash." : "Artifact hash changed since the last build.",
      });
    } catch {
      states.push({ path: artifact.path, state: "missing" as const, reason: "Artifact is missing." });
    }
  }
  return states.sort((left, right) => compareStrings(left.path, right.path));
}

async function listTaskPackPaths(outputRoot: string): Promise<string[]> {
  try {
    return (await readdir(path.join(outputRoot, "task-packs")))
      .filter((file) => file.endsWith(".md"))
      .sort(compareStrings)
      .map((file) => `task-packs/${file}`);
  } catch {
    return [];
  }
}

async function optionalConfigHash(configPath: string): Promise<string | undefined> {
  try {
    return hashBuffer(await readFile(configPath));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function sourceId(source: ConfiguredSource, index: number): string {
  const value = source.type === "website" ? source.url : source.path;
  return `${source.type}_${hashString(`${index}:${value}`).slice(0, 12)}`;
}

function hashJson(value: unknown): string {
  return hashString(JSON.stringify(value));
}

function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashBuffer(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function quoteArgument(value: string): string {
  return /\s/.test(value) ? JSON.stringify(value) : value;
}

function isMarkdownFile(filePath: string): boolean {
  return [".md", ".mdx"].includes(path.extname(filePath).toLowerCase());
}

function isWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function publicSourceStatusFields(source: SourceFingerprint) {
  return {
    id: source.id,
    type: source.type,
    value: source.value,
    fileCount: source.fileCount,
    selectedFileCount: source.selectedFileCount,
    limits: source.limits,
  };
}
