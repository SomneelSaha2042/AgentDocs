# [API Reference](/api)

Ask about this section

Copy for LLM

View as Markdown

The Stripe API is organized around [REST](http://en.wikipedia.org/wiki/Representational_State_Transfer). Our API has predictable resource-oriented URLs, accepts [form-encoded](https://en.wikipedia.org/wiki/POST_\(HTTP\)#Use_for_submitting_web_forms) request bodies, returns [JSON-encoded](http://www.json.org/) responses, and uses standard HTTP response codes, authentication, and verbs.

You can use the Stripe API in [sandboxes](/sandboxes) without affecting your live data or interacting with banking networks. The API key that you use to [authenticate](/api/authentication) the request determines whether the request runs in live mode or in a sandbox. Sandboxes support all v2 APIs. Test mode sandboxes support some [v2 APIs](/testing-use-cases#compare).

The Stripe API doesn’t support bulk updates. You can work on only one object per request.

The Stripe API differs for every account as we release new [versions](/api/versioning) and tailor functionality. [Log in](https://dashboard.stripe.com/login?redirect=https%3A%2F%2Fdocs.stripe.com%2Fapi) to see docs with your test key and data.

Was this section helpful?YesNo

## Just getting started?

Check out our [development quickstart](/get-started/development-environment) guide.

## Not a developer?

Use Stripe’s [no-code options](/payments/no-code) or apps from [our partners](https://stripe.partners/) to get started with Stripe and to do more with your Stripe account—no code required.

Base URL

```
https://api.stripe.com
```

Client Libraries

Ruby

Python

PHP

Java

Node.js

Go

.NET

By default, the Stripe API Docs demonstrate using curl to interact with the API over HTTP. Select one of our official [client libraries](/libraries) to see examples in code.

# [Authentication](/api/authentication)

Ask about this section

Copy for LLM

View as Markdown

The Stripe API uses [API keys](/keys) to authenticate requests. You can view and manage your API keys in [the Stripe Dashboard](https://dashboard.stripe.com/login?redirect=/apikeys).

Test mode secret keys start with `sk_test_` and have unrestricted access to their sandboxes. In live mode, you configure a [restricted API key](/keys#create-restricted-api-key) (starts with `rk_live_`) with specific API permissions. Using a restricted API key with only a subset of API permissions limits the damage a bad actor could cause if they obtained the key. In both test mode and live mode, you can create as many restricted API keys as you need for different use cases or components of your application. We also create a live mode secret key (starts with `sk_live_`) that grants access to all Stripe API resources. To protect your business, use restricted API keys instead.

Your API keys carry many privileges. Follow [best practices](/keys-best-practices) to keep your keys safe. Don’t embed secret or restricted API keys in source code or client-side applications. Instead, use your server platform’s secrets vault to provide keys to your server-side applications. If your platform doesn’t offer a secrets vault, set your keys in environment variables.

Make all API requests over [HTTPS](http://en.wikipedia.org/wiki/HTTP_Secure). Calls made over plain HTTP fail. API requests without authentication also fail.

Was this section helpful?YesNo

Authenticated Request

```
curl https://api.stripe.com/v1/charges \  -u sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:# The colon prevents curl from asking for a password.
```

Your API Key

A sample test API key is included in all the examples here, so you can test any example right away. Do not submit any personally identifiable information in requests made with this key.

To test requests using your account, replace the sample API key with your actual API key or [sign in](https://dashboard.stripe.com/login?redirect=https%3A%2F%2Fdocs.stripe.com%2Fapi).

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
