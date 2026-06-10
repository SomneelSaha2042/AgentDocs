import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  AgentMapSchema,
  type AgentMap,
  type Edge,
  type Entity,
} from "@agentdocs/shared";

export type InspectTarget = "entities" | "links";

export type InspectOptions = {
  cwd: string;
  out: string;
  target: string;
};

export type InspectResult =
  | { target: "entities"; entities: Entity[] }
  | { target: "links"; links: Edge[] };

export class InspectError extends Error {
  override readonly name = "InspectError";
}

export async function inspectAgentMap(
  options: InspectOptions,
): Promise<InspectResult> {
  if (options.target !== "entities" && options.target !== "links") {
    throw new InspectError(
      `Inspect target "${options.target}" is not implemented yet. Available Phase 5 targets: entities, links.`,
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
  return {
    target: "links",
    links: agentMap.edges.filter((edge) => edge.type === "links_to"),
  };
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
  if (result.links.length === 0) {
    return "No internal page links found.\n";
  }
  return `${result.links
    .map((edge) => `${edge.from}\t${edge.type}\t${edge.to}`)
    .join("\n")}\n`;
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
