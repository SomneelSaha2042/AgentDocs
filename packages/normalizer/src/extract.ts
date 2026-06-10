import { createHash } from "node:crypto";

const PACKAGE_MANAGERS =
  "(?:npm[\\t ]+(?:install|i)|yarn[\\t ]+add|pnpm[\\t ]+add|bun[\\t ]+add|pip(?:3)?[\\t ]+install|python[\\t ]+-m[\\t ]+pip[\\t ]+install|cargo[\\t ]+add|go[\\t ]+get)";
const HTTP_METHODS = "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE|CONNECT";
const VERSION_PATTERN =
  /(?<!\/)\b(?:v\d+(?:\.\d+){0,2}|version\s+\d+(?:\.\d+){0,2}|\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z.-]+)?)\b/gi;

export type DeterministicExtraction = {
  packages: string[];
  imports: string[];
  envVars: string[];
  cliCommands: string[];
  httpRoutes: string[];
  deprecatedMarkers: string[];
  versionHints: string[];
  warnings: string[];
};

export function extractPackages(value: string): string[] {
  const packages: string[] = [];
  const pattern = new RegExp(`\\b${PACKAGE_MANAGERS}[\\t ]+([^\\r\\n]+)`, "gi");
  for (const match of value.matchAll(pattern)) {
    const command = match[0] ?? "";
    const manager = command.match(new RegExp(`^${PACKAGE_MANAGERS}`, "i"))?.[0] ?? "";
    const args = match[1] ?? "";
    for (const argument of shellWords(args)) {
      if (isShellControl(argument)) {
        break;
      }
      if (isPackageArgument(argument, manager)) {
        packages.push(normalizePackageArgument(argument, manager));
      }
    }
  }
  return stableUnique(packages);
}

function isShellControl(value: string): boolean {
  return /^(?:&&|\|\||\||;|&|\\)$/.test(value);
}

export function extractImports(value: string): string[] {
  const imports: string[] = [];
  const patterns = [
    /\b(?:import|export)\s+(?:[^"'`]*?\s+from\s+)?["']([^"']+)["']/g,
    /\brequire\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      if (match[1] !== undefined) {
        imports.push(match[1]);
      }
    }
  }
  return stableUnique(imports);
}

export function extractEnvVars(value: string): string[] {
  return stableUnique(
    [...value.matchAll(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g)].map(
      (match) => match[0],
    ),
  );
}

export function extractCliCommands(value: string): string[] {
  const commands: string[] = [];
  for (const line of value.split(/\r?\n/)) {
    const candidate = line.trim().replace(/^(?:[$>]\s*)/, "");
    if (
      /^(?:npm|npx|yarn|pnpm|bun|pip3?|python\s+-m\s+pip|cargo|go|docker|git|curl|agentdocs)\b/i.test(
        candidate,
      )
    ) {
      commands.push(candidate);
    }
  }
  return stableUnique(commands);
}

export function extractHttpRoutes(value: string): string[] {
  const routes = [...value.matchAll(new RegExp(`\\b(?:${HTTP_METHODS})\\s+(/[^\\s\`"'<>)]*)`, "gi"))]
    .map((match) => `${match[0]!.split(/\s+/, 1)[0]!.toUpperCase()} ${match[1]}`)
    .filter((route) => route.length > 2);
  return stableUnique(routes);
}

export function extractDeprecatedMarkers(value: string): string[] {
  return stableUnique(
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /\bdeprecated\b|\bdo not use\b|\bno longer supported\b/i.test(line)),
  );
}

export function extractVersionHints(value: string): string[] {
  return stableUnique([...value.matchAll(VERSION_PATTERN)].map((match) => match[0]));
}

export function extractWarnings(value: string): string[] {
  const warnings: string[] = [];
  const lines = value.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!.trim();
    if (/^(?:>\s*)?\[!(?:WARNING|CAUTION|DANGER|SECURITY)\]/i.test(line)) {
      warnings.push(collectQuotedBlock(lines, index));
      continue;
    }
    if (/^:::(?:warning|caution|danger|security)\b/i.test(line)) {
      warnings.push(collectDirectiveBlock(lines, index));
      continue;
    }
    if (/^(?:>\s*)?(?:warning|caution|danger|security)\s*:/i.test(line)) {
      warnings.push(line.replace(/^>\s*/, ""));
    }
  }
  return stableUnique(warnings);
}

export function extractDeterministicEntities(
  value: string,
): DeterministicExtraction {
  return {
    packages: extractPackages(value),
    imports: extractImports(value),
    envVars: extractEnvVars(value),
    cliCommands: extractCliCommands(value),
    httpRoutes: extractHttpRoutes(value),
    deprecatedMarkers: extractDeprecatedMarkers(value),
    versionHints: extractVersionHints(value),
    warnings: extractWarnings(value),
  };
}

export function deterministicEntityId(type: string, name: string): string {
  return `${type}_${createHash("sha256").update(`${type}:${name}`).digest("hex").slice(0, 16)}`;
}

function shellWords(value: string): string[] {
  return [...value.matchAll(/"([^"]+)"|'([^']+)'|(&&|\|\||[|;&\\])|([^\s|;&\\]+)/g)].map(
    (match) => match[1] ?? match[2] ?? match[3] ?? match[4] ?? "",
  );
}

function isPackageArgument(value: string, manager: string): boolean {
  if (value.length === 0 || value.startsWith("-")) {
    return false;
  }
  if (/^go\s+get$/i.test(manager)) {
    return /^[A-Za-z0-9._~/-]+(?:@[^/]+)?$/.test(value);
  }
  return /^(?:@[^/\s]+\/)?[^@/\s][^/\s]*?(?:@[^/\s]+)?$/.test(value);
}

function normalizePackageArgument(value: string, manager: string): string {
  const withoutPunctuation = value.replace(/[;,]$/, "");
  if (/^(?:pip|python)/i.test(manager)) {
    return withoutPunctuation.split(/[=<>!~]/, 1)[0]!;
  }
  if (withoutPunctuation.startsWith("@")) {
    const secondAt = withoutPunctuation.indexOf("@", 1);
    return secondAt === -1
      ? withoutPunctuation
      : withoutPunctuation.slice(0, secondAt);
  }
  return withoutPunctuation.split("@", 1)[0]!;
}

function collectQuotedBlock(lines: string[], start: number): string {
  const block = [lines[start]!.trim().replace(/^>\s*/, "")];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (!line.trimStart().startsWith(">")) {
      break;
    }
    block.push(line.trim().replace(/^>\s*/, ""));
  }
  return block.join("\n").trim();
}

function collectDirectiveBlock(lines: string[], start: number): string {
  const block = [lines[start]!.trim()];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (line.trim() === ":::") {
      block.push(":::");
      break;
    }
    block.push(line.trim());
  }
  return block.join("\n").trim();
}

function stableUnique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort(compareStrings);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
