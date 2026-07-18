# [Tax Rate](/api/tax_rates)

Ask about this section

Copy for LLM

View as Markdown

Tax rates can be applied to [invoices](/invoicing/taxes/tax-rates), [subscriptions](/billing/taxes/tax-rates) and [Checkout Sessions](/payments/checkout/use-manual-tax-rates) to collect tax.

Related guide: [Tax rates](/billing/taxes/tax-rates)

Was this section helpful?YesNo

[](/api/tax_rates/create)

Create a tax rate

POST/v1/tax\_rates

[](/api/tax_rates/update)

Update a tax rate

POST/v1/tax\_rates/:id

[](/api/tax_rates/retrieve)

Retrieve a tax rate

GET/v1/tax\_rates/:id

[](/api/tax_rates/list)

List all tax rates

GET/v1/tax\_rates

# [The Tax Rate object](/api/tax_rates/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object.
    
-   #### 
    
    activeboolean
    
    Defaults to `true`. When set to `false`, this tax rate cannot be used with new applications or Checkout Sessions, but will still work for subscriptions and invoices that already have it set.
    
-   #### 
    
    countrynullable string
    
    Two-letter country code ([ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2)).
    
-   #### 
    
    descriptionnullable string
    
    An arbitrary string attached to the tax rate for your internal use only. It will not be visible to your customers.
    
-   #### 
    
    display\_namestring
    
    The display name of the tax rates as it will appear to your customer on their receipt email, PDF, and the hosted invoice page.
    
-   #### 
    
    inclusiveboolean
    
    This specifies if the tax rate is inclusive or exclusive.
    
-   #### 
    
    jurisdictionnullable string
    
    The jurisdiction for the tax rate. You can use this label field for tax reporting purposes. It also appears on your customer’s invoice.
    
-   #### 
    
    metadatanullable object
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.
    
-   #### 
    
    percentagefloat
    
    Tax rate percentage out of 100. For tax calculations with automatic\_tax\[enabled\]=true, this percentage includes the statutory tax rate of non-taxable jurisdictions.
    
-   #### 
    
    statenullable string
    
    [ISO 3166-2 subdivision code](https://en.wikipedia.org/wiki/ISO_3166-2), without country prefix. For example, “NY” for New York, United States.
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    createdtimestamp
    
-   #### 
    
    effective\_percentagenullable float
    
-   #### 
    
    flat\_amountnullable object
    
-   #### 
    
    jurisdiction\_levelnullable enum
    
-   #### 
    
    livemodeboolean
    
-   #### 
    
    rate\_typenullable enum
    
-   #### 
    
    tax\_typenullable enum
    

The Tax Rate object

```
{  "id": "txr_1MzS4RLkdIwHu7ixwvpZ9c2i",  "object": "tax_rate",  "active": true,  "country": null,  "created": 1682114687,  "description": "VAT Germany",  "display_name": "VAT",  "inclusive": false,  "jurisdiction": "DE",  "livemode": false,  "metadata": {},  "percentage": 16,  "state": null,  "tax_type": null}
```

# [Create a tax rate](/api/tax_rates/create)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/tax\_rates

Creates a new tax rate.

### Parameters

-   #### 
    
    display\_namestringRequired
    
    The display name of the tax rate, which will be shown to users.
    
    The maximum length is 50 characters.
    
-   #### 
    
    inclusivebooleanRequired
    
    This specifies if the tax rate is inclusive or exclusive.
    
-   #### 
    
    percentagefloatRequired
    
    This represents the tax rate percent out of 100.
    
-   #### 
    
    activeboolean
    
    Flag determining whether the tax rate is active or inactive (archived). Inactive tax rates cannot be used with new applications or Checkout Sessions, but will still work for subscriptions and invoices that already have it set.
    
-   #### 
    
    countrystring
    
    Two-letter country code ([ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2)).
    
-   #### 
    
    descriptionstring
    
    An arbitrary string attached to the tax rate for your internal use only. It will not be visible to your customers.
    
-   #### 
    
    jurisdictionstring
    
    The jurisdiction for the tax rate. You can use this label field for tax reporting purposes. It also appears on your customer’s invoice.
    
    The maximum length is 50 characters.
    
-   #### 
    
    metadataobject
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to `metadata`.
    
-   #### 
    
    statestring
    
    [ISO 3166-2 subdivision code](https://en.wikipedia.org/wiki/ISO_3166-2), without country prefix. For example, “NY” for New York, United States.
    

### More parameters

Expand all

-   #### 
    
    tax\_typeenum
    

### Returns

The created tax rate object.

```
curl https://api.stripe.com/v1/tax_rates \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d display_name=VAT \  -d "description=VAT Germany" \  -d percentage=16 \  -d jurisdiction=DE \  -d inclusive=false
```

Response

```
{  "id": "txr_1MzS4RLkdIwHu7ixwvpZ9c2i",  "object": "tax_rate",  "active": true,  "country": null,  "created": 1682114687,  "description": "VAT Germany",  "display_name": "VAT",  "inclusive": false,  "jurisdiction": "DE",  "livemode": false,  "metadata": {},  "percentage": 16,  "state": null,  "tax_type": null}
```
