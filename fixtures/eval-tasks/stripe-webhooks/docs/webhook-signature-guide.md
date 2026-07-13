# Webhook signature verification

Source excerpt from the Stripe webhook guide:
<https://docs.stripe.com/webhooks>

Stripe requires the raw request body for webhook signature verification. Any
framework processing that changes the raw body can cause verification to fail.
Use the `Stripe-Signature` header together with the endpoint secret and the
official Stripe library.

In Node.js, the library pattern is:

```js
const signature = request.headers["stripe-signature"];
const event = stripe.webhooks.constructEvent(
  request.body,
  signature,
  endpointSecret,
);
```

Catch signature-verification failures and return an unsuccessful response. Once
the event has been verified, branch on `event.type` and acknowledge the event
after handling the supported type.

The event reference includes `checkout.session.completed` as a payment event
type. Keep the signature input unparsed until verification has completed.
