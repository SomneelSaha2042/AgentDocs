Implement a script `app.js` that exports an async function `setupApp()`.

The function must return a Fastify instance.

The server must define a POST route `/submit` that:
1. Validates the request body schema using Fastify's built-in schema validator.
2. The schema must require `username` (string, minimum length of 3 characters) and `age` (integer, minimum value of 18).
3. If validation succeeds, it returns `{ status: "ok" }`.

You MUST:
1. Consult the documentation tools to find the correct, recommended Fastify schema validation syntax.
2. Optimize your token usage: to save API costs, avoid reading large raw files entirely. Use targeted search or grep tools to find relevant sections first, and retrieve only the specific chunks or pages containing the required code context.
3. Use ES Module imports and exports (e.g. `import fastify from 'fastify'` and `export async function setupApp`). Do not use CommonJS `require` or `module.exports`.
4. Verify your implementation by running the existing test suite:
   node test.mjs
Do not install new test frameworks or overwrite package.json.
