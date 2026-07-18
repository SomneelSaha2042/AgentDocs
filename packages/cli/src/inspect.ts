import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  AgentMapSchema,
  type AgentMap,
  type Edge,
  type Entity,
  type Evidence,
  type TaskPack,
} from "@agentdocs/shared";

export type InspectTarget = "entities" | "links" | "task-pack";

export type InspectOptions = {
  cwd: string;
  id?: string;
  out: string;
  target: string;
};

export type TaskPackInspection = {
  taskPack: TaskPack;
  requiredPages: Array<{
    id: string;
    title: string;
    source: string;
  }>;
  relatedEntities: Array<{
    id: string;
    type: Entity["type"];
    name: string;
  }>;
};

export type InspectResult =
  | { target: "entities"; entities: Entity[] }
  | { target: "links"; links: Edge[] }
  | ({ target: "task-pack" } & TaskPackInspection);

export class InspectError extends Error {
  override readonly name = "InspectError";
}

export async function inspectAgentMap(
  options: InspectOptions,
): Promise<InspectResult> {
  if (
    options.target !== "entities"
    && options.target !== "links"
    && options.target !== "task-pack"
  ) {
    throw new InspectError(
      `Inspect target "${options.target}" is not implemented yet. Available targets: entities, links, task-pack.`,
    );
  }
  const agentMapPath = path.resolve(options.cwd, options.out, "agent-map.json");
  let agentMap: AgentMap;
  try {
    agentMap = AgentMapSchema.parse(
      JSON.parse(await readFile(agentMapPath, "utf8")),
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new InspectError(
        `Agent map not found at ${agentMapPath}. Run "agentdocs build --skip-crawl" first.`,
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new InspectError(`Invalid agent map at ${agentMapPath}: ${message}`);
  }

  if (options.target === "entities") {
    return { target: "entities", entities: agentMap.entities };
  }
  if (options.target === "links") {
    return {
      target: "links",
      links: agentMap.edges.filter((edge) => edge.type === "links_to"),
    };
  }
  return inspectTaskPack(agentMap, options.id);
}

export function formatInspectResult(result: InspectResult): string {
  if (result.target === "entities") {
    if (result.entities.length === 0) {
      return "No entities found.\n";
    }
    return `${result.entities
      .map(
        (entity) =>
          `${entity.type}\t${oneLine(entity.name)}\t${entity.id}\t${entity.sourcePageIds.join(",")}`,
      )
      .join("\n")}\n`;
  }
  if (result.target === "links") {
    if (result.links.length === 0) {
      return "No internal page links found.\n";
    }
    return `${result.links
      .map((edge) => `${edge.from}\t${edge.type}\t${edge.to}`)
      .join("\n")}\n`;
  }
  const pack = result.taskPack;
  return `Task pack: ${pack.title} (${pack.id})
Confidence: ${pack.confidence}
Why generated: ${pack.description}
Selection evidence: ${pack.evidence.length} item(s) from ${pack.requiredPages.length} required page(s)
Code/command evidence: ${taskPackCodeEvidenceStatus(pack)}
Weak evidence reason: ${taskPackWeakEvidenceReason(pack)}
Context conflicts: ${taskPackContextConflicts(pack)}

Required pages
${result.requiredPages.map((page) => `- ${page.title} (${page.id}): ${page.source}`).join("\n")}

Generation evidence
${pack.evidence.map((evidence) => `- ${formatEvidence(evidence)}`).join("\n")}

Steps
${pack.steps.map((step, index) => `${index + 1}. ${step.title}: ${oneLine(step.description)}`).join("\n")}

Related entities
${result.relatedEntities.length === 0
    ? "- None"
    : result.relatedEntities.map((entity) => `- ${entity.type}: ${oneLine(entity.name)} (${entity.id})`).join("\n")}
`;
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function inspectTaskPack(agentMap: AgentMap, id?: string): InspectResult {
  if (id === undefined) {
    throw new InspectError(
      'Task pack ID is required. Usage: agentdocs inspect task-pack <id>.',
    );
  }
  const taskPack = agentMap.taskPacks.find((candidate) => candidate.id === id);
  if (taskPack === undefined) {
    const available = agentMap.taskPacks.map((candidate) => candidate.id).join(", ");
    throw new InspectError(
      `Task pack "${id}" was not found in agent-map.json.${available.length === 0 ? " No task packs are available." : ` Available task packs: ${available}.`}`,
    );
  }
  return {
    target: "task-pack",
    taskPack,
    requiredPages: taskPack.requiredPages.map((pageId) => {
      const page = agentMap.pages.find((candidate) => candidate.id === pageId);
      if (page === undefined) {
        throw new InspectError(
          `Task pack "${id}" references missing required page "${pageId}". Rebuild the AgentDocs artifacts.`,
        );
      }
      return {
        id: page.id,
        title: page.title,
        source: page.canonicalUrl ?? page.sourceUrl ?? page.repoPath ?? page.id,
      };
    }),
    relatedEntities: taskPack.relatedEntities.map((entityId) => {
      const entity = agentMap.entities.find((candidate) => candidate.id === entityId);
      if (entity === undefined) {
        throw new InspectError(
          `Task pack "${id}" references missing related entity "${entityId}". Rebuild the AgentDocs artifacts.`,
        );
      }
      return { id: entity.id, type: entity.type, name: entity.name };
    }),
  };
}

function taskPackCodeEvidenceStatus(pack: TaskPack): string {
  return pack.codeExamples.some(hasCommandOrCodeEvidence)
    ? `${pack.codeExamples.length} selected example(s) include implementation-shaped code or commands.`
    : "No selected implementation-shaped code or command examples.";
}

function taskPackWeakEvidenceReason(pack: TaskPack): string {
  if (pack.confidence === "high") return "none";
  if (pack.context.conflicts.length > 0) return "context conflicts lowered confidence";
  if (pack.codeExamples.length === 0) return "no canonical code examples selected";
  if (!pack.codeExamples.some(hasCommandOrCodeEvidence)) return "selected examples are not implementation-shaped";
  if (pack.requiredPages.length < 2) return "only one required source page supports the task";
  return "requires manual review";
}

function taskPackContextConflicts(pack: TaskPack): string {
  return pack.context.conflicts.length === 0
    ? "none"
    : pack.context.conflicts.map((conflict) => `${conflict.key}=${conflict.values.join("|")}`).join(", ");
}

function hasCommandOrCodeEvidence(value: string): boolean {
  return /\b(?:npm\s+(?:install|i)|yarn\s+add|pnpm\s+add|bun\s+add|pip(?:3)?\s+install|python\s+-m\s+pip\s+install|cargo\s+add|go\s+get)\b/i.test(value)
    || /\b(?:import|require|function|class|const|let|var|new\s+\w+|create\w*|await|return)\b/i.test(value)
    || /\b(?:get|post|put|patch|delete|head|options)\s*(?:\(|\/[\w./:*-]*)/i.test(value)
    || /\.\s*(?:get|post|put|patch|delete|head|options)\s*\(/i.test(value);
}

function formatEvidence(evidence: Evidence): string {
  const source = evidence.url ?? evidence.repoPath ?? evidence.pageId ?? "Unknown source";
  const location = evidence.headingId ?? evidence.codeBlockId;
  const quote = evidence.quote === undefined ? "" : `: ${excerpt(evidence.quote)}`;
  return `${evidence.source} ${source}${location === undefined ? "" : ` (${location})`}${quote}`;
}

function excerpt(value: string): string {
  const compact = oneLine(value);
  return compact.length <= 180 ? compact : `${compact.slice(0, 177)}...`;
}
