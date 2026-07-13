# [Errors](/api/errors)

Ask about this section

Copy for LLM

View as Markdown

Stripe uses conventional HTTP response codes to indicate the success or failure of an API request. In general: Codes in the `2xx` range indicate success. Codes in the `4xx` range indicate an error that failed given the information provided (e.g., a required parameter was omitted, a charge failed, etc.). Codes in the `5xx` range indicate an error with Stripe’s servers (these are rare).

Some `4xx` errors that could be handled programmatically (e.g., a card is [declined](/declines)) include an [error code](/error-codes) that briefly explains the error reported.

Was this section helpful?YesNo

### Attributes

-   #### 
    
    codenullable string
    
    For some errors that could be handled programmatically, a short string indicating the [error code](/error-codes) reported.
    
-   #### 
    
    decline\_codenullable string
    
    For card errors resulting from a card issuer decline, a short string indicating the [card issuer’s reason for the decline](/declines#issuer-declines) if they provide one.
    
-   #### 
    
    messagenullable string
    
    A human-readable message providing more details about the error. For card errors, these messages can be shown to your users.
    
-   #### 
    
    paramnullable string
    
    If the error is parameter-specific, the parameter related to the error. For example, you can use this to display a message near the correct form field.
    
-   #### 
    
    payment\_intentnullable object
    
    The [PaymentIntent object](/api/payment_intents/object) for errors returned on a request involving a PaymentIntent.
    
-   #### 
    
    typeenum
    
    The type of error returned. One of `api_error`, `card_error`, `idempotency_error`, or `invalid_request_error`
    
    Possible enum values
    
    `api_error`
    
    `card_error`
    
    `idempotency_error`
    
    `invalid_request_error`
    

### More

Expand all

-   #### 
    
    advice\_codenullable string
    
-   #### 
    
    chargenullable string
    
-   #### 
    
    doc\_urlnullable string
    
-   #### 
    
    network\_advice\_codenullable string
    
-   #### 
    
    network\_decline\_codenullable string
    
-   #### 
    
    payment\_methodnullable object
    
-   #### 
    
    payment\_method\_typenullable string
    
-   #### 
    
    request\_log\_urlnullable string
    
-   #### 
    
    setup\_intentnullable object
    
-   #### 
    
    sourcenullable object
    

HTTP Status Code Summary

200

OK

Everything worked as expected.

400

Bad Request

The request was unacceptable, often due to missing a required parameter.

401

Unauthorized

No valid API key provided.

402

Request Failed

The parameters were valid but the request failed.

403

Forbidden

The API key doesn’t have permissions to perform the request.

404

Not Found

The requested resource doesn’t exist.

409

Conflict

The request conflicts with another request (perhaps due to using the same idempotent key).

424

External Dependency Failed

The request couldn’t be completed due to a failure in a dependency external to Stripe.

429

Too Many Requests

Too many requests hit the API too quickly. We recommend an exponential backoff of your requests.

500, 502, 503, 504

Server Errors

Something went wrong on Stripe’s end. (These are rare.)

Error Types

`api_error`

API errors cover any other type of problem (e.g., a temporary problem with Stripe’s servers), and are extremely uncommon.

`card_error`

Card errors are the most common type of error you should expect to handle. They result when the user enters a card that can’t be charged for some reason.

`idempotency_error`

Idempotency errors occur when an `Idempotency-Key` is re-used on a request that does not match the first request’s API endpoint and parameters.

`invalid_request_error`

Invalid request errors arise when your request has invalid parameters.

# [Handling errors](/api/errors/handling)

Ask about this section

Copy for LLM

View as Markdown

Our Client libraries raise exceptions for many reasons, such as a failed charge, invalid parameters, authentication errors, and network unavailability. We recommend writing code that gracefully handles all possible API exceptions.

-   Related guide: [Error Handling](/error-handling)

```
# Select a client library to see examples of# handling different kinds of errors.
```

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
