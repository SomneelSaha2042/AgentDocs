import { describe, expect, it } from "vitest";

import {
  extractCliCommands,
  extractDeprecatedMarkers,
  extractEnvVars,
  extractHttpRoutes,
  extractImports,
  extractPackages,
  extractVersionHints,
  extractWarnings,
} from "./extract.js";

describe("deterministic extractors", () => {
  it("extracts packages, imports, env vars, commands, and routes as text", () => {
    const value = `pnpm add @acme/sdk zod@3
yarn add lodash
bun add hono
pip install requests==2.32
cargo add serde
go get github.com/acme/tool@v1.2.3
import { Client } from "@acme/sdk";
const helper = require("./helper.js");
export ACME_API_KEY="secret"
GET /v1/users/{id}
curl https://example.test
`;

    expect(extractPackages(value)).toEqual([
      "@acme/sdk",
      "github.com/acme/tool",
      "hono",
      "lodash",
      "requests",
      "serde",
      "zod",
    ]);
    expect(extractImports(value)).toEqual(["./helper.js", "@acme/sdk"]);
    expect(extractEnvVars(value)).toEqual(["ACME_API_KEY"]);
    expect(extractCliCommands(value)).toEqual([
      "bun add hono",
      "cargo add serde",
      "curl https://example.test",
      "go get github.com/acme/tool@v1.2.3",
      "pip install requests==2.32",
      "pnpm add @acme/sdk zod@3",
      "yarn add lodash",
    ]);
    expect(extractHttpRoutes(value)).toEqual(["GET /v1/users/{id}"]);
  });

  it("extracts versions, deprecations, and warning admonitions", () => {
    const value = `Use SDK v2.1 with package 3.4.0.

> [!WARNING]
> Never expose the API key.

:::caution
This endpoint is deprecated and no longer supported.
:::
`;
    expect(extractVersionHints(`${value}\nGET /v1/users`)).toEqual(["3.4.0", "v2.1"]);
    expect(extractDeprecatedMarkers(value)).toEqual([
      "This endpoint is deprecated and no longer supported.",
    ]);
    expect(extractWarnings(value)).toEqual([
      ":::caution\nThis endpoint is deprecated and no longer supported.\n:::",
      "[!WARNING]\nNever expose the API key.",
    ]);
  });

  it("stops package extraction at shell control operators", () => {
    expect(extractPackages("pnpm add @acme/sdk&&npm install accidental")).toEqual([
      "@acme/sdk",
    ]);
  });

  it("does not consume the next line after an argument-less install command", () => {
    expect(extractPackages("npm install\ncd /docs\nnpm install\nnpm start")).toEqual([]);
  });

  it("extracts multiline imports from code-like content", () => {
    const value = `\`\`\`ts
import {
  Client,
  type Options,
} from "@acme/sdk";
export {
  helper,
} from "./helper.js";
const lazy = await import("@acme/plugin");
\`\`\`
`;

    expect(extractImports(value)).toEqual([
      "./helper.js",
      "@acme/plugin",
      "@acme/sdk",
    ]);
  });

  it("extracts raw multiline imports even when inline code exists", () => {
    const value = `Use \`client.request()\` for calls.

import {
  Client,
} from "@acme/sdk";
`;

    expect(extractImports(value)).toEqual(["@acme/sdk"]);
  });

  it("does not extract imports from explanatory prose", () => {
    const value = "Use import { Client } from \"@acme/sdk\" in your application code.";

    expect(extractImports(value)).toEqual([]);
  });

  it("extracts HTTP routes from structured route evidence only", () => {
    const value = `Use this endpoint when you need users. You can GET / fetch information in examples.

\`POST /v1/users\`

| Method | Path |
| --- | --- |
| GET | /v1/users/{id} |

\`\`\`http
PATCH /v1/users/{id}
\`\`\`
`;

    expect(extractHttpRoutes(value)).toEqual([
      "GET /v1/users/{id}",
      "PATCH /v1/users/{id}",
      "POST /v1/users",
    ]);
  });

  it("does not extract conversational prose as HTTP routes", () => {
    expect(extractHttpRoutes("Once you GET / fetch the data, POST / to update it."))
      .toEqual([]);
  });
});
