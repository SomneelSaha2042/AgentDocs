import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("fixtures", "eval-tasks");

test("private oracles accept known-good contracts and reject plausible wrong ones", async () => {
  const workspace = await mkdtemp(path.join(".dogfood", "oracle-test-"));
  try {
    await writeFiles(workspace, {
      "authjs-v5/auth.ts": `import NextAuth from "next-auth"; import GitHub from "next-auth/providers/github"; import { PrismaAdapter } from "@auth/prisma-adapter"; export const { auth, handlers } = NextAuth({ adapter: PrismaAdapter(db), providers: [GitHub] });`,
      "authjs-v5/app/api/auth/[...nextauth]/route.ts": "export const GET = handlers.GET; export const POST = handlers.POST;",
      "authjs-v5/app/actions.ts": "export async function action() { const session = await auth(); if (!session) throw new Error('not logged in'); }",
      "stripe-webhooks-holdout/app/api/webhooks/route.ts": `import Stripe from "stripe"; export async function POST(request) { const signature = request.headers.get("stripe-signature"); const event = stripe.webhooks.constructEvent(await request.text(), signature, secret); try { if (event.type === "checkout.session.completed") return Response.json({ received: true }); } catch (error) { return new Response("invalid", { status: 400 }); } }`,
      "langchain-js/index.js": `import { ChatOpenAI } from "@langchain/openai"; export async function createResponse(prompt) { const model = new ChatOpenAI({}); const response = await model.invoke(prompt); return response.content; }`,
    });
    for (const task of ["authjs-v5", "stripe-webhooks-holdout", "langchain-js"]) {
      runOracle(task, workspace);
    }

    await writeFile(path.join(workspace, "langchain-js", "index.js"), "export async function wrong() { return 'no docs'; }");
    assert.throws(() => runOracle("langchain-js", workspace));
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

async function writeFiles(workspace, files) {
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(workspace, relativePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content);
  }
}

function runOracle(task, workspace) {
  execFileSync(process.execPath, [
    path.join(root, task, "evaluation", "private-test.mjs"),
    path.join(workspace, task),
  ], { stdio: "pipe" });
}
