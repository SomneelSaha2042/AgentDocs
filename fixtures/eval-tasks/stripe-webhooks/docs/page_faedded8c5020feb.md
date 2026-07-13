# [Payment Link](/api/payment-link)

Ask about this section

Copy for LLM

View as Markdown

A payment link is a shareable URL that will take your customers to a hosted payment page. A payment link can be shared and used multiple times.

When a customer opens a payment link it will open a new [checkout session](/api/checkout/sessions) to render the payment page. You can use [checkout session events](/api/events/types#event_types-checkout.session.completed) to track payments through payment links.

Related guide: [Payment Links API](/payment-links)

Was this section helpful?YesNo

[](/api/payment-link/create)

Create a payment link

POST/v1/payment\_links

[](/api/payment-link/update)

Update a payment link

POST/v1/payment\_links/:id

[](/api/payment-link/retrieve)

Retrieve payment link

GET/v1/payment\_links/:id

[](/api/payment-link/retrieve-line-items)

Retrieve a payment link's line items

GET/v1/payment\_links/:id/line\_items

[](/api/payment-link/list)

List all payment links

GET/v1/payment\_links

# [The Payment Link object](/api/payment-link/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object.
    
-   #### 
    
    activeboolean
    
    Whether the payment link’s `url` is active. If `false`, customers visiting the URL will be shown a page saying that the link has been deactivated.
    
-   #### 
    
    line\_itemsobjectExpandable
    
    The line items representing what is being sold.
    
    Show child attributes
    
-   #### 
    
    metadataobject
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.
    
-   #### 
    
    urlstring
    
    The public URL that can be shared with customers.
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    after\_completionobject
    
-   #### 
    
    allow\_promotion\_codesboolean
    
-   #### 
    
    applicationnullable stringExpandableConnect only
    
-   #### 
    
    application\_fee\_amountnullable integerConnect only
    
-   #### 
    
    application\_fee\_percentnullable floatConnect only
    
-   #### 
    
    automatic\_taxobject
    
-   #### 
    
    billing\_address\_collectionenum
    
-   #### 
    
    consent\_collectionnullable object
    
-   #### 
    
    currencyenum
    
-   #### 
    
    custom\_fieldsarray of objects
    
-   #### 
    
    custom\_textobject
    
-   #### 
    
    customer\_creationenum
    
-   #### 
    
    inactive\_messagenullable string
    
-   #### 
    
    invoice\_creationnullable object
    
-   #### 
    
    livemodeboolean
    
-   #### 
    
    managed\_paymentsnullable object
    
-   #### 
    
    name\_collectionnullable object
    
-   #### 
    
    on\_behalf\_ofnullable stringExpandableConnect only
    
-   #### 
    
    optional\_itemsnullable array of objectsExpandable
    
-   #### 
    
    payment\_intent\_datanullable object
    
-   #### 
    
    payment\_method\_collectionenum
    
-   #### 
    
    payment\_method\_optionsnullable object
    
-   #### 
    
    payment\_method\_typesnullable array of enums
    
-   #### 
    
    phone\_number\_collectionobject
    
-   #### 
    
    restrictionsnullable object
    
-   #### 
    
    shipping\_address\_collectionnullable object
    
-   #### 
    
    shipping\_optionsarray of objects
    
-   #### 
    
    submit\_typeenum
    
-   #### 
    
    subscription\_datanullable object
    
-   #### 
    
    tax\_id\_collectionobject
    
-   #### 
    
    transfer\_datanullable objectConnect only
    

The Payment Link object

```
{  "id": "plink_1MoC3ULkdIwHu7ixZjtGpVl2",  "object": "payment_link",  "active": true,  "after_completion": {    "hosted_confirmation": {      "custom_message": null    },    "type": "hosted_confirmation"  },  "allow_promotion_codes": false,  "application_fee_amount": null,  "application_fee_percent": null,  "automatic_tax": {    "enabled": false,    "liability": null  },  "billing_address_collection": "auto",  "consent_collection": null,  "currency": "usd",  "custom_fields": [],  "custom_text": {    "shipping_address": null,    "submit": null  },  "customer_creation": "if_required",  "invoice_creation": {    "enabled": false,    "invoice_data": {      "account_tax_ids": null,      "custom_fields": null,      "description": null,      "footer": null,      "issuer": null,      "metadata": {},      "rendering_options": null    }  },  "livemode": false,  "metadata": {},  "on_behalf_of": null,  "payment_intent_data": null,  "payment_method_collection": "always",  "payment_method_types": null,  "phone_number_collection": {    "enabled": false  },  "shipping_address_collection": null,  "shipping_options": [],  "submit_type": "auto",  "subscription_data": {    "description": null,    "invoice_settings": {      "issuer": {        "type": "self"      }    },    "trial_period_days": null  },  "tax_id_collection": {    "enabled": false  },  "transfer_data": null,  "url": "https://buy.stripe.com/test_cN25nr0iZ7bUa7meUY"}
```

# [Create a payment link](/api/payment-link/create)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/payment\_links

Creates a payment link.

### Parameters

-   #### 
    
    line\_itemsarray of objectsRequired
    
    The line items representing what is being sold. Each line item represents an item being sold. Up to 20 line items are supported.
    
    Show child parameters
    
-   #### 
    
    metadataobject
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to `metadata`. Metadata associated with this Payment Link will automatically be copied to [checkout sessions](/api/checkout/sessions) created by this payment link.
    

### More parameters

Expand all

-   #### 
    
    after\_completionobject
    
-   #### 
    
    allow\_promotion\_codesboolean
    
-   #### 
    
    application\_fee\_amountintegerConnect only
    
-   #### 
    
    application\_fee\_percentfloatConnect only
    
-   #### 
    
    automatic\_taxobject
    
-   #### 
    
    billing\_address\_collectionenum
    
-   #### 
    
    consent\_collectionobject
    
-   #### 
    
    currencyenum
    
-   #### 
    
    custom\_fieldsarray of objects
    
-   #### 
    
    custom\_textobject
    
-   #### 
    
    customer\_creationenum
    
-   #### 
    
    inactive\_messagestring
    
-   #### 
    
    invoice\_creationobject
    
-   #### 
    
    managed\_paymentsobject
    
-   #### 
    
    name\_collectionobject
    
-   #### 
    
    on\_behalf\_ofstringConnect only
    
-   #### 
    
    optional\_itemsarray of objects
    
-   #### 
    
    payment\_intent\_dataobject
    
-   #### 
    
    payment\_method\_collectionenum
    
-   #### 
    
    payment\_method\_optionsobject
    
-   #### 
    
    payment\_method\_typesarray of enums
    
-   #### 
    
    phone\_number\_collectionobject
    
-   #### 
    
    restrictionsobject
    
-   #### 
    
    shipping\_address\_collectionobject
    
-   #### 
    
    shipping\_optionsarray of objects
    
-   #### 
    
    submit\_typeenum
    
-   #### 
    
    subscription\_dataobject
    
-   #### 
    
    tax\_id\_collectionobject
    
-   #### 
    
    transfer\_dataobjectConnect only
    

### Returns

Returns the payment link.

```
curl https://api.stripe.com/v1/payment_links \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d "line_items[0][price]={{PRICE_ID}}" \  -d "line_items[0][quantity]=1"
```

Response

```
{  "id": "plink_1MoC3ULkdIwHu7ixZjtGpVl2",  "object": "payment_link",  "active": true,  "after_completion": {    "hosted_confirmation": {      "custom_message": null    },    "type": "hosted_confirmation"  },  "allow_promotion_codes": false,  "application_fee_amount": null,  "application_fee_percent": null,  "automatic_tax": {    "enabled": false,    "liability": null  },  "billing_address_collection": "auto",  "consent_collection": null,  "currency": "usd",  "custom_fields": [],  "custom_text": {    "shipping_address": null,    "submit": null  },  "customer_creation": "if_required",  "invoice_creation": {    "enabled": false,    "invoice_data": {      "account_tax_ids": null,      "custom_fields": null,      "description": null,      "footer": null,      "issuer": null,      "metadata": {},      "rendering_options": null    }  },  "livemode": false,  "metadata": {},  "on_behalf_of": null,  "payment_intent_data": null,  "payment_method_collection": "always",  "payment_method_types": null,  "phone_number_collection": {    "enabled": false  },  "shipping_address_collection": null,  "shipping_options": [],  "submit_type": "auto",  "subscription_data": {    "description": null,    "invoice_settings": {      "issuer": {        "type": "self"      }    },    "trial_period_days": null  },  "tax_id_collection": {    "enabled": false  },  "transfer_data": null,  "url": "https://buy.stripe.com/test_cN25nr0iZ7bUa7meUY"}
```
