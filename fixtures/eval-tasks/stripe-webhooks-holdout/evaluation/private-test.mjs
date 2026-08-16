import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const workspace = path.resolve(process.argv[2] ?? "");
const routeFile = path.join(workspace, "app/api/webhooks/route.ts");
assert.ok(existsSync(routeFile), "missing webhook route");
const route = readFileSync(routeFile, "utf8");

assert.match(route, /from\s+["']stripe["']/);
assert.match(route, /constructEvent\s*\(/);
assert.match(route, /headers?\.get\s*\(\s*["']stripe-signature["']\s*\)/i);
assert.match(route, /(?:await\s+)?(?:request|req)\.text\s*\(\s*\)/);
assert.match(route, /checkout\.session\.completed/);
assert.match(route, /catch\s*\(/);
assert.doesNotMatch(route, /(?:request|req)\.json\s*\(\s*\)/);

console.log("PASS: Stripe hidden oracle.");
