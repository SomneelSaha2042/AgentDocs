# [Expanding Responses](/api/expanding_objects)

Ask about this section

Copy for LLM

View as Markdown

Many objects allow you to request additional information as an expanded response by using the `expand` request parameter. This parameter is available on all API requests, and applies to the response of that request only. You can expand responses in two ways.

In many cases, an object contains the ID of a related object in its response properties. For example, a `Charge` might have an associated Customer ID. You can expand these objects in line with the expand request parameter. The `expandable` label in this documentation indicates ID fields that you can expand into objects.

Some available fields aren’t included in the responses by default, such as the `number` and `cvc` fields for the Issuing Card object. You can request these fields as an expanded response by using the `expand` request parameter.

You can expand recursively by specifying nested fields after a dot (`.`). For example, requesting `payment_intent.customer` on a charge expands the `payment_intent` property into a full PaymentIntent object, then expands the `customer` property on that payment intent into a full Customer object.

You can use the `expand` parameter on any endpoint that returns expandable fields, including list, create, and update endpoints.

Expansions on list requests start with the `data` property. For example, you can expand `data.customers` on a request to list charges and associated customers. Performing deep expansions on numerous list requests might result in slower processing times.

Expansions have a maximum depth of four levels (for example, the deepest expansion allowed when listing charges is `data.payment_intent.customer.default_source`).

You can expand multiple objects at the same time by identifying multiple items in the `expand` array.

-   Related guide: [Expanding responses](/expand)
-   Related video: [Expand](https://www.youtube.com/watch?v=m8Vj_CEWyQc)

Was this section helpful?YesNo

```
curl https://api.stripe.com/v1/charges/ch_3LmzzQ2eZvKYlo2C0XjzUzJV \  -u sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u: \  -d "expand[]"=customer \  -d "expand[]"="payment_intent.customer" \  -G
```

Response

```
{  "id": "ch_3LmzzQ2eZvKYlo2C0XjzUzJV",  "object": "charge",  "customer": {    "id": "cu_14HOpH2eZvKYlo2CxXIM7Pb2",    "object": "customer",    // ...  },  "payment_intent": {    "id": "pi_3MtwBwLkdIwHu7ix28a3tqPa",    "object": "payment_intent",    "customer": {      "id": "cus_NffrFeUfNV2Hib",      "object": "customer",      // ...    },    // ...  },  // ...}
```

# [Idempotent requests](/api/idempotent_requests)

Ask about this section

Copy for LLM

View as Markdown

The API supports [idempotency](https://en.wikipedia.org/wiki/Idempotence) for safely retrying requests without accidentally performing the same operation twice. When creating or updating an object, use an idempotency key. Then, if a connection error occurs, you can safely repeat the request without risk of creating a second object or performing the update twice.

To perform an idempotent request, provide an additional `IdempotencyKey` element to the request options.

Stripe’s idempotency works by saving the resulting status code and body of the first request made for any given idempotency key, regardless of whether it succeeds or fails. Subsequent requests with the same key return the same result, including `500` errors.

A client generates an idempotency key, which is a unique key that the server uses to recognize subsequent retries of the same request. How you create unique keys is up to you, but we suggest using V4 UUIDs, or another random string with enough entropy to avoid collisions. Idempotency keys are up to 255 characters long. Avoid using sensitive data (for example, email addresses or personal identifiers) as idempotency keys.

You can remove keys from the system automatically after they’re at least 24 hours old. We generate a new request if a key is reused after the original is pruned. The idempotency layer compares incoming parameters to those of the original request and errors if they’re not the same to prevent accidental misuse.

We save results only after the execution of an endpoint begins. If incoming parameters fail validation, or the request conflicts with another request that’s executing concurrently, we don’t save the idempotent result because no API endpoint initiates the execution. You can retry these requests. Learn more about when you can [retry idempotent requests](/error-low-level#idempotency).

All `POST` requests accept idempotency keys. Don’t send idempotency keys in `GET` and `DELETE` requests because it has no effect. These requests are idempotent by definition.

Was this section helpful?YesNo

```
curl https://api.stripe.com/v1/customers \  -u sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u: \  -H "Idempotency-Key: KG5LxwFBepaKHyUD" \  -d description="My First Test Customer (created for API docs at https://docs.stripe.com/api)"
```

# [Include-dependent response values (API v2)](/api/include_dependent_response_values)

Ask about this section

Copy for LLM

View as Markdown

Some API v2 responses contain null values for certain properties by default, regardless of their actual values. That reduces the size of response payloads while maintaining the basic response structure. To retrieve the actual values for those properties, specify them in the `include` array request parameter.

To determine whether you need to use the `include` parameter in a given request, look at the request description. The `include` parameter’s enum values represent the response properties that depend on the `include` parameter.

Note

Whether a response property defaults to null depends on the request endpoint, not the object that the endpoint references. If multiple endpoints return data from the same object, a particular property can depend on `include` in one endpoint and return its actual value by default for a different endpoint.

A hash property can depend on a single `include` value, or on multiple `include` values associated with its child properties. For example, when updating an Account, to return actual values for the entire `identity` hash, specify `identity` in the `include` parameter. Otherwise, the `identity` hash is null in the response. However, to return actual values for the `configuration` hash, you must specify individual configurations in the request. If you specify at least one configuration, but not all of them, specified configurations return actual values and unspecified configurations return null. If you don’t specify any configurations, the `configuration` hash is null in the response.

-   Related guide: [Include-dependent response values](/api-includable-response-values)

```
curl -X POST https://api.stripe.com/v2/core/accounts \  -H "Authorization: Bearer sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u" \  -H "Stripe-Version: 2026-06-24.preview" \  --json '{    "include": [        "identity",        "configuration.customer"    ]  }'
```

Included response properties

The response includes actual values for the properties specified in the `include` parameter, and null for all other include-dependent properties.

Response

```
{  "id": "acct_123",  "object": "v2.core.account",  "applied_configurations": [    "customer",    "merchant"  ],  "configuration": {    "customer": {      "automatic_indirect_tax": {        ...      },      "billing": {        ...      },      "capabilities": {        ...      },      ...    },    "merchant": null,    "recipient": null  },  "contact_email": "furever@example.com",  "created": "2025-06-09T21:16:03.000Z",  "dashboard": "full",  "defaults": null,  "display_name": "Furever",  "identity": {    "business_details": {      "doing_business_as": "FurEver",      "id_numbers": [        {          "type": "us_ein"        }      ],      "product_description": "Saas pet grooming platform at furever.dev using Connect embedded components",      "structure": "sole_proprietorship",      "url": "http://accessible.stripe.com"    },    "country": "US"  },  "livemode": true,  "metadata": {},  "requirements": null}
```
