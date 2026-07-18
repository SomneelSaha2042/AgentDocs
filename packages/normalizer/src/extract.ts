import { createHash } from "node:crypto";

const PACKAGE_MANAGERS =
  "(?:npm[\\t ]+(?:install|i)|yarn[\\t ]+add|pnpm[\\t ]+add|bun[\\t ]+add|pip(?:3)?[\\t ]+install|python[\\t ]+-m[\\t ]+pip[\\t ]+install|cargo[\\t ]+add|go[\\t ]+get)";
const HTTP_METHODS = "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE|CONNECT";
const VERSION_PATTERN =
  /(?<!\/)\b(?:v\d+(?:\.\d+){0,2}|version\s+\d+(?:\.\d+){0,2}|\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z.-]+)?)\b/gi;
const HTTP_ROUTE_PATTERN = new RegExp(`\\b(${HTTP_METHODS})\\s+(/[^\\s\`"'<>)]*)`, "gi");

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
    /\b(?:import|export)\s+(?:[^"'`]*?\s+from\s+)?["']([^"']+)["']/gs,
    /\brequire\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
  ];
  const sources = stableUnique([
    ...codeLikeSegments(value),
    ...rawImportStatements(value),
  ]);
  for (const pattern of patterns) {
    for (const source of sources) {
      for (const match of source.matchAll(pattern)) {
        if (match[1] !== undefined) {
          imports.push(match[1]);
        }
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
  const routes = [
    ...codeLikeSegments(value).flatMap(extractRouteMatches),
    ...extractStandaloneRouteLines(value),
    ...extractTableRoutes(value),
  ];
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

function codeLikeSegments(value: string, rawCodeHint?: RegExp): string[] {
  const segments: string[] = [];
  const ranges: Array<[number, number]> = [];
  const fencePattern = /^\s*(`{3,}|~{3,})[^\r\n]*\r?\n/gm;
  let fenceMatch: RegExpExecArray | null;
  while ((fenceMatch = fencePattern.exec(value)) !== null) {
    const openingFence = fenceMatch[1]!;
    const bodyStart = fencePattern.lastIndex;
    const closePattern = new RegExp(`^\\s*${escapeRegExp(openingFence[0]!.repeat(openingFence.length))}${escapeRegExp(openingFence[0]!)}*\\s*$`, "gm");
    closePattern.lastIndex = bodyStart;
    const closeMatch = closePattern.exec(value);
    const bodyEnd = closeMatch?.index ?? value.length;
    segments.push(value.slice(bodyStart, bodyEnd));
    ranges.push([fenceMatch.index, closeMatch === null ? value.length : closePattern.lastIndex]);
    fencePattern.lastIndex = closeMatch === null ? value.length : closePattern.lastIndex;
  }

  for (const match of value.matchAll(/`([^`\r\n]+)`/g)) {
    const start = match.index ?? 0;
    const end = start + match[0]!.length;
    if (!ranges.some(([rangeStart, rangeEnd]) => start >= rangeStart && end <= rangeEnd)) {
      segments.push(match[1]!);
    }
  }

  if (segments.length === 0 && rawCodeHint !== undefined) {
    rawCodeHint.lastIndex = 0;
    if (rawCodeHint.test(value)) {
      rawCodeHint.lastIndex = 0;
      segments.push(value);
    }
  }
  return segments;
}

function rawImportStatements(value: string): string[] {
  const statements: string[] = [];
  const lines = value.split(/\r?\n/);
  let current: string[] = [];

  for (const line of lines) {
    if (current.length === 0) {
      if (!isImportStatementStart(line)) continue;
      current = [line];
    } else {
      current.push(line);
    }

    const statement = current.join("\n");
    if (isCompleteImportStatement(statement)) {
      statements.push(statement);
      current = [];
    }
  }

  return statements;
}

function isImportStatementStart(line: string): boolean {
  return /^\s*(?:import|export)\b/.test(line)
    || /^\s*(?:const|let|var)\s+[\w\s,{}[\]$]+\s*=\s*(?:await\s+)?(?:require|import)\s*\(/.test(line)
    || /^\s*(?:require|import)\s*\(/.test(line);
}

function isCompleteImportStatement(value: string): boolean {
  return /\bfrom\s*["'][^"']+["']\s*;?\s*$/.test(value)
    || /^\s*import\s*["'][^"']+["']\s*;?\s*$/.test(value)
    || /\brequire\(\s*["'][^"']+["']\s*\)\s*;?\s*$/.test(value)
    || /\bimport\(\s*["'][^"']+["']\s*\)\s*;?\s*$/.test(value);
}

function extractRouteMatches(value: string): string[] {
  HTTP_ROUTE_PATTERN.lastIndex = 0;
  return [...value.matchAll(HTTP_ROUTE_PATTERN)]
    .map((match) => `${match[1]!.toUpperCase()} ${cleanRoutePath(match[2]!)}`)
    .filter((route) => route.length > 2);
}

function extractStandaloneRouteLines(value: string): string[] {
  const routes: string[] = [];
  for (const line of value.split(/\r?\n/)) {
    const normalized = line
      .trim()
      .replace(/^>\s*/, "")
      .replace(/^[-*]\s+/, "")
      .trim();
    const match = normalized.match(new RegExp(`^(?:${HTTP_METHODS})\\s+(/[^\\s\`"'<>)]*)\\s*(?:[#;].*)?$`, "i"));
    if (match !== null) {
      routes.push(`${normalized.split(/\s+/, 1)[0]!.toUpperCase()} ${cleanRoutePath(match[1]!)}`);
    }
  }
  return routes;
}

function extractTableRoutes(value: string): string[] {
  const routes: string[] = [];
  for (const line of value.split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());
    for (let index = 0; index < cells.length - 1; index += 1) {
      const method = cells[index]!;
      const route = cells[index + 1]!;
      if (new RegExp(`^(?:${HTTP_METHODS})$`, "i").test(method) && route.startsWith("/")) {
        routes.push(`${method.toUpperCase()} ${cleanRoutePath(route)}`);
      }
    }
  }
  return routes;
}

function cleanRoutePath(value: string): string {
  return value.replace(/[.,;:]+$/g, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stableUnique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort(compareStrings);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
