Write a Stripe webhook route handler in Next.js App Router at
`app/api/webhooks/route.ts`.

The handler must authenticate incoming events with the installed Stripe Node.js
library, preserve the request body exactly as received for signature checking,
and handle the `checkout.session.completed` event. Return a safe response for
invalid signatures and a successful response for the handled event.

Consult the documentation tools for the current raw-body and signature
verification pattern before coding. Do not use a parsed JSON body for the
signature check.

Run `node test.mjs` to verify the visible smoke test. Do not install new test
frameworks or overwrite package.json.
