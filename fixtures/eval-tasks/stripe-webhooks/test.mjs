import fs from "node:fs";
import path from "node:path";

const routeFile = path.join(process.cwd(), "app/api/webhooks/route.ts");
if (!fs.existsSync(routeFile) || fs.statSync(routeFile).size === 0) {
  console.error("FAIL: Missing app/api/webhooks/route.ts");
  process.exit(1);
}
console.log("PASS: Stripe webhook route exists.");
