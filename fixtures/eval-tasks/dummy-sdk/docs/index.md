# Dummy SDK Documentation

Welcome to the Dummy SDK.

## Webhooks

We support webhook signature verification. To verify a signature:

1. Import `verifySignature` from `dummy-sdk`.
2. Pass the payload string, signature header string, and the webhook secret string.

```javascript
import { verifySignature } from 'dummy-sdk';
verifySignature(payload, signature, secret);
```
