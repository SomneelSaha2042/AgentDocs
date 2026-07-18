# [Sources](/api/sources)Deprecated

Ask about this section

Copy for LLM

View as Markdown

`Source` objects allow you to accept a variety of payment methods. They represent a customer’s payment instrument, and can be used with the Stripe API just like a `Card` object: once chargeable, they can be charged, or can be attached to customers.

Stripe doesn’t recommend using the deprecated [Sources API](/api/sources). We recommend that you adopt the [PaymentMethods API](/api/payment_methods). This newer API provides access to our latest features and payment method types.

Related guides: [Sources API](/sources) and [Sources & Customers](/sources/customers).

Was this section helpful?YesNo

[](/api/sources/create)

Create a source

POST/v1/sources

[](/api/sources/update)

Update a source

POST/v1/sources/:id

[](/api/sources/retrieve)

Retrieve a source

GET/v1/sources/:id

[](/api/sources/attach)

Attach a source

POST/v1/customers/:id/sources

[](/api/sources/detach)

Detach a source

DELETE/v1/customers/:id/sources/:id

# [The Source object](/api/sources/object)Deprecated

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object.
    
-   #### 
    
    amountnullable integer
    
    A positive integer in the smallest currency unit (that is, 100 cents for $1.00, or 1 for ¥1, Japanese Yen being a zero-decimal currency) representing the total amount associated with the source. This is the amount for which the source will be chargeable once ready. Required for `single_use` sources.
    
