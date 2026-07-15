# Next.js App Router webhook route handlers

This fixture preserves the framework-specific request contract needed for the
task. Next.js Route Handlers in the `app` directory use the Web `Request` and
`Response` APIs, unlike Pages Router API routes.

Source snapshots:

- <https://nextjs.org/docs/app/api-reference/file-conventions/route>
- <https://developer.mozilla.org/en-US/docs/Web/API/Request/headers>
- <https://developer.mozilla.org/en-US/docs/Web/API/Headers/get>

For a webhook Route Handler, preserve the body before parsing it and read the
signature from the request's standard `Headers` object:

```ts
export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get("stripe-signature")

  // Pass rawBody, signature, and the endpoint secret to the provider verifier.
  return Response.json({ received: true })
}
```

Do not call `request.json()` before signature verification. The raw body is the
exact input required by the provider's webhook verifier. Return an unsuccessful
response when verification fails, then branch on the verified event type.
