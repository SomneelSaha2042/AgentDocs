Set up the current Auth.js v5 integration in a Next.js App Router application using GitHub sign-in and a Prisma adapter.

Create:

- the shared authentication configuration in `auth.ts`;
- the App Router catch-all handler at `app/api/auth/[...nextauth]/route.ts`;
- `app/actions.ts` with a Server Action that refuses unauthenticated callers.

Use the current documented integration and exports for this version. Do not use
legacy Pages Router session helpers. Consult the documentation tools to find the
current provider, adapter, handler, and server-action patterns before coding.

Run `node test.mjs` to verify the visible smoke test. Do not install new test
frameworks or overwrite package.json.
