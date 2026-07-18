# [Prices](/api/prices)

Ask about this section

Copy for LLM

View as Markdown

Prices define the unit cost, currency, and (optional) billing cycle for both recurring and one-time purchases of products. [Products](#products) help you track inventory or provisioning, and prices help you track payment terms. Different physical goods or levels of service should be represented by products, and pricing options should be represented by prices. This approach lets you change prices without having to change your provisioning scheme.

For example, you might have a single “gold” product that has prices for $10/month, $100/year, and €9 once.

Related guides: [Set up a subscription](/billing/subscriptions/set-up-subscription), [create an invoice](/billing/invoices/create), and more about [products and prices](/products-prices/overview).

Was this section helpful?YesNo

[](/api/prices/create)

Create a price

POST/v1/prices

[](/api/prices/update)

Update a price

POST/v1/prices/:id

[](/api/prices/retrieve)

Retrieve a price

GET/v1/prices/:id

[](/api/prices/list)

List all prices

GET/v1/prices

[](/api/prices/search)

Search prices

GET/v1/prices/search

# [The Price object](/api/prices/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object.
    
-   #### 
    
    activeboolean
    
    Whether the price can be used for new purchases.
    
-   #### 
    
    currencyenum
    
    Three-letter [ISO currency code](https://www.iso.org/iso-4217-currency-codes.html), in lowercase. Must be a [supported currency](https://stripe.com/docs/currencies).
    
-   #### 
    
    metadataobject
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.
    
-   #### 
    
    nicknamenullable string
    
    A brief description of the price, hidden from customers.
    
-   #### 
    
    productstringExpandable
    
    The ID of the product this price is associated with.
    
-   #### 
    
    recurringnullable object
    
    The recurring components of a price such as `interval` and `usage_type`.
    
    Show child attributes
    
-   #### 
    
    tax\_behaviornullable enum
    
    Only required if a [default tax behavior](/tax/products-prices-tax-categories-tax-behavior#setting-a-default-tax-behavior-\(recommended\)) was not provided in the Stripe Tax settings. Specifies whether the price is considered inclusive of taxes or exclusive of taxes. One of `inclusive`, `exclusive`, or `unspecified`. Once specified as either `inclusive` or `exclusive`, it cannot be changed.
    
    Possible enum values
    
    `exclusive`
    
    `inclusive`
    
    `unspecified`
    
-   #### 
    
    typeenum
    
    One of `one_time` or `recurring` depending on whether the price is for a one-time purchase or a recurring (subscription) purchase.
    
    Possible enum values
    
    `one_time`
    
    `recurring`
    
-   #### 
    
    unit\_amountnullable integer
    
    The unit amount in the smallest currency unit to be charged, represented as a whole integer if possible. Only set if `billing_scheme=per_unit`.
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    billing\_schemeenum
    
-   #### 
    
    createdtimestamp
    
-   #### 
    
    currency\_optionsnullable objectExpandable
    
-   #### 
    
    custom\_unit\_amountnullable object
    
-   #### 
    
    livemodeboolean
    
-   #### 
    
    lookup\_keynullable string
    
-   #### 
    
    tiersnullable array of objectsExpandable
    
-   #### 
    
    tiers\_modenullable enum
    
-   #### 
    
    transform\_quantitynullable object
    
-   #### 
    
    unit\_amount\_decimalnullable decimal string
    

The Price object

```
{  "id": "price_1MoBy5LkdIwHu7ixZhnattbh",  "object": "price",  "active": true,  "billing_scheme": "per_unit",  "created": 1679431181,  "currency": "usd",  "custom_unit_amount": null,  "livemode": false,  "lookup_key": null,  "metadata": {},  "nickname": null,  "product": "prod_NZKdYqrwEYx6iK",  "recurring": {    "interval": "month",    "interval_count": 1,    "trial_period_days": null,    "usage_type": "licensed"  },  "tax_behavior": "unspecified",  "tiers_mode": null,  "transform_quantity": null,  "type": "recurring",  "unit_amount": 1000,  "unit_amount_decimal": "1000"}
```

# [Create a price](/api/prices/create)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/prices

Creates a new [Price](https://docs.stripe.com/api/prices) for an existing [Product](https://docs.stripe.com/api/products). The Price can be recurring or one-time.

### Parameters

-   #### 
    
    currencyenumRequired
    
    Three-letter [ISO currency code](https://www.iso.org/iso-4217-currency-codes.html), in lowercase. Must be a [supported currency](https://stripe.com/docs/currencies).
    
-   #### 
    
    activeboolean
    
    Whether the price can be used for new purchases. Defaults to `true`.
    
-   #### 
    
    metadataobject
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to `metadata`.
    
-   #### 
    
    nicknamestring
    
    A brief description of the price, hidden from customers.
    
-   #### 
    
    productstringRequired unless product\_data is provided
    
    The ID of the [Product](https://docs.stripe.com/api/products) that this [Price](https://docs.stripe.com/api/prices) will belong to.
    
-   #### 
    
    recurringobject
    
    The recurring components of a price such as `interval` and `usage_type`.
    
    Show child parameters
    
-   #### 
    
    tax\_behaviorenumRecommended if calculating taxes
    
    Only required if a [default tax behavior](/tax/products-prices-tax-categories-tax-behavior#setting-a-default-tax-behavior-\(recommended\)) was not provided in the Stripe Tax settings. Specifies whether the price is considered inclusive of taxes or exclusive of taxes. One of `inclusive`, `exclusive`, or `unspecified`. Once specified as either `inclusive` or `exclusive`, it cannot be changed.
    
    Possible enum values
    
    `exclusive`
    
    `inclusive`
    
    `unspecified`
    
-   #### 
    
    unit\_amountintegerRequired conditionally
    
    A positive integer in the smallest currency unit (or 0 for a free price) representing how much to charge. One of `unit_amount`, `unit_amount_decimal`, or `custom_unit_amount` is required, unless `billing_scheme=tiered`.
    

### More parameters

Expand all

-   #### 
    
    billing\_schemeenum
    
-   #### 
    
    currency\_optionsobject
    
-   #### 
    
    custom\_unit\_amountobjectRequired unless unit\_amount is provided
    
-   #### 
    
    lookup\_keystring
    
-   #### 
    
    product\_dataobjectRequired unless product is provided
    
-   #### 
    
    tiersarray of objectsRequired if billing\_scheme=tiered
    
-   #### 
    
    tiers\_modeenumRequired if billing\_scheme=tiered
    
-   #### 
    
    transfer\_lookup\_keyboolean
    
-   #### 
    
    transform\_quantityobject
    
-   #### 
    
    unit\_amount\_decimalstring
    

### Returns

The newly created `Price` object is returned upon success. Otherwise, this call raises [an error](/api/errors).

```
curl https://api.stripe.com/v1/prices \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d currency=usd \  -d unit_amount=1000 \  -d "recurring[interval]=month" \  -d "product_data[name]=Gold Plan"
```

Response

```
{  "id": "price_1MoBy5LkdIwHu7ixZhnattbh",  "object": "price",  "active": true,  "billing_scheme": "per_unit",  "created": 1679431181,  "currency": "usd",  "custom_unit_amount": null,  "livemode": false,  "lookup_key": null,  "metadata": {},  "nickname": null,  "product": "prod_NZKdYqrwEYx6iK",  "recurring": {    "interval": "month",    "interval_count": 1,    "trial_period_days": null,    "usage_type": "licensed"  },  "tax_behavior": "unspecified",  "tiers_mode": null,  "transform_quantity": null,  "type": "recurring",  "unit_amount": 1000,  "unit_amount_decimal": "1000"}
```
