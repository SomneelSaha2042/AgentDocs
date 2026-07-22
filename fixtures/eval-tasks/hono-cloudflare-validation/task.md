Implement `app.js` for a Hono application intended for Cloudflare Workers.

Requirements:
1. Import `Hono` from `hono`.
2. Import `validator` from `hono/validator` and use it for JSON body validation on `POST /users`.
3. Export a named `app` and make it the default export.
4. Define `GET /health` returning JSON `{ ok: true }`.
5. Define `POST /users` that accepts JSON `{ username, age }` where `username` must be a string of at least 3 characters and `age` must be a number at least 18.
6. If validation passes, return JSON `{ id: "user_<username>", username, age }` with HTTP 201.
7. The implementation must be Cloudflare Workers compatible: do not use Node `http`, Express, Fastify, or `listen()`.

You MUST consult the documentation tools to find the Hono validator and Cloudflare Worker app export patterns.
Run `npm test` to verify the implementation.