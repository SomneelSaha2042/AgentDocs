# Cloudflare Workers Deployment

Export the app for the Workers runtime.

```ts
export default app
```

Do not call `listen()` in a Cloudflare Workers app. The Workers adapter calls the app's `fetch` handler natively.

## Common mistakes

- Do not use Express request/response objects.
- Do not use Fastify schema options in Hono route definitions.
- Do not start a server with Node APIs for Cloudflare Workers.
