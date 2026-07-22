# Basic Routing

Create a Hono app by importing `Hono` from `hono`.

```ts
import { Hono } from 'hono'

const app = new Hono()
app.get('/health', (c) => c.json({ ok: true }))
```
