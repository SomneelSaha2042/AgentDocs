# [Plans](/api/plans)

Ask about this section

Copy for LLM

View as Markdown

You can now model subscriptions more flexibly using the [Prices API](#prices). It replaces the Plans API and is backwards compatible to simplify your migration.

Plans define the base price, currency, and billing cycle for recurring purchases of products. [Products](#products) help you track inventory or provisioning, and plans help you track pricing. Different physical goods or levels of service should be represented by products, and pricing options should be represented by plans. This approach lets you change prices without having to change your provisioning scheme.

For example, you might have a single “gold” product that has plans for $10/month, $100/year, €9/month, and €90/year.

Related guides: [Set up a subscription](/billing/subscriptions/set-up-subscription) and more about [products and prices](/products-prices/overview).

Was this section helpful?YesNo

[](/api/plans/create)

Create a plan

POST/v1/plans

[](/api/plans/update)

Update a plan

POST/v1/plans/:id

[](/api/plans/retrieve)

Retrieve a plan

GET/v1/plans/:id

[](/api/plans/list)

List all plans

GET/v1/plans

[](/api/plans/delete)

Delete a plan

DELETE/v1/plans/:id

# [The Plan object](/api/plans/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object.
    
-   #### 
    
    activeboolean
    
    Whether the plan can be used for new purchases.
    
-   #### 
    
    amountnullable integer
    
    The unit amount in the smallest currency unit to be charged, represented as a whole integer if possible. Only set if `billing_scheme=per_unit`.
    
-   #### 
    
    currencyenum
    
    Three-letter [ISO currency code](https://www.iso.org/iso-4217-currency-codes.html), in lowercase. Must be a [supported currency](https://stripe.com/docs/currencies).
    
-   #### 
    
    intervalenum
    
    The frequency at which a subscription is billed. One of `day`, `week`, `month` or `year`.
    
-   #### 
    
    metadatanullable object
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.
    
-   #### 
    
    nicknamenullable string
    
    A brief description of the plan, hidden from customers.
    
-   #### 
    
    productnullable stringExpandable
    
    The product whose pricing this plan determines.
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    amount\_decimalnullable decimal string
    
-   #### 
    
    billing\_schemeenum
    
-   #### 
    
    createdtimestamp
    
-   #### 
    
    interval\_countinteger
    
-   #### 
    
    livemodeboolean
    
-   #### 
    
    meternullable string
    
-   #### 
    
    tiersnullable array of objectsExpandable
    
-   #### 
    
    tiers\_modenullable enum
    
-   #### 
    
    transform\_usagenullable object
    
-   #### 
    
    trial\_period\_daysnullable integer
    
-   #### 
    
    usage\_typeenum
    

The Plan object

```
{  "id": "plan_NjpIbv3g3ZibnD",  "object": "plan",  "active": true,  "amount": 1200,  "amount_decimal": "1200",  "billing_scheme": "per_unit",  "created": 1681851647,  "currency": "usd",  "interval": "month",  "interval_count": 1,  "livemode": false,  "metadata": {},  "nickname": null,  "product": "prod_NjpI7DbZx6AlWQ",  "tiers_mode": null,  "transform_usage": null,  "trial_period_days": null,  "usage_type": "licensed"}
```

# [Create a plan](/api/plans/create)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/plans

You can now model subscriptions more flexibly using the [Prices API](#prices). It replaces the Plans API and is backwards compatible to simplify your migration.

### Parameters

-   #### 
    
    currencyenumRequired
    
    Three-letter [ISO currency code](https://www.iso.org/iso-4217-currency-codes.html), in lowercase. Must be a [supported currency](https://stripe.com/docs/currencies).
    
-   #### 
    
    intervalenumRequired
    
    Specifies billing frequency. Either `day`, `week`, `month` or `year`.
    
    Possible enum values
    
    `day`
    
    `month`
    
    `week`
    
    `year`
    
-   #### 
    
    productobjectRequired
    
    The product whose pricing the created plan will represent. This can either be the ID of an existing product, or a dictionary containing fields used to create a [service product](/api#product_object-type).
    
    Show child parameters
    
-   #### 
    
    activeboolean
    
    Whether the plan is currently available for new subscriptions. Defaults to `true`.
    
-   #### 
    
    amountintegerRequired unless billing\_scheme=tiered
    
    A positive integer in the smallest currency unit (or 0 for a free plan) representing how much to charge on a recurring basis.
    
-   #### 
    
    metadataobject
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to `metadata`.
    
-   #### 
    
    nicknamestring
    
    A brief description of the plan, hidden from customers.
    

### More parameters

Expand all

-   #### 
    
    amount\_decimalstring
    
-   #### 
    
    billing\_schemeenum
    
-   #### 
    
    idstring
    
-   #### 
    
    interval\_countinteger
    
-   #### 
    
    meterstring
    
-   #### 
    
    tiersarray of objectsRequired if billing\_scheme=tiered
    
-   #### 
    
    tiers\_modeenumRequired if billing\_scheme=tiered
    
-   #### 
    
    transform\_usageobject
    
-   #### 
    
    trial\_period\_daysinteger
    
-   #### 
    
    usage\_typeenum
    

### Returns

Returns the plan object.

```
curl https://api.stripe.com/v1/plans \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d amount=1200 \  -d currency=usd \  -d interval=month \  -d product={{PRODUCT_ID}}
```

Response

```
{  "id": "plan_NjpIbv3g3ZibnD",  "object": "plan",  "active": true,  "amount": 1200,  "amount_decimal": "1200",  "billing_scheme": "per_unit",  "created": 1681851647,  "currency": "usd",  "interval": "month",  "interval_count": 1,  "livemode": false,  "metadata": {},  "nickname": null,  "product": "prod_NjpI7DbZx6AlWQ",  "tiers_mode": null,  "transform_usage": null,  "trial_period_days": null,  "usage_type": "licensed"}
```
