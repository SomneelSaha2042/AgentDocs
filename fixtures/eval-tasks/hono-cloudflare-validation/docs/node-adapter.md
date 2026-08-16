# Node.js Adapter

If you are running Hono on Node.js instead of Cloudflare Workers, you must use the Node adapter.

```ts
import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => c.text('Hello Node!'))

serve({
  fetch: app.fetch,
  port: 3000
})
```

> **Warning:** This is only for Node environments. Do not use this pattern if you are deploying to Cloudflare Workers or Edge environments.
