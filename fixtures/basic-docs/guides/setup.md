# Setup

Configure the client with an environment variable:

```bash
export EXAMPLE_API_KEY="replace-me"
```

## Create a client

```ts
import { Client } from "@example/sdk";

const client = new Client({ apiKey: process.env.EXAMPLE_API_KEY });
```

Return to the [fixture index](../README.md).

## API request

Use `GET /v1/widgets` with SDK v2.1.

> [!WARNING]
> Never expose `EXAMPLE_API_KEY` in client-side code.

The v1 client is deprecated.
