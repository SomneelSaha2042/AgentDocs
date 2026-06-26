Implement a webhook handler script `app.js` that imports `verifySignature` from `dummy-sdk`.
It should export a function `handleWebhook(payload, signature, secret)` that returns true if verification succeeds, and false if it throws.

You MUST:
1. Consult the documentation tools to find the exact signature and usage of `verifySignature`.
2. Verify your implementation by running the existing test suite:
   node test.mjs
Do not install new test frameworks or overwrite package.json.
