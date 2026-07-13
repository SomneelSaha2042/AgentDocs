import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const workspace = path.resolve(process.argv[2] ?? "");
assert.ok(workspace, "workspace path is required");

function source(relativePath) {
  const file = path.join(workspace, relativePath);
  assert.ok(existsSync(file), `missing ${relativePath}`);
  return readFileSync(file, "utf8");
}

const auth = source("auth.ts");
const route = source("app/api/auth/[...nextauth]/route.ts");
const actions = source("app/actions.ts");

assert.match(auth, /next-auth/);
assert.match(auth, /providers\/github/);
assert.match(auth, /@auth\/prisma-adapter/);
assert.match(auth, /(?:export\s+)?(?:const|\{)[^\n]*auth/);
assert.match(auth, /NextAuth\s*\(/);
assert.match(route, /(?:handlers|GET|POST)/);
assert.match(route, /(?:export\s+\{[^}]*GET[^}]*\}|export\s+const\s+(?:GET|POST))/);
assert.match(actions, /auth\s*\(/);
assert.match(actions, /(?:throw|unauthenticated|not\s+logged)/i);
assert.doesNotMatch(auth + route + actions, /getServerSession|pages\/api/i);

console.log("PASS: Auth.js hidden oracle.");
