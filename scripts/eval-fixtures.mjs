import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export async function validateFixtureSnapshot(taskDir) {
  const manifestPath = path.join(taskDir, "fixture.manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const docsDir = path.join(taskDir, "docs");
  const files = (await readdir(docsDir))
    .filter((file) => file.endsWith(".md"))
    .sort();
  const hash = createHash("sha256");
  let byteCount = 0;
  const contents = [];
  for (const file of files) {
    const content = await readFile(path.join(docsDir, file));
    byteCount += content.length;
    hash.update(file);
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
    contents.push(content.toString("utf8"));
  }
  const corpusHash = hash.digest("hex");
  const haystack = contents.join("\n").toLowerCase();
  const requiredEvidence = manifest.evaluation?.requiredEvidence ?? [];
  const missingEvidence = requiredEvidence.filter(
    (term) => !haystack.includes(String(term).toLowerCase()),
  );
  const requiredFiles = [
    "fixture.manifest.json",
    "task.md",
    "test.mjs",
    "package.json",
    "evaluation/private-test.mjs",
  ];
  const filePresence = await Promise.all(requiredFiles.map((file) => exists(path.join(taskDir, file))));
  const missingRequiredFiles = requiredFiles.filter((file, index) => !filePresence[index]);
  const source = manifest.source ?? {};
  const issues = [];
  if (manifest.evaluation?.status === "quarantined") {
    issues.push(`fixture is quarantined: ${manifest.evaluation.quarantineReason ?? "no reason recorded"}`);
  }
  const packageJson = JSON.parse(await readFile(path.join(taskDir, "package.json"), "utf8"));
  const dependencyRanges = Object.entries({
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  }).filter(([, version]) => typeof version === "string" && /^[~^*]|latest$/i.test(version));
  if (source.format !== "markdown") issues.push("source format must be markdown");
  if (files.length !== source.pageCount) issues.push(`page count mismatch: ${files.length} != ${source.pageCount}`);
  if (byteCount !== source.byteCount) issues.push(`byte count mismatch: ${byteCount} != ${source.byteCount}`);
  if (corpusHash !== source.corpusHash) issues.push("corpus hash mismatch");
  if (missingEvidence.length > 0) issues.push(`missing required evidence: ${missingEvidence.join(", ")}`);
  if (dependencyRanges.length > 0) issues.push(`dependency versions must be exact: ${dependencyRanges.map(([name]) => name).join(", ")}`);
  if (missingRequiredFiles.length > 0) issues.push(`missing fixture files: ${missingRequiredFiles.join(", ")}`);
  if (manifest.schemaVersion === 2) {
    issues.push(...validateProvenanceManifest(manifest, files, contents));
  }
  return {
    task: manifest.task,
    valid: issues.length === 0,
    issues,
    pageCount: files.length,
    byteCount,
    corpusHash,
    missingEvidence,
  };
}

function validateProvenanceManifest(manifest, files, contents) {
  const issues = [];
  const sources = Array.isArray(manifest.sources) ? manifest.sources : [];
  const fileRecords = Array.isArray(manifest.files) ? manifest.files : [];
  if (sources.length === 0) issues.push("provenance manifest must declare sources");
  if (fileRecords.length !== files.length) issues.push(`provenance file count mismatch: ${fileRecords.length} != ${files.length}`);
  if (manifest.evaluation?.requiredEvidence !== undefined) {
    issues.push("provenance manifests must not use oracle-shaped requiredEvidence");
  }
  const sourceById = new Map();
  for (const source of sources) {
    if (!source || typeof source.id !== "string" || source.id.length === 0) {
      issues.push("each provenance source requires a non-empty id");
      continue;
    }
    if (sourceById.has(source.id)) issues.push(`duplicate provenance source id: ${source.id}`);
    sourceById.set(source.id, source);
    if (typeof source.origin !== "string" || !/^https?:\/\//i.test(source.origin)) issues.push(`invalid origin for source ${source.id}`);
    if (typeof source.capturedAt !== "string" || Number.isNaN(Date.parse(source.capturedAt))) issues.push(`source ${source.id} requires a capture timestamp`);
    if (source.derived === true) issues.push(`source ${source.id} is marked derived`);
  }
  const expected = new Set(files);
  const seen = new Set();
  for (const [index, record] of fileRecords.entries()) {
    if (!record || typeof record.path !== "string" || typeof record.sourceId !== "string" || typeof record.sourceUrl !== "string") {
      issues.push(`provenance file record ${index + 1} is incomplete`);
      continue;
    }
    if (!expected.has(record.path)) issues.push(`provenance file is not in docs: ${record.path}`);
    if (seen.has(record.path)) issues.push(`duplicate provenance file: ${record.path}`);
    seen.add(record.path);
    const source = sourceById.get(record.sourceId);
    if (!source) {
      issues.push(`unknown provenance source ${record.sourceId} for ${record.path}`);
    } else if (!record.sourceUrl.startsWith(String(source.origin).replace(/\/$/, ""))) {
      issues.push(`source URL for ${record.path} is outside declared origin ${source.origin}`);
    }
    const actual = createHash("sha256").update(contents[files.indexOf(record.path)] ?? "").digest("hex");
    if (record.sha256 !== actual) issues.push(`provenance hash mismatch: ${record.path}`);
  }
  for (const file of files) if (!seen.has(file)) issues.push(`missing provenance record: ${file}`);
  return issues;
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

if (process.argv[1]?.endsWith("eval-fixtures.mjs")) {
  const taskName = process.argv[process.argv.indexOf("--task") + 1];
  if (!taskName) {
    console.error("Usage: node scripts/eval-fixtures.mjs --task <task>");
    process.exit(1);
  }
  const taskDir = path.resolve("fixtures", "eval-tasks", taskName);
  const result = await validateFixtureSnapshot(taskDir);
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exit(1);
}
