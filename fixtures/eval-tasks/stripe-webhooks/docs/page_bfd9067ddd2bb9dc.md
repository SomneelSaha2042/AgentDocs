# [Payment Records](/api/payment-record)

Ask about this section

Copy for LLM

View as Markdown

A Payment Record is a resource that allows you to represent payments that occur on- or off-Stripe. For example, you can create a Payment Record to model a payment made on a different payment processor, in order to mark an Invoice as paid and a Subscription as active. Payment Records consist of one or more Payment Attempt Records, which represent individual attempts made on a payment network.

Was this section helpful?YesNo

[](/api/payment-record/retrieve)

Retrieve a Payment Record

GET/v1/payment\_records/:id

[](/api/payment-record/report)

Report a payment

POST/v1/payment\_records/report\_payment

[](/api/payment-record/report-payment-attempt/report)

Report a payment attempt

POST/v1/payment\_records/:id/report\_payment\_attempt

[](/api/payment-record/report-refund/report)

Report a refund

POST/v1/payment\_records/:id/report\_refund

[](/api/payment-record/report-payment-attempt-canceled/report)

Report payment attempt canceled

POST/v1/payment\_records/:id/report\_payment\_attempt\_canceled

[](/api/payment-record/report-payment-attempt-failed/report)

Report payment attempt failed

POST/v1/payment\_records/:id/report\_payment\_attempt\_failed

[](/api/payment-record/report-payment-attempt-guaranteed/report)

Report payment attempt guaranteed

POST/v1/payment\_records/:id/report\_payment\_attempt\_guaranteed

[](/api/payment-record/report-payment-attempt-informational/report)

Report payment attempt informational

POST/v1/payment\_records/:id/report\_payment\_attempt\_informational

# [The Payment Record object](/api/payment-record/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object.
    
-   #### 
    
    amountobject
    
    The amount you intend to collect for this payment.
    
    Show child attributes
    
-   #### 
    
    amount\_authorizedobject
    
    The portion of the requested amount that has been authorized to be guaranteed by the payment provider.
    
    Show child attributes
    
-   #### 
    
    amount\_canceledobject
    
    The portion of the requested amount that has been canceled by the user, or that you no longer intend to collect.
    
    Show child attributes
    
-   #### 
    
    amount\_failedobject
    
    The portion of the requested amount that failed to be collected.
    
    Show child attributes
    
-   #### 
    
    amount\_guaranteedobject
    
    The portion of the requested amount that has been guaranteed by the payment provider.
    
    Show child attributes
    
-   #### 
    
    amount\_refundedobject
    
    The amount that has been refunded to the customer on this payment.
    
    Show child attributes
    
-   #### 
    
    amount\_requestedobject
    
    The amount you initially requested for this payment.
    
    Show child attributes
    
-   #### 
    
    customer\_detailsnullable object
    
    Customer information for this payment.
    
    Show child attributes
    
-   #### 
    
    customer\_presencenullable enum
    
    Indicates whether the customer was present in your checkout flow during this payment.
    
    Possible enum values
    
    `off_session`
    
    The customer was not present during the transaction.
    
    `on_session`
    
    The customer was present during the transaction.
    
-   #### 
    
    descriptionnullable string
    
    An arbitrary string attached to the object. Often useful for displaying to users.
    
-   #### 
    
    metadataobject
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.
    
-   #### 
    
    payment\_method\_detailsnullable object
    
    Information about the Payment Method debited for this payment.
    
    Show child attributes
    
-   #### 
    
    processor\_detailsobject
    
    Processor information for this payment.
    
    Show child attributes
    
-   #### 
    
    shipping\_detailsnullable object
    
    Shipping information for this payment.
    
    Show child attributes
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    applicationnullable string
    
-   #### 
    
    createdtimestamp
    
-   #### 
    
    latest\_payment\_attempt\_recordnullable string
    
-   #### 
    
    livemodeboolean
    
-   #### 
    
    reported\_byenum
    

The Payment Record object

```
{  "id": "pr_5RV730PrHyAEi",  "object": "payment_record",  "amount_authorized": {    "currency": "usd",    "value": 1000  },  "amount_canceled": {    "currency": "usd",    "value": 0  },  "amount_failed": {    "currency": "usd",    "value": 0  },  "amount_guaranteed": {    "currency": "usd",    "value": 0  },  "amount_refunded": {    "currency": "usd",    "value": 0  },  "amount_requested": {    "currency": "usd",    "value": 1000  },  "created": 1730211363,  "customer_details": null,  "customer_presence": "on_session",  "description": "computer software",  "latest_payment_attempt_record": "par_1ArV730PrHyQuG",  "livemode": true,  "metadata": {},  "payment_method_details": {    "billing_details": null,    "custom": {      "display_name": "newpay",      "type": "custom"    },    "payment_method": null,    "type": "custom"  },  "processor_details": {    "type": "custom",    "custom": {      "payment_reference": "npp2358872734k"    }  },  "shipping_details": null}
```

# [Retrieve a Payment Record](/api/payment-record/retrieve)

Ask about this section

Copy for LLM

View as Markdown

GET /v1/payment\_records/:id

Retrieves a Payment Record with the given ID

### Parameters

-   #### 
    
    idstringRequired
    
    The ID of the Payment Record.
    

### Returns

Returns a Payment Record object if a valid ID was provided. Otherwise, this call raises an error.

```
curl https://api.stripe.com/v1/payment_records/pr_5RV730PrHyAEi \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:"
```

Response

```
{  "id": "pr_5RV730PrHyAEi",  "object": "payment_record",  "amount_canceled": {    "currency": "usd",    "value": 0  },  "amount_failed": {    "currency": "usd",    "value": 0  },  "amount_guaranteed": {    "currency": "usd",    "value": 0  },  "amount_refunded": {    "currency": "usd",    "value": 0  },  "amount_requested": {    "currency": "usd",    "value": 1000  },  "created": 1730211363,  "customer_details": null,  "customer_presence": "on_session",  "description": "computer software",  "latest_payment_attempt_record": "par_1ArV730PrHyQuG",  "livemode": true,  "metadata": {},  "payment_method_details": {    "billing_details": null,    "custom": {      "display_name": "newpay",      "type": "custom"    },    "payment_method": null,    "type": "custom"  },  "processor_details": {    "type": "custom",    "custom": {      "payment_reference": "npp2358872734k"    }  },  "shipping_details": null}
```
