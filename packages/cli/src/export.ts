import { access, cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

export type ExportFormat = "static" | "llms";

export type ExportOptions = {
  cwd: string;
  force?: boolean;
  format: string;
  out: string;
  to: string;
};

export type ExportResult = {
  destination: string;
  format: ExportFormat;
  source: string;
};

export class ExportInputError extends Error {
  override readonly name = "ExportInputError";
  readonly exitCode = 2;
}

export class ExportError extends Error {
  override readonly name = "ExportError";
  readonly exitCode = 4;
}

const LLMS_ROOT_FILES = [
  "llms.txt",
  "AGENTS.md",
  "agent-brief.md",
  "manifest.json",
  "agent-map.json",
  "documentation-map.json",
  "chunks.jsonl",
];

const LLMS_DIRECTORIES = [
  "task-packs",
  "reports",
];

export async function exportArtifacts(options: ExportOptions): Promise<ExportResult> {
  const format = parseExportFormat(options.format);
  const sourceRoot = path.resolve(options.cwd, options.out);
  const destinationRoot = path.resolve(options.cwd, options.to);
  validateDestination(sourceRoot, destinationRoot);
  await assertBuiltOutput(sourceRoot);
  await prepareDestination(destinationRoot, options.force ?? false);

  if (format === "static") {
    await cp(sourceRoot, destinationRoot, { recursive: true });
  } else {
    await exportLlmsSubset(sourceRoot, destinationRoot);
  }

  return {
    destination: destinationRoot,
    format,
    source: sourceRoot,
  };
}

function parseExportFormat(value: string): ExportFormat {
  if (value === "static" || value === "llms") {
    return value;
  }
  throw new ExportInputError("Export format must be static or llms.");
}

function validateDestination(sourceRoot: string, destinationRoot: string): void {
  if (destinationRoot === sourceRoot || isWithin(sourceRoot, destinationRoot)) {
    throw new ExportInputError("Export destination must not be inside the AgentDocs output directory.");
  }
}

async function assertBuiltOutput(sourceRoot: string): Promise<void> {
  try {
    const stats = await stat(sourceRoot);
    if (!stats.isDirectory()) {
      throw new ExportError(`AgentDocs output is not a directory: ${sourceRoot}`);
    }
    await access(path.join(sourceRoot, "agent-map.json"));
  } catch (error) {
    if (error instanceof ExportError) {
      throw error;
    }
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new ExportError(`No built AgentDocs artifacts found at ${sourceRoot}. Run "agentdocs build" first.`);
    }
    throw error;
  }
}

async function prepareDestination(destinationRoot: string, force: boolean): Promise<void> {
  let entries: string[] | undefined;
  try {
    entries = await readdir(destinationRoot);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      await mkdir(path.dirname(destinationRoot), { recursive: true });
      return;
    }
    throw error;
  }

  if (entries.length > 0 && !force) {
    throw new ExportInputError(`Export destination is not empty: ${destinationRoot}. Pass --force to replace it.`);
  }
  if (force) {
    await rm(destinationRoot, { recursive: true, force: true });
  }
  await mkdir(path.dirname(destinationRoot), { recursive: true });
}

async function exportLlmsSubset(sourceRoot: string, destinationRoot: string): Promise<void> {
  await mkdir(destinationRoot, { recursive: true });
  for (const file of LLMS_ROOT_FILES) {
    await copyIfPresent(path.join(sourceRoot, file), path.join(destinationRoot, file));
  }
  for (const directory of LLMS_DIRECTORIES) {
    await copyIfPresent(path.join(sourceRoot, directory), path.join(destinationRoot, directory));
  }
}

async function copyIfPresent(source: string, destination: string): Promise<void> {
  try {
    await access(source);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
}

function isWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}