-   #### 
    
    currencynullable enum
    
    Three-letter [ISO code for the currency](https://stripe.com/docs/currencies) associated with the source. This is the currency for which the source will be chargeable once ready. Required for `single_use` sources.
    
-   #### 
    
    customernullable string
    
    The ID of the customer to which this source is attached. This will not be present when the source has not been attached to a customer.
    
-   #### 
    
    metadatanullable object
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.
    
-   #### 
    
    ownernullable object
    
    Information about the owner of the payment instrument that may be used or required by particular source types.
    
    Show child attributes
    
-   #### 
    
    redirectnullable object
    
    Information related to the redirect flow. Present if the source is authenticated by a redirect (`flow` is `redirect`).
    
    Show child attributes
    
-   #### 
    
    statement\_descriptornullable string
    
    Extra information about a source. This will appear on your customer’s statement every time you charge the source.
    
-   #### 
    
    statusstring
    
    The status of the source, one of `canceled`, `chargeable`, `consumed`, `failed`, or `pending`. Only `chargeable` sources can be used to create a charge.
    
-   #### 
    
    typeenum
    
    The `type` of the source. The `type` is a payment method, one of `ach_credit_transfer`, `ach_debit`, `alipay`, `bancontact`, `card`, `card_present`, `eps`, `giropay`, `ideal`, `multibanco`, `klarna`, `p24`, `sepa_debit`, `sofort`, `three_d_secure`, or `wechat`. An additional hash is included on the source with a name matching this value. It contains additional information specific to the [payment method](/sources) used.
    
    Possible enum values
    
    `ach_credit_transfer`
    
    `ach_debit`
    
    `alipay`
    
    `bancontact`
    
    `card`
    
    `card_present`
    
    `eps`
    
    `giropay`
    
    `ideal`
    
    `klarna`
    
    Show 6 more
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    allow\_redisplaynullable enum
    
-   #### 
    
    client\_secretstring
    
-   #### 
    
    code\_verificationnullable object
    
-   #### 
    
    createdtimestamp
    
-   #### 
    
    flowstring
    
-   #### 
    
    livemodeboolean
    
-   #### 
    
    receivernullable object
    
-   #### 
    
    source\_ordernullable object
    
-   #### 
    
    usagenullable string
    

The Source object

```
{  "id": "src_1N3lxdLkdIwHu7ixPHXy8UcI",  "object": "source",  "ach_credit_transfer": {    "account_number": "test_eb829353ed79",    "bank_name": "TEST BANK",    "fingerprint": "kBQsBk9KtfCgjEYK",    "refund_account_holder_name": null,    "refund_account_holder_type": null,    "refund_routing_number": null,    "routing_number": "110000000",    "swift_code": "TSTEZ122"  },  "amount": null,  "client_secret": "src_client_secret_ZaOIRUD8a9uGmQobLxGvqKSr",  "created": 1683144457,  "currency": "usd",  "flow": "receiver",  "livemode": false,  "metadata": {},  "owner": {    "address": null,    "email": "jenny.rosen@example.com",    "name": null,    "phone": null,    "verified_address": null,    "verified_email": null,    "verified_name": null,    "verified_phone": null  },  "receiver": {    "address": "110000000-test_eb829353ed79",    "amount_charged": 0,    "amount_received": 0,    "amount_returned": 0,    "refund_attributes_method": "email",    "refund_attributes_status": "missing"  },  "statement_descriptor": null,  "status": "pending",  "type": "ach_credit_transfer",  "usage": "reusable"}
```

# [Create a source](/api/sources/create)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/sources

Creates a new source object.

### Parameters

-   #### 
    
    typestringRequired
    
    The `type` of the source to create. Required unless `customer` and `original_source` are specified (see the [Cloning card Sources](/sources/connect#cloning-card-sources) guide)
    
-   #### 
    
    amountinteger
    
    Amount associated with the source. This is the amount for which the source will be chargeable once ready. Required for `single_use` sources. Not supported for `receiver` type sources, where charge amount may not be specified until funds land.
    
-   #### 
    
    currencyenum
    
    Three-letter [ISO code for the currency](https://stripe.com/docs/currencies) associated with the source. This is the currency for which the source will be chargeable once ready.
    
-   #### 
    
    metadataobject
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to `metadata`.
    
-   #### 
    
    ownerobject
    
    Information about the owner of the payment instrument that may be used or required by particular source types.
    
    Show child parameters
    
-   #### 
    
    redirectobject
    
    Parameters required for the redirect flow. Required if the source is authenticated by a redirect (`flow` is `redirect`).
    
    Show child parameters
    
-   #### 
    
    statement\_descriptorstring
    
    An arbitrary string to be displayed on your customer’s statement. As an example, if your website is `RunClub` and the item you’re charging for is a race ticket, you may want to specify a `statement_descriptor` of `RunClub 5K race ticket.` While many payment types will display this information, some may not display it at all.
    

### More parameters

Expand all

-   #### 
    
    flowstring
    
-   #### 
    
    mandateobject
    
-   #### 
    
    receiverobject
    
-   #### 
    
    source\_orderobject
    
-   #### 
    
    tokenstring
    
-   #### 
    
    usagestring
    

### Returns

Returns a newly created source.

```
curl https://api.stripe.com/v1/sources \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d type=ach_credit_transfer \  -d currency=usd \  --data-urlencode "owner[email]=jenny.rosen@example.com"
```

Response

```
{  "id": "src_1N3lxdLkdIwHu7ixPHXy8UcI",  "object": "source",  "ach_credit_transfer": {    "account_number": "test_eb829353ed79",    "bank_name": "TEST BANK",    "fingerprint": "kBQsBk9KtfCgjEYK",    "refund_account_holder_name": null,    "refund_account_holder_type": null,    "refund_routing_number": null,    "routing_number": "110000000",    "swift_code": "TSTEZ122"  },  "amount": null,  "client_secret": "src_client_secret_ZaOIRUD8a9uGmQobLxGvqKSr",  "created": 1683144457,  "currency": "usd",  "flow": "receiver",  "livemode": false,  "metadata": {},  "owner": {    "address": null,    "email": "jenny.rosen@example.com",    "name": null,    "phone": null,    "verified_address": null,    "verified_email": null,    "verified_name": null,    "verified_phone": null  },  "receiver": {    "address": "110000000-test_eb829353ed79",    "amount_charged": 0,    "amount_received": 0,    "amount_returned": 0,    "refund_attributes_method": "email",    "refund_attributes_status": "missing"  },  "statement_descriptor": null,  "status": "pending",  "type": "ach_credit_transfer",  "usage": "reusable"}
```
