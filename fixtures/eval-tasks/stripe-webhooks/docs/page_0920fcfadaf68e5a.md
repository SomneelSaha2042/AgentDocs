# [Webhook Endpoints](/api/webhook_endpoints)

Ask about this section

Copy for LLM

View as Markdown

You can configure [webhook endpoints](https://docs.stripe.com/webhooks/) via the API to be notified about events that happen in your Stripe account or connected accounts.

Most users configure webhooks from [the dashboard](https://dashboard.stripe.com/webhooks), which provides a user interface for registering and testing your webhook endpoints.

Related guide: [Setting up webhooks](https://docs.stripe.com/webhooks/configure)

Was this section helpful?YesNo

[](/api/webhook_endpoints/create)

Create a webhook endpoint

POST/v1/webhook\_endpoints

[](/api/webhook_endpoints/update)

Update a webhook endpoint

POST/v1/webhook\_endpoints/:id

[](/api/webhook_endpoints/retrieve)

Retrieve a webhook endpoint

GET/v1/webhook\_endpoints/:id

[](/api/webhook_endpoints/list)

List all webhook endpoints

GET/v1/webhook\_endpoints

[](/api/webhook_endpoints/delete)

Delete a webhook endpoint

DELETE/v1/webhook\_endpoints/:id

# [The Webhook Endpoint object](/api/webhook_endpoints/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object.
    
-   #### 
    
    api\_versionnullable string
    
    The API version events are rendered as for this webhook endpoint.
    
-   #### 
    
    descriptionnullable string
    
    An optional description of what the webhook is used for.
    
-   #### 
    
    enabled\_eventsarray of strings
    
    The list of events to enable for this endpoint. `['*']` indicates that all events are enabled, except those that require explicit selection.
    
-   #### 
    
    metadataobject
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.
    
-   #### 
    
    secretstring
    
    The endpoint’s secret, used to generate [webhook signatures](https://docs.stripe.com/webhooks/signatures). Only returned at creation.
    
-   #### 
    
    statusstring
    
    The status of the webhook. It can be `enabled` or `disabled`.
    
-   #### 
    
    urlstring
    
    The URL of the webhook endpoint.
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    applicationnullable string
    
-   #### 
    
    createdtimestamp
    
-   #### 
    
    livemodeboolean
    

The Webhook Endpoint object

```
{  "id": "we_1Mr5jULkdIwHu7ix1ibLTM0x",  "object": "webhook_endpoint",  "api_version": null,  "application": null,  "created": 1680122196,  "description": null,  "enabled_events": [    "charge.succeeded",    "charge.failed"  ],  "livemode": false,  "metadata": {},  "secret": "whsec_wRNftLajMZNeslQOP6vEPm4iVx5NlZ6z",  "status": "enabled",  "url": "https://example.com/my/webhook/endpoint"}
```

# [Create a webhook endpoint](/api/webhook_endpoints/create)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/webhook\_endpoints

A webhook endpoint must have a `url` and a list of `enabled_events`. You may optionally specify the Boolean `connect` parameter. If set to true, then a Connect webhook endpoint that notifies the specified `url` about events from all connected accounts is created; otherwise an account webhook endpoint that notifies the specified `url` only about events from your account is created. You can also create webhook endpoints in the [webhooks settings](https://dashboard.stripe.com/account/webhooks) section of the Dashboard.

### Parameters

-   #### 
    
    enabled\_eventsarray of enumsRequired
    
    The list of events to enable for this endpoint. You may specify `['*']` to enable all events, except those that require explicit selection.
    
    Possible enum values
    
    `account.application.authorized`
    
    Occurs whenever a user authorizes an application. Sent to the related application only.
    
    `account.application.deauthorized`
    
    Occurs whenever a user deauthorizes an application. Sent to the related application only.
    
    `account.external_account.created`
    
    Occurs whenever an external account is created.
    
    `account.external_account.deleted`
    
    Occurs whenever an external account is deleted.
    
    `account.external_account.updated`
    
    Occurs whenever an external account is updated.
    
    `account.updated`
    
    Occurs whenever an account status or property has changed.
    
    `application_fee.created`
    
    Occurs whenever an application fee is created on a charge.
    
    `application_fee.refund.updated`
    
    Occurs whenever an application fee refund is updated.
    
    `application_fee.refunded`
    
    Occurs whenever an application fee is refunded, whether from refunding a charge or from [refunding the application fee directly](#fee_refunds). This includes partial refunds.
    
    `balance.available`
    
    Occurs whenever your Stripe balance has been updated (e.g., when a charge is available to be paid out). By default, Stripe automatically transfers funds in your balance to your bank account on a daily basis. This event is not fired for negative transactions.
    
    Show 220 more
    
-   #### 
    
    urlstringRequired
    
    The URL of the webhook endpoint.
    
-   #### 
    
    api\_versionstring
    
    Events sent to this endpoint will be generated with this Stripe Version instead of your account’s default Stripe Version.
    
-   #### 
    
    descriptionstring
    
    An optional description of what the webhook is used for.
    
-   #### 
    
    metadataobject
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to `metadata`.
    

### More parameters

Expand all

-   #### 
    
    connectboolean
    

### Returns

Returns the webhook endpoint object with the `secret` field populated.

```
curl https://api.stripe.com/v1/webhook_endpoints \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d "enabled_events[]=charge.succeeded" \  -d "enabled_events[]=charge.failed" \  --data-urlencode "url=https://example.com/my/webhook/endpoint"
```

Response

```
{  "id": "we_1Mr5jULkdIwHu7ix1ibLTM0x",  "object": "webhook_endpoint",  "api_version": null,  "application": null,  "created": 1680122196,  "description": null,  "enabled_events": [    "charge.succeeded",    "charge.failed"  ],  "livemode": false,  "metadata": {},  "secret": "whsec_wRNftLajMZNeslQOP6vEPm4iVx5NlZ6z",  "status": "enabled",  "url": "https://example.com/my/webhook/endpoint"}
```
