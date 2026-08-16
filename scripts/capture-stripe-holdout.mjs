import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const taskDir = path.join(repositoryRoot, "fixtures", "eval-tasks", "stripe-webhooks-holdout");
const docsDir = path.join(taskDir, "docs");

const SOURCES = [
  {
    id: "stripe-webhooks-node",
    url: "https://docs.stripe.com/webhooks.md?lang=node",
    file: "stripe-webhooks.md",
  },
  {
    id: "stripe-webhook-signature-node",
    url: "https://docs.stripe.com/webhooks/signature.md?lang=node",
    file: "stripe-webhook-signature.md",
  },
  {
    id: "stripe-checkout-fulfillment",
    url: "https://docs.stripe.com/checkout/fulfillment.md",
    file: "stripe-checkout-fulfillment.md",
  },
  {
    id: "stripe-events-api",
    url: "https://docs.stripe.com/api/events.md",
    file: "stripe-events-api.md",
  },
];

async function capture() {
  const capturedAt = new Date().toISOString();
  await mkdir(docsDir, { recursive: true });
  const records = [];
  const corpusParts = [];
  let byteCount = 0;

  for (const source of SOURCES) {
    const response = await fetch(source.url, {
      headers: { "user-agent": "AgentDocs provenance holdout capture" },
    });
    if (!response.ok) {
      throw new Error(`${source.url} returned HTTP ${response.status}`);
    }
    const content = await response.text();
    const bytes = Buffer.from(content, "utf8");
    const fileHash = createHash("sha256").update(bytes).digest("hex");
    const filePath = path.join(docsDir, source.file);
    await writeFile(filePath, bytes);
    records.push({
      path: source.file,
      sourceId: source.id,
      sourceUrl: response.url,
      sha256: fileHash,
    });
    byteCount += bytes.length;
    corpusParts.push({ file: source.file, content: bytes });
  }

  const corpusHash = createHash("sha256");
  for (const part of corpusParts.sort((left, right) => left.file.localeCompare(right.file))) {
    corpusHash.update(part.file);
    corpusHash.update("\0");
    corpusHash.update(part.content);
    corpusHash.update("\0");
  }
  const manifest = {
    schemaVersion: 2,
    task: "stripe-webhooks-holdout",
    source: {
      type: "official_markdown_snapshot",
      origin: "https://docs.stripe.com/",
      capturedAt,
      provenance: "Captured directly from the official documentation endpoints listed below.",
      format: "markdown",
      pageCount: records.length,
      byteCount,
      corpusHash: corpusHash.digest("hex"),
    },
    sources: SOURCES.map((source) => ({
      id: source.id,
      origin: new URL(source.url).origin,
      capturedAt,
      format: "markdown",
      derived: false,
    })),
    files: records,
    evaluation: {
      oracle: "evaluation/private-test.mjs",
      visibleTest: "test.mjs",
    },
  };
  await writeFile(path.join(taskDir, "fixture.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ task: manifest.task, capturedAt, files: records.length, corpusHash: manifest.source.corpusHash }, null, 2));
}

capture().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
