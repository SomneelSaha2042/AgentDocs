# [Subscription Schedule](/api/subscription_schedules)

Ask about this section

Copy for LLM

View as Markdown

A subscription schedule allows you to create and manage the lifecycle of a subscription by predefining expected changes.

Related guide: [Subscription schedules](/billing/subscriptions/subscription-schedules)

Was this section helpful?YesNo

[](/api/subscription_schedules/create)

Create a schedule

POST/v1/subscription\_schedules

[](/api/subscription_schedules/update)

Update a schedule

POST/v1/subscription\_schedules/:id

[](/api/subscription_schedules/retrieve)

Retrieve a schedule

GET/v1/subscription\_schedules/:id

[](/api/subscription_schedules/list)

List all schedules

GET/v1/subscription\_schedules

[](/api/subscription_schedules/cancel)

Cancel a schedule

POST/v1/subscription\_schedules/:id/cancel

[](/api/subscription_schedules/release)

Release a schedule

POST/v1/subscription\_schedules/:id/release

# [The Subscription Schedule object](/api/subscription_schedules/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object.
    
-   #### 
    
    current\_phasenullable object
    
    Object representing the start and end dates for the current phase of the subscription schedule, if it is `active`.
    
    Show child attributes
    
-   #### 
    
    customerstringExpandable
    
    ID of the customer who owns the subscription schedule.
    
-   #### 
    
    metadatanullable object
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.
    
-   #### 
    
    phasesarray of objects
    
    Configuration for the subscription schedule’s phases.
    
    Show child attributes
    
-   #### 
    
    statusenum
    
    The present status of the subscription schedule. Possible values are `not_started`, `active`, `completed`, `released`, and `canceled`. You can read more about the different states in our [behavior guide](/billing/subscriptions/subscription-schedules).
    
    Possible enum values
    
    `active`
    
    `canceled`
    
    `completed`
    
    `not_started`
    
    `released`
    
-   #### 
    
    subscriptionnullable stringExpandable
    
    ID of the subscription managed by the subscription schedule.
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    applicationnullable stringExpandableConnect only
    
-   #### 
    
    billing\_modeobject
    
-   #### 
    
    canceled\_atnullable timestamp
    
-   #### 
    
    completed\_atnullable timestamp
    
-   #### 
    
    createdtimestamp
    
-   #### 
    
    customer\_accountnullable string
    
-   #### 
    
    default\_settingsobject
    
-   #### 
    
    end\_behaviorenum
    
-   #### 
    
    livemodeboolean
    
-   #### 
    
    released\_atnullable timestamp
    
-   #### 
    
    released\_subscriptionnullable string
    
-   #### 
    
    test\_clocknullable stringExpandable
    

# [Create a schedule](/api/subscription_schedules/create)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/subscription\_schedules

Creates a new subscription schedule object. Each customer can have up to 500 active or scheduled subscriptions.

### Parameters

-   #### 
    
    customerstring
    
    The identifier of the customer to create the subscription schedule for.
    
-   #### 
    
    metadataobject
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to `metadata`.
    
-   #### 
    
    phasesarray of objects
    
    List representing phases of the subscription schedule. Each phase can be customized to have different durations, plans, and coupons. If there are multiple phases, the `end_date` of one phase will always equal the `start_date` of the next phase.
    
    Show child parameters
    
-   #### 
    
    start\_datetimestamp | string
    
    When the subscription schedule starts. We recommend using `now` so that it starts the subscription immediately. You can also use a Unix timestamp to backdate the subscription so that it starts on a past date, or set a future date for the subscription to start on.
    

### More parameters

Expand all

-   #### 
    
    billing\_modeobject
    
-   #### 
    
    customer\_accountstring
    
-   #### 
    
    default\_settingsobject
    
-   #### 
    
    end\_behaviorenum
    
-   #### 
    
    from\_subscriptionstring
    

### Returns

Returns a subscription schedule object if the call succeeded.

```
curl https://api.stripe.com/v1/subscription_schedules \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d customer={{CUSTOMER_ID}} \  -d start_date=1787130418 \  -d end_behavior=release \  -d "phases[0][items][0][price]={{PRICE_ID}}" \  -d "phases[0][items][0][quantity]=1" \  -d "phases[0][duration][interval]=month" \  -d "phases[0][duration][interval_count]=1"
```

Response

```
{  "id": "sub_sched_1Mr3YdLkdIwHu7ixjop3qtff",  "object": "subscription_schedule",  "application": null,  "canceled_at": null,  "completed_at": null,  "created": 1724058651,  "current_phase": null,  "customer": "cus_NcI8FsMbh0OeFs",  "default_settings": {    "application_fee_percent": null,    "automatic_tax": {      "enabled": false,      "liability": null    },    "billing_cycle_anchor": "automatic",    "collection_method": "charge_automatically",    "default_payment_method": null,    "default_source": null,    "description": null,    "invoice_settings": {      "issuer": {        "type": "self"      }    },    "on_behalf_of": null,    "transfer_data": null  },  "end_behavior": "release",  "livemode": false,  "metadata": {},  "phases": [    {      "add_invoice_items": [],      "application_fee_percent": null,      "billing_cycle_anchor": null,      "collection_method": null,      "currency": "usd",      "default_payment_method": null,      "default_tax_rates": [],      "description": null,      "discounts": null,      "end_date": 1818666418,      "invoice_settings": null,      "items": [        {          "discounts": null,          "metadata": {},          "plan": "price_1Mr3YcLkdIwHu7ixYCFhXHNb",          "price": "price_1Mr3YcLkdIwHu7ixYCFhXHNb",          "quantity": 1,          "tax_rates": []        }      ],      "metadata": {},      "on_behalf_of": null,      "proration_behavior": "create_prorations",      "start_date": 1787130418,      "transfer_data": null,      "trial_end": null    }  ],  "released_at": null,  "released_subscription": null,  "renewal_interval": null,  "status": "not_started",  "subscription": null,  "test_clock": null}
```
